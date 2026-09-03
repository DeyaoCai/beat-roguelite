/** Web Audio clock + track playback + synthetic SFX bus. Implements AudioClockPort. */

import type { BeepKind } from '../../domain/shared/ports'
import { VoiceBank } from './voiceBank'

/**
 * Calibrated so UI music% ≈ UI sfx% feel similar.
 * User: music 10% with bed 0.42 ≈ sfx 100% → bed ≈ 0.042 at 100%.
 */
const MUSIC_BED = 0.045
/** Synth peak envelopes sit low; lift before sfxGain. */
const SFX_TONE_BOOST = 2.35
/**
 * Min start-to-start for one kind. Extra hits in a burst are staggered, not dropped,
 * until the kind / global cap. Queue farther than MAX_STAGGER is dropped.
 */
const BEEP_GAP: Partial<Record<BeepKind, number>> = {
  ui: 0.07,
  ui_ok: 0.07,
  ui_back: 0.07,
  ui_tick: 0.04,
  pickup_gold: 0.045,
  kill: 0.05,
  kill_elite: 0.08,
  chain: 0.04,
  aura: 0.055,
  slash: 0.04,
  orb: 0.04,
  hit: 0.03,
  hurt: 0.06,
  combo: 0.06,
}

const MAX_STAGGER = 0.22

/** Overlapping + queued copies of one kind. Unlisted kinds default to 3. */
const KIND_VOICE_CAP: Partial<Record<BeepKind, number>> = {
  ui: 2,
  ui_ok: 2,
  ui_back: 2,
  ui_tick: 2,
  pickup_gold: 4,
  kill: 3,
  kill_elite: 2,
  chain: 3,
  aura: 2,
  slash: 2,
  orb: 2,
  hit: 2,
  hurt: 2,
  combo: 2,
}

const GLOBAL_VOICE_CAP = 14
const GLOBAL_TONE_CAP = 28

const BEEP_TONES: Partial<Record<BeepKind, number>> = {
  pickup_gold: 2,
  kill: 2,
  kill_elite: 2,
  kill_boss: 4,
  chain: 2,
  aura: 1,
  slash: 1,
  orb: 1,
  hit: 1,
  hurt: 3,
  combo: 2,
  ui: 1,
  ui_tick: 1,
  ui_ok: 2,
  ui_back: 1,
  miss: 1,
  good: 1,
  perfect: 2,
  fever: 4,
  death: 2,
  offer: 3,
  wave_clear: 4,
  boss_spawn: 4,
}

const BEEP_DUR: Partial<Record<BeepKind, number>> = {
  pickup_gold: 0.1,
  kill: 0.11,
  chain: 0.11,
  aura: 0.12,
  hurt: 0.18,
  ui: 0.05,
  ui_tick: 0.04,
  death: 0.55,
  fever: 0.4,
  kill_boss: 0.32,
  boss_spawn: 0.45,
  wave_clear: 0.46,
}

const BYPASS_CAP: ReadonlySet<BeepKind> = new Set([
  'death',
  'kill_boss',
  'fever',
  'wave_start',
  'wave_clear',
  'boss_spawn',
  'elite_spawn',
  'level_up',
  'offer',
])

type LiveVoice = { kind: BeepKind; end: number; tones: number }

const DEFAULT_MUSIC_GAIN = 1
const DEFAULT_SFX_GAIN = 1

type ToneOpts = {
  type?: OscillatorType
  freq: number
  endFreq?: number
  dur: number
  gain?: number
  delay?: number
  attack?: number
}

export class AudioClock {
  private ctx: AudioContext | null = null
  private startAt = 0
  private bpm = 110
  private running = false
  private buffer: AudioBuffer | null = null
  private source: AudioBufferSourceNode | null = null
  private musicGainNode: GainNode | null = null
  private sfxGainNode: GainNode | null = null
  private analyser: AnalyserNode | null = null
  private freqBytes: Uint8Array | null = null
  /** Unique low→high bins before mirror. */
  private readonly spectrumHalf = new Float32Array(64)
  /** Mirrored: [...half, ...half.reverse()] — circular visualizer layout. */
  private readonly spectrumOut = new Float32Array(128)
  /** Per-kind last synth time; skip if closer than BEEP_GAP. */
  private readonly lastBeepAt = new Map<BeepKind, number>()
  private live: LiveVoice[] = []
  /** Added to every oscillator in the current playBeep (staggered burst). */
  private playDelay = 0
  private musicGain = DEFAULT_MUSIC_GAIN
  private sfxGain = DEFAULT_SFX_GAIN
  /** Tab hidden / window unfocused: output 0, settings unchanged. */
  private outputMute = false
  private looping = false
  private voices = new VoiceBank(
    () => this.ctx,
    () => this.sfxGainNode,
  )
  /** Sofia radio operator — idle + wave/boss/fever lines. Independent of hero pack. */
  private radio = new VoiceBank(
    () => this.ctx,
    () => this.sfxGainNode,
  )

  /** Create the context only. Do not resume — that hangs until a user gesture. */
  async ensure(): Promise<void> {
    this.ensureGraph()
  }

  private ensureGraph(): void {
    if (this.ctx) return
    this.ctx = new AudioContext()
    this.analyser = this.ctx.createAnalyser()
    // co_der-player MVNodesUtils: fftSize power-of-two; keep modest for game loop
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.55
    this.analyser.minDecibels = -90
    this.analyser.maxDecibels = -25
    this.freqBytes = new Uint8Array(this.analyser.frequencyBinCount)

    this.musicGainNode = this.ctx.createGain()
    // source → analyser → musicGain → destination (analyse pre-bed level)
    this.analyser.connect(this.musicGainNode)
    this.musicGainNode.connect(this.ctx.destination)

    this.sfxGainNode = this.ctx.createGain()
    this.sfxGainNode.connect(this.ctx.destination)
    this.applyOutputGains()
  }

  private applyOutputGains(): void {
    const duck = this.outputMute ? 0 : 1
    if (this.musicGainNode) this.musicGainNode.gain.value = this.musicGain * MUSIC_BED * duck
    if (this.sfxGainNode) this.sfxGainNode.gain.value = this.sfxGain * duck
  }

  /** Route buffer source: source → analyser (same as co_der-player MVNodesUtils). */
  private connectMusicSource(src: AudioBufferSourceNode): void {
    if (!this.analyser) return
    src.connect(this.analyser)
  }

  /**
   * Fill bins with music FFT, then **copy + reverse** (co_der / classic radial MV):
   * `[f0..fN, fN..f0]` so a full circle reads symmetric.
   * Returns bass / mid / overall energy for aura punch.
   */
  sampleMusicSpectrum(out?: Float32Array): {
    bins: Float32Array
    bass: number
    mid: number
    energy: number
  } {
    const half = this.spectrumHalf
    const halfN = half.length
    const bins = out && out.length >= halfN * 2 ? out : this.spectrumOut
    if (!this.analyser || !this.freqBytes || !this.source) {
      half.fill(0)
      bins.fill(0)
      return { bins, bass: 0, mid: 0, energy: 0 }
    }
    this.analyser.getByteFrequencyData(this.freqBytes as Uint8Array<ArrayBuffer>)
    const srcN = this.freqBytes.length
    const lo = 1
    const hi = Math.min(srcN - 1, Math.floor(srcN * 0.72))
    const span = Math.max(1, hi - lo)
    let bass = 0
    let mid = 0
    let energy = 0
    const bassEnd = Math.max(1, Math.floor(halfN * 0.18))
    const midEnd = Math.max(bassEnd + 1, Math.floor(halfN * 0.55))
    for (let i = 0; i < halfN; i++) {
      const t0 = lo + (i / halfN) * span
      const t1 = lo + ((i + 1) / halfN) * span
      const a = Math.floor(t0)
      const b = Math.min(srcN - 1, Math.ceil(t1))
      let sum = 0
      let c = 0
      for (let k = a; k <= b; k++) {
        sum += this.freqBytes[k]!
        c++
      }
      const v = Math.pow((sum / Math.max(1, c)) / 255, 1.15)
      half[i] = v
      energy += v
      if (i < bassEnd) bass += v
      else if (i < midEnd) mid += v
    }
    energy /= halfN
    bass /= bassEnd
    mid /= Math.max(1, midEnd - bassEnd)

    // 复制并反向：前半正向，后半镜像
    for (let i = 0; i < halfN; i++) {
      bins[i] = half[i]!
      bins[halfN + i] = half[halfN - 1 - i]!
    }
    // if caller buffer longer than 128, zero the rest
    for (let i = halfN * 2; i < bins.length; i++) bins[i] = 0
    return { bins, bass, mid, energy }
  }

  /** Call from a click/key handler so Chrome will actually start audio. */
  async resumeIfNeeded(): Promise<void> {
    this.ensureGraph()
    if (this.outputMute) return
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
  }

  setMusicGain(v: number): void {
    this.musicGain = Math.max(0, Math.min(1, v))
    this.applyOutputGains()
  }

  getMusicGain(): number {
    return this.musicGain
  }

  setSfxGain(v: number): void {
    this.sfxGain = Math.max(0, Math.min(1, v))
    this.applyOutputGains()
  }

  getSfxGain(): number {
    return this.sfxGain
  }

  /** Mute destination without changing saved music/sfx %. */
  setOutputMute(on: boolean): void {
    if (this.outputMute === on) return
    this.outputMute = on
    this.applyOutputGains()
  }

  isOutputMuted(): boolean {
    return this.outputMute
  }

  /** Freeze AudioContext clock (songTime stops). */
  async pauseAudio(): Promise<void> {
    if (this.ctx?.state === 'running') await this.ctx.suspend()
  }

  async resumeAudio(): Promise<void> {
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
  }

  async loadUrl(url: string): Promise<AudioBuffer> {
    await this.ensure()
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), 45_000)
    let res: Response
    try {
      res = await fetch(url, { signal: ac.signal })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        throw new Error(`audio timeout: ${url}`)
      }
      throw e
    } finally {
      clearTimeout(t)
    }
    if (!res.ok) throw new Error(`audio ${res.status}: ${url}`)
    this.stopSourceOnly()
    const arr = await res.arrayBuffer()
    this.buffer = await this.ctx!.decodeAudioData(arr.slice(0))
    return this.buffer
  }

  get duration(): number {
    return this.buffer?.duration ?? 0
  }

  /** Start music from song offset (seconds). Timing SSOT = AudioContext. Loops until stop. */
  start(bpm: number, offsetSec = 0): void {
    if (!this.ctx || !this.buffer || !this.musicGainNode) return
    this.stopSourceOnly()
    this.bpm = bpm
    const when = this.ctx.currentTime
    this.startAt = when - offsetSec
    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.connectMusicSource(this.source)
    const playOffset = Math.max(0, Math.min(offsetSec, this.buffer.duration - 0.05))
    this.source.loop = true
    this.source.start(when, playOffset)
    this.running = true
    this.looping = true
  }

  /** Fallback metronome-only (no buffer). */
  startSilent(bpm: number): void {
    if (!this.ctx) return
    this.stopSourceOnly()
    this.bpm = bpm
    this.startAt = this.ctx.currentTime
    this.running = true
    this.looping = false
  }

  private stopSourceOnly(): void {
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        /* already stopped */
      }
      this.source.disconnect()
      this.source = null
    }
    this.looping = false
  }

  /** Loop the loaded track without driving songTime (hub / options preview). */
  ensureMenuLoop(): void {
    if (!this.ctx || !this.buffer || !this.musicGainNode) return
    if (this.looping && this.source) return
    this.stopSourceOnly()
    const dur = this.buffer.duration
    const offset = dur > 24 ? Math.min(18, dur * 0.16) : 0
    this.source = this.ctx.createBufferSource()
    this.source.buffer = this.buffer
    this.source.loop = true
    this.connectMusicSource(this.source)
    this.source.start(this.ctx.currentTime, Math.min(offset, Math.max(0, dur - 1)))
    this.looping = true
    this.running = false
  }

  stop(): void {
    this.stopSourceOnly()
    this.running = false
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0
  }

  get beatDuration(): number {
    return 60 / this.bpm
  }

  get songTime(): number {
    if (!this.running || !this.ctx) return 0
    return Math.max(0, this.ctx.currentTime - this.startAt)
  }

  get beatPhase(): number {
    const d = this.beatDuration
    return (this.songTime % d) / d
  }

  errorToNearestBeat(): number {
    return (
      this.songTime -
      Math.round(this.songTime / this.beatDuration) * this.beatDuration
    )
  }

  private tone(opts: ToneOpts): void {
    if (!this.ctx || !this.sfxGainNode) return
    const {
      type = 'sine',
      freq,
      endFreq,
      dur,
      gain = 0.08,
      delay = 0,
      attack = 0.008,
    } = opts
    const peak = Math.min(0.45, gain * SFX_TONE_BOOST)
    const t0 = this.ctx.currentTime + delay + this.playDelay
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, t0)
    if (endFreq != null && endFreq > 0) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur)
    }
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g)
    g.connect(this.sfxGainNode)
    o.start(t0)
    o.stop(t0 + dur + 0.02)
  }

  /** Soft noise-ish burst via detuned saw + filter-ish short life. */
  private thump(freq: number, dur: number, gain: number, delay = 0): void {
    this.tone({ type: 'square', freq, endFreq: freq * 0.45, dur, gain, delay, attack: 0.004 })
    this.tone({
      type: 'triangle',
      freq: freq * 0.5,
      endFreq: freq * 0.25,
      dur: dur * 1.15,
      gain: gain * 0.7,
      delay,
      attack: 0.006,
    })
  }

  async loadVoices(catalogUrl: string): Promise<void> {
    this.ensureGraph()
    await this.voices.load(catalogUrl)
  }

  async loadRadio(catalogUrl: string): Promise<void> {
    this.ensureGraph()
    await this.radio.load(catalogUrl)
  }

  clearVoices(): void {
    void this.voices.load('')
  }

  /** Radio-operator idle mutter. Packs without `idle` stay quiet. */
  tickIdle(dt: number, on: boolean): void {
    this.radio.tickIdle(dt, on && !this.outputMute)
  }

  private pruneLive(now: number): void {
    let w = 0
    for (let i = 0; i < this.live.length; i++) {
      const v = this.live[i]!
      if (v.end > now) this.live[w++] = v
    }
    this.live.length = w
  }

  private kindLive(kind: BeepKind): number {
    let n = 0
    for (const v of this.live) if (v.kind === kind) n++
    return n
  }

  private liveTones(): number {
    let n = 0
    for (const v of this.live) n += v.tones
    return n
  }

  /** Stagger same-kind bursts; drop only when caps / queue window are full. */
  private admit(kind: BeepKind): number | null {
    if (!this.ctx) return null
    const now = this.ctx.currentTime
    this.pruneLive(now)
    const bypass = BYPASS_CAP.has(kind)
    const kindCap = KIND_VOICE_CAP[kind] ?? 3
    if (!bypass && this.kindLive(kind) >= kindCap) return null
    const tones = BEEP_TONES[kind] ?? 2
    if (!bypass) {
      if (this.live.length >= GLOBAL_VOICE_CAP) return null
      if (this.liveTones() + tones > GLOBAL_TONE_CAP) return null
    }
    const gap = BEEP_GAP[kind] ?? 0.04
    const last = this.lastBeepAt.get(kind) ?? -99
    const start = last + gap > now ? last + gap : now
    if (start - now > MAX_STAGGER) return null
    this.lastBeepAt.set(kind, start)
    this.live.push({ kind, end: start + (BEEP_DUR[kind] ?? 0.12), tones })
    return start - now
  }

  beep(kind: BeepKind = 'hit'): void {
    if (this.outputMute) return
    this.ensureGraph()
    if (!this.ctx || !this.sfxGainNode) return
    const delay = this.admit(kind)
    if (delay == null) return
    this.playDelay = delay
    if (this.ctx.state === 'suspended') {
      const d = delay
      void this.ctx.resume().then(() => {
        this.playDelay = d
        this.playBeep(kind)
        this.playDelay = 0
      })
      return
    }
    this.playBeep(kind)
    this.playDelay = 0
  }

  private playBeep(kind: BeepKind): void {
    if (!this.ctx || !this.sfxGainNode) return
    if (kind === 'wave_start' || kind === 'wave_clear' || kind === 'kill_boss' || kind === 'fever') {
      this.radio.tryPlay(kind)
    } else {
      this.voices.tryPlay(kind)
    }
    switch (kind) {
      case 'perfect':
        this.tone({ type: 'triangle', freq: 988, endFreq: 1480, dur: 0.12, gain: 0.1 })
        this.tone({ type: 'sine', freq: 1319, dur: 0.1, gain: 0.05, delay: 0.02 })
        break
      case 'good':
        this.tone({ type: 'sine', freq: 740, endFreq: 880, dur: 0.09, gain: 0.08 })
        break
      case 'miss':
        this.tone({ type: 'sawtooth', freq: 220, endFreq: 90, dur: 0.16, gain: 0.07 })
        break
      case 'hit':
        this.tone({ type: 'triangle', freq: 520, endFreq: 380, dur: 0.05, gain: 0.045 })
        break
      case 'hurt':
        this.thump(160, 0.16, 0.09)
        this.tone({ type: 'sawtooth', freq: 180, endFreq: 70, dur: 0.14, gain: 0.05 })
        break
      case 'death':
        this.tone({ type: 'sawtooth', freq: 220, endFreq: 55, dur: 0.45, gain: 0.1 })
        this.tone({ type: 'square', freq: 110, endFreq: 40, dur: 0.55, gain: 0.07, delay: 0.05 })
        break
      case 'kill':
        this.tone({ type: 'triangle', freq: 660, endFreq: 990, dur: 0.08, gain: 0.06 })
        this.tone({ type: 'sine', freq: 440, dur: 0.06, gain: 0.035, delay: 0.03 })
        break
      case 'kill_elite':
        this.tone({ type: 'triangle', freq: 520, endFreq: 1040, dur: 0.14, gain: 0.09 })
        this.tone({ type: 'sine', freq: 780, endFreq: 1170, dur: 0.12, gain: 0.05, delay: 0.04 })
        break
      case 'kill_boss':
        this.thump(90, 0.28, 0.12)
        this.tone({ type: 'triangle', freq: 392, endFreq: 784, dur: 0.22, gain: 0.1, delay: 0.05 })
        this.tone({ type: 'sine', freq: 523, endFreq: 1046, dur: 0.2, gain: 0.06, delay: 0.12 })
        break
      case 'fever':
        this.tone({ type: 'sine', freq: 523, dur: 0.08, gain: 0.07 })
        this.tone({ type: 'sine', freq: 659, dur: 0.08, gain: 0.07, delay: 0.06 })
        this.tone({ type: 'sine', freq: 784, dur: 0.08, gain: 0.07, delay: 0.12 })
        this.tone({ type: 'triangle', freq: 1046, endFreq: 1568, dur: 0.22, gain: 0.09, delay: 0.18 })
        break
      case 'level_up':
        this.tone({ type: 'sine', freq: 523, dur: 0.09, gain: 0.07 })
        this.tone({ type: 'sine', freq: 659, dur: 0.09, gain: 0.07, delay: 0.07 })
        this.tone({ type: 'sine', freq: 784, dur: 0.12, gain: 0.08, delay: 0.14 })
        this.tone({ type: 'triangle', freq: 1046, dur: 0.16, gain: 0.05, delay: 0.2 })
        break
      case 'pickup_gold':
        this.tone({ type: 'sine', freq: 1175, dur: 0.05, gain: 0.055 })
        this.tone({ type: 'sine', freq: 1568, dur: 0.06, gain: 0.04, delay: 0.04 })
        break
      case 'pickup_relic':
        this.tone({ type: 'triangle', freq: 698, endFreq: 1397, dur: 0.16, gain: 0.08 })
        this.tone({ type: 'sine', freq: 880, dur: 0.12, gain: 0.045, delay: 0.05 })
        break
      case 'offer':
        this.tone({ type: 'sine', freq: 440, dur: 0.07, gain: 0.05 })
        this.tone({ type: 'sine', freq: 554, dur: 0.07, gain: 0.05, delay: 0.06 })
        this.tone({ type: 'sine', freq: 659, dur: 0.1, gain: 0.06, delay: 0.12 })
        break
      case 'upgrade':
        this.tone({ type: 'triangle', freq: 587, endFreq: 880, dur: 0.14, gain: 0.08 })
        this.tone({ type: 'sine', freq: 880, dur: 0.1, gain: 0.05, delay: 0.06 })
        break
      case 'wave_start':
        this.tone({ type: 'square', freq: 196, endFreq: 392, dur: 0.18, gain: 0.06 })
        this.tone({ type: 'sine', freq: 392, endFreq: 523, dur: 0.16, gain: 0.05, delay: 0.08 })
        break
      case 'wave_clear':
        this.tone({ type: 'sine', freq: 523, dur: 0.1, gain: 0.06 })
        this.tone({ type: 'sine', freq: 659, dur: 0.1, gain: 0.06, delay: 0.08 })
        this.tone({ type: 'sine', freq: 784, dur: 0.1, gain: 0.06, delay: 0.16 })
        this.tone({ type: 'triangle', freq: 1046, endFreq: 1319, dur: 0.22, gain: 0.07, delay: 0.24 })
        break
      case 'elite_spawn':
        this.thump(140, 0.2, 0.08)
        this.tone({ type: 'sawtooth', freq: 260, endFreq: 180, dur: 0.18, gain: 0.05, delay: 0.04 })
        break
      case 'boss_spawn':
        this.thump(70, 0.35, 0.12)
        this.tone({ type: 'sawtooth', freq: 110, endFreq: 55, dur: 0.4, gain: 0.08, delay: 0.06 })
        this.tone({ type: 'square', freq: 55, dur: 0.35, gain: 0.05, delay: 0.1 })
        break
      case 'slash':
        this.tone({ type: 'sawtooth', freq: 720, endFreq: 240, dur: 0.07, gain: 0.045, attack: 0.002 })
        break
      case 'orb':
        this.tone({ type: 'sine', freq: 640, endFreq: 420, dur: 0.05, gain: 0.035 })
        break
      case 'aura':
        this.tone({ type: 'triangle', freq: 330, endFreq: 520, dur: 0.12, gain: 0.04 })
        break
      case 'chain':
        this.tone({ type: 'square', freq: 880, endFreq: 440, dur: 0.06, gain: 0.04, attack: 0.002 })
        this.tone({ type: 'square', freq: 660, endFreq: 330, dur: 0.05, gain: 0.03, delay: 0.04 })
        break
      case 'ui':
        this.tone({ type: 'sine', freq: 740, dur: 0.045, gain: 0.055 })
        break
      case 'ui_ok':
        this.tone({ type: 'sine', freq: 660, dur: 0.055, gain: 0.06 })
        this.tone({ type: 'triangle', freq: 990, dur: 0.08, gain: 0.045, delay: 0.035 })
        break
      case 'ui_back':
        this.tone({ type: 'sine', freq: 520, endFreq: 330, dur: 0.07, gain: 0.05 })
        break
      case 'ui_tick':
        this.tone({ type: 'sine', freq: 1046, dur: 0.035, gain: 0.05 })
        break
      case 'combo':
        this.tone({ type: 'sine', freq: 784, dur: 0.06, gain: 0.055 })
        this.tone({ type: 'triangle', freq: 1175, dur: 0.09, gain: 0.05, delay: 0.04 })
        break
      default:
        this.tone({ type: 'sine', freq: 440, dur: 0.07, gain: 0.05 })
    }
  }
}

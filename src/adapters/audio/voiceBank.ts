import type { BeepKind } from '../../domain/shared/ports'

type Catalog = { lines?: Record<string, string[]> }

const BARK: Partial<Record<BeepKind, { chance: number; cool: number }>> = {
  kill: { chance: 0.38, cool: 6.5 },
  kill_elite: { chance: 0.72, cool: 4 },
  kill_boss: { chance: 1, cool: 2.5 },
  fever: { chance: 1, cool: 3 },
  wave_start: { chance: 0.85, cool: 8 },
  wave_clear: { chance: 0.9, cool: 5 },
}

const IDLE_FIRST = 3.2
const IDLE_GAP_MIN = 8
const IDLE_GAP_SPAN = 10
const IDLE_RETRY = 1.8

/** Figure-pack voice barks. Missing catalog / files → silent. */
export class VoiceBank {
  private byKind = new Map<BeepKind, AudioBuffer[]>()
  private idle: AudioBuffer[] = []
  private busyUntil = 0
  private coolUntil = 0
  private cursor = 0
  private idleWait = IDLE_FIRST
  private readonly ctxOf: () => AudioContext | null
  private readonly destOf: () => GainNode | null

  constructor(ctxOf: () => AudioContext | null, destOf: () => GainNode | null) {
    this.ctxOf = ctxOf
    this.destOf = destOf
  }

  async load(catalogUrl: string): Promise<void> {
    this.byKind.clear()
    this.idle = []
    this.idleWait = IDLE_FIRST + Math.random() * 2
    if (!catalogUrl) return
    let json: Catalog
    try {
      const res = await fetch(catalogUrl)
      if (!res.ok) return
      json = (await res.json()) as Catalog
    } catch {
      return
    }
    const lines = json.lines ?? {}
    const base = catalogUrl.replace(/[^/]+$/, '')
    const ctx = this.ctxOf()
    if (!ctx) return
    const cache = new Map<string, AudioBuffer>()
    for (const [kind, files] of Object.entries(lines)) {
      const bufs: AudioBuffer[] = []
      for (const file of files ?? []) {
        const rel = String(file).replace(/\\/g, '/')
        if (!rel) continue
        const url = rel.startsWith('/') ? rel : `${base}${rel}`
        let buf = cache.get(url)
        if (!buf) {
          try {
            const res = await fetch(url)
            if (!res.ok) continue
            buf = await ctx.decodeAudioData((await res.arrayBuffer()).slice(0))
            cache.set(url, buf)
          } catch {
            continue
          }
        }
        bufs.push(buf)
      }
      if (!bufs.length) continue
      if (kind === 'idle') this.idle = bufs
      else this.byKind.set(kind as BeepKind, bufs)
    }
  }

  tryPlay(kind: BeepKind): void {
    const spec = BARK[kind]
    const pool = this.byKind.get(kind)
    if (!spec || !pool?.length) return
    if (Math.random() > spec.chance) return
    if (!this.speak(pool, spec.cool)) return
  }

  /** Ambient mutter. No-op if the pack has no `idle` lines (sisters). */
  tickIdle(dt: number, on: boolean): void {
    if (!on || !this.idle.length) return
    this.idleWait -= dt
    if (this.idleWait > 0) return
    const ok = this.speak(this.idle, IDLE_GAP_MIN)
    this.idleWait = ok ? IDLE_GAP_MIN + Math.random() * IDLE_GAP_SPAN : IDLE_RETRY
  }

  private speak(pool: AudioBuffer[], cool: number): boolean {
    const ctx = this.ctxOf()
    const dest = this.destOf()
    if (!ctx || !dest) return false
    const now = ctx.currentTime
    if (now < this.busyUntil || now < this.coolUntil) return false
    const buf = pool[this.cursor % pool.length]!
    this.cursor += 1
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(dest)
    src.start(now)
    this.busyUntil = now + buf.duration
    this.coolUntil = now + cool
    return true
  }
}

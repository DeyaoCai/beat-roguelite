import { AudioClock } from '../adapters/audio/clock'
import { createInput } from '../adapters/input/keys'
import { createThreeOrthoRenderer } from '../presentation/render/threeOrtho'
import { emptySnapshot, worldToSnapshot } from '../presentation/render/snapshot'
import type { FrameSnapshot, PrepFocus, Renderer, SceneKind } from '../presentation/render/types'
import {
  applyBeatResult,
  applyUpgradeToWorld,
  chooseUpgrade,
  createWorld,
  isFeverActive,
  pickWeather,
  tickWorld,
  resolveWaveDurationSec,
  STANDARD_WAVES,
  isLastStandardWave,
  type World,
  type RunMode,
} from '../domain/combat'
import { drainOfferQueue, settleRunGold, metaLoadoutMods, ensureDuoLearn, cycleDuoLearn, duoLearnLabel, starterForLearn, toggleContract, contractBankMul } from '../domain/progression'
import type { OwnedUpgrade, MetaLoadoutMods, UpgradeId } from '../domain/progression'
import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from '../content/characters'
import { KITS } from '../content/kits'
import { DEFAULT_WEAPON, STARTERS, starterLabel, type WeaponId, type StarterId } from '../content/weapons'
import { weatherById } from '../content/weather'
import { hubItemsFor } from '../content/hub'
import { cycleHubTheme, hubThemeById, type HubThemeId } from '../content/hubThemes'
import { loadSettings, saveSettings } from '../content/settingsStore'
import { loadPrep, savePrep } from '../content/prepStore'
import {
  SHOP_GOODS,
  CONTRACTS,
  blessingLabel,
  type BlessingId,
  type ContractId,
} from '../content/meta'
import { loadMeta, addPurse, tryBuy, shopStatus } from '../content/metaStore'
import {
  DEFAULT_TRACK_ID,
  TRACKS,
  loadMusicMeta,
  publicUrl,
  resUrl,
  type TrackDef,
} from '../content/tracks'
import {
  LANE_LABELS,
  chartFromRhythmPoints,
  chartTime,
  createRhythmRuntime,
  hitLane,
  tickFeverAutoHits,
  tickRhythmFlash,
  tickRhythmLoop,
  tickRhythmMisses,
  visibleHighwayNotes,
  type RhythmBandFile,
  type RhythmRuntime,
} from '../domain/rhythm'
import { loadOsz } from '../adapters/chart/oszLoad'
import { createTunePanel } from '../presentation/ui/tunePanel'
import { createWardrobe } from '../wardrobe'
import { drainEvents } from '../domain/shared/events'
import { loadFigureManifest, resolveActiveFigureId, resolveFigureRel } from '../figures'

export type BootOptions = {
  createRenderer?: (host: HTMLElement, ctx?: { figureId: string }) => Renderer
  characterId?: CharacterId
  weaponId?: WeaponId
  trackId?: string
  figureId?: string
}

export async function boot(app: HTMLElement, opts: BootOptions = {}): Promise<() => void> {
  app.innerHTML = ''
  app.style.width = '100%'
  app.style.height = '100%'
  app.style.position = 'relative'

  const figureId = opts.figureId ?? (await resolveActiveFigureId())
  const makeRenderer = opts.createRenderer ?? createThreeOrthoRenderer
  const renderer = makeRenderer(app, { figureId })
  renderer.resize()
  const hubList = () => hubItemsFor({ wardrobe: renderer.heroCaps?.wardrobe === true })
  const onResize = () => renderer.resize()
  window.addEventListener('resize', onResize)

  const input = createInput()
  const clock = new AudioClock()
  const bootSettings = loadSettings()
  clock.setMusicGain(bootSettings.musicGain)
  clock.setSfxGain(bootSettings.sfxGain)
  void (async () => {
    const man = await loadFigureManifest({
      id: figureId,
      caption: '',
      body: '',
      height: 1.7,
      gaits: {},
      capabilities: { wardrobe: false, poses: false, jiggle: false },
    })
    if (man.voices) await clock.loadVoices(resolveFigureRel(figureId, man.voices))
  })()
  const characterId = opts.characterId ?? DEFAULT_CHARACTER
  const weaponId = opts.weaponId ?? DEFAULT_WEAPON
  let starterId: StarterId = KITS[CHARACTERS[characterId].kitId].defaultStarter

  let trackIndex = Math.max(
    0,
    TRACKS.findIndex((t) => t.id === (opts.trackId ?? DEFAULT_TRACK_ID)),
  )
  let track: TrackDef = TRACKS[trackIndex]!
  let trackTitle = track.title
  let trackReady = false
  let trackError = ''
  let rhythm: RhythmRuntime | null = null
  let chartBpm = 120
  let audioBlobUrl: string | null = null

  let scene: SceneKind = 'title'
  let world: World | null = null
  let upgrades: OwnedUpgrade[] = []
  let runScore = 0
  let runKills = 0
  let seed = Date.now() % 1_000_000
  let pendingKey: string | null = null
  let pendingCode: string | null = null
  let loading = false
  let paused = false
  let hubIndex = 0
  let hubThemeId: HubThemeId = bootSettings.hubThemeId
  let optionsRow = 0
  let shopIndex = 0
  let prepFocus: PrepFocus = 'mode'
  let prepContractIndex = 0
  let blessingId: BlessingId | null = null
  let duoLearnId: UpgradeId = 'learn_orb'
  let contractIds: ContractId[] = []
  let runMeta: MetaLoadoutMods | null = null
  let startGold = 0
  let lastBanked = 0
  let clearSettled = false
  let runMode: RunMode = 'standard'

  const persistPrep = () => {
    savePrep({
      trackId: track.id,
      starterId,
      blessingId,
      duoLearnId,
      contractIds,
      runMode,
    })
  }
  const savedPrep = loadPrep()
  if (savedPrep) {
    starterId = savedPrep.starterId
    if (!opts.trackId) {
      const i = TRACKS.findIndex((t) => t.id === savedPrep.trackId)
      if (i >= 0) {
        trackIndex = i
        track = TRACKS[trackIndex]!
        trackTitle = track.title
      }
    }
    const unlocked = loadMeta().blessings
    blessingId =
      savedPrep.blessingId && unlocked.includes(savedPrep.blessingId) ? savedPrep.blessingId : null
    duoLearnId = ensureDuoLearn(starterId, savedPrep.duoLearnId as UpgradeId)
    contractIds = [...savedPrep.contractIds]
    runMode = savedPrep.runMode
  }

  let fadeBlack = 0
  let fadeTx: null | {
    phase: 'out' | 'in'
    t: number
    action: 'wave' | 'result'
    nextWave?: number
    won?: boolean
  } = null
  const FADE_OUT_SEC = 0.4
  const FADE_IN_SEC = 0.55

  const beginFadeToWave = (next: number) => {
    if (fadeTx) return
    fadeTx = { phase: 'out', t: 0, action: 'wave', nextWave: next }
  }
  const beginFadeToResult = (won: boolean) => {
    if (fadeTx) return
    fadeTx = { phase: 'out', t: 0, action: 'result', won }
  }

  const applyMusicGain = (g: number) => {
    clock.setMusicGain(g)
    saveSettings({ musicGain: clock.getMusicGain() })
  }
  const applySfxGain = (g: number) => {
    clock.setSfxGain(g)
    saveSettings({ sfxGain: clock.getSfxGain() })
  }
  const applyHubTheme = (id: HubThemeId) => {
    hubThemeId = id
    saveSettings({ hubThemeId })
  }
  const stepHubTheme = (dir: 1 | -1) => {
    applyHubTheme(cycleHubTheme(hubThemeId, dir))
    clock.beep('ui')
  }
  const enterHubItem = (i: number) => {
    const items = hubList()
    const it = items[i]
    if (!it) return
    if (it.scene === 'closet' && !closet) {
      clock.beep('ui_back')
      return
    }
    hubIndex = i
    scene = it.scene
    if (it.scene === 'prep') {
      seed = Date.now() % 1_000_000
      prepFocus = 'mode'
    }
    if (it.scene === 'shop') shopIndex = 0
    clock.beep('ui_ok')
  }
  const setStarter = (id: StarterId) => {
    starterId = id
    duoLearnId = ensureDuoLearn(starterId, duoLearnId)
    persistPrep()
    clock.beep('ui')
  }

  const setPaused = (v: boolean) => {
    if (scene !== 'play' || !world) return
    paused = v
    tune.setOpen(v)
    if (v) {
      tune.syncFromWorld(world)
      void clock.pauseAudio()
    } else {
      void clock.resumeAudio()
    }
  }

  const tune = createTunePanel(app, {
    onResume: () => setPaused(false),
    onMusicGain: (g) => applyMusicGain(g),
    getMusicGain: () => clock.getMusicGain(),
    onSfxGain: (g) => applySfxGain(g),
    getSfxGain: () => clock.getSfxGain(),
  })
  const closet = renderer.wardrobe
    ? createWardrobe(app, renderer.wardrobe)
    : null

  const onKey = (e: KeyboardEvent) => {
    void clock.resumeIfNeeded()
    if (e.key === 'Escape' && (scene === 'prep' || scene === 'closet' || scene === 'options' || scene === 'shop')) {
      e.preventDefault()
      scene = 'title'
      clock.beep('ui_back')
      return
    }
    if (e.key === 'Tab' && scene === 'prep') {
      e.preventDefault()
    }
    if (
      (scene === 'title' || scene === 'options' || scene === 'shop' || scene === 'prep') &&
      (e.key === 'ArrowUp' ||
        e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'w' ||
        e.key === 'W' ||
        e.key === 'a' ||
        e.key === 'A' ||
        e.key === 's' ||
        e.key === 'S' ||
        e.key === 'd' ||
        e.key === 'D')
    ) {
      e.preventDefault()
    }
    if (e.key === 'Escape' && scene === 'play' && world) {
      e.preventDefault()
      setPaused(!paused)
      return
    }
    if (paused) return
    pendingKey = e.key
    pendingCode = e.code
  }
  window.addEventListener('keydown', onKey)

  function pickIndexFromInput(key: string, code: string | null): number {
    const map: [string, string, string][] = [
      ['Numpad1', 'Digit1', '1'],
      ['Numpad2', 'Digit2', '2'],
      ['Numpad3', 'Digit3', '3'],
      ['Numpad4', 'Digit4', '4'],
      ['Numpad5', 'Digit5', '5'],
      ['Numpad6', 'Digit6', '6'],
    ]
    for (let i = 0; i < map.length; i++) {
      const [np, dg, ch] = map[i]!
      if (code === np || code === dg || key === ch) return i
    }
    return -1
  }

  function applySideChoice(w: World, idx: number): void {
    if (!w.offer || idx < 0 || idx >= w.offer.length) return
    const reason = w.pickReason
    const picked = w.offer[idx]!
    const fromLevel = reason === 'level'
    applyUpgradeToWorld(w, picked, { consumeLevel: fromLevel })
    upgrades = [...w.upgrades]
    w.offer = null
    w.pickReason = null
    w.player.invuln = Math.max(w.player.invuln, 0.45)
    w.stats.levelFlashT = Math.max(w.stats.levelFlashT, 0.55)
    clock.beep('upgrade')
    // Relic queue first, then leftover level-ups.
    drainOfferQueue(w)
  }

  function revokeAudioBlob() {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl)
      audioBlobUrl = null
    }
  }

  async function prepareTrack(t: TrackDef): Promise<void> {
    loading = true
    trackError = ''
    trackTitle = t.title
    try {
      await clock.ensure()
      revokeAudioBlob()

      if (t.source === 'osz') {
        if (!t.oszPath) throw new Error('osz track missing oszPath')
        const pack = await loadOsz(publicUrl(t.oszPath), {
          preferVersion: t.oszPrefer,
          signal: AbortSignal.timeout(60_000),
        })
        audioBlobUrl = pack.audioUrl
        trackTitle = `${pack.title} [${pack.version}]`
        chartBpm = pack.bpm
        await clock.loadUrl(pack.audioUrl)
        rhythm = createRhythmRuntime(pack.notes, 1.65)
        trackReady = true
        console.info(
          `[osz] ${pack.artist} - ${pack.title} [${pack.version}]`,
          `${pack.notes.length} notes`,
          `bpm≈${pack.bpm.toFixed(1)}`,
          `diffs=${pack.versions.join(', ')}`,
        )
        return
      }

      const { meta, audioUrl } = await loadMusicMeta(t)
      trackTitle = meta.name || t.title
      await clock.loadUrl(audioUrl)
      if (!t.rhythmJson) throw new Error('resource track missing rhythmJson')
      const rpRes = await fetch(resUrl(t.rhythmJson), {
        signal: AbortSignal.timeout(12_000),
      })
      if (!rpRes.ok) throw new Error(`rhythm ${rpRes.status}`)
      const bands = (await rpRes.json()) as RhythmBandFile
      const endSec = clock.duration > 0 ? clock.duration : 90
      const notes = chartFromRhythmPoints(bands, {
        minGap: 0.5,
        maxNotes: Math.min(400, Math.ceil(endSec * 3)),
        endSec,
      })
      chartBpm = 110
      rhythm = createRhythmRuntime(notes, 1.65)
      trackReady = true
    } catch (e) {
      trackReady = false
      trackError = e instanceof Error ? e.message : String(e)
      rhythm = null
      console.error('[track]', e)
    } finally {
      loading = false
      if (
        trackReady &&
        (scene === 'title' ||
          scene === 'closet' ||
          scene === 'options' ||
          scene === 'shop' ||
          scene === 'prep' ||
          scene === 'result')
      ) {
        clock.ensureMenuLoop()
      }
    }
  }

  void prepareTrack(track)

  async function startRun(): Promise<void> {
    if (loading) return
    if (!trackReady) {
      await prepareTrack(track)
      if (!trackReady) return
    }
    await clock.ensure()
    await clock.resumeIfNeeded()
    const persist = loadMeta()
    runMeta = metaLoadoutMods(
      persist.startHp,
      persist.startLuck,
      blessingId,
      contractIds,
      persist.startSpeed,
      persist.startHeat,
      persist.startRadius,
    )
    startGold = 0
    duoLearnId = ensureDuoLearn(starterId, duoLearnId)
    upgrades =
      blessingId === 'duo' ? [{ id: duoLearnId, grade: 1 }] : []
    runScore = 0
    runKills = 0
    startWave(1)
  }

  function startWave(wave: number): void {
    const prev = world
    const waveDuration = resolveWaveDurationSec(clock.duration)
    world = createWorld({
      wave,
      upgrades,
      seed,
      characterId,
      weaponId,
      starterId,
      waveDuration,
      runMeta,
      startGold,
      runMode,
      progress: prev
        ? {
            level: prev.stats.level,
            xp: prev.stats.xp,
            xpToNext: prev.stats.xpToNext,
            maxCombo: prev.stats.maxCombo,
            gold: prev.stats.gold,
          }
        : undefined,
    })
    // restart chart from t=0 each wave for now; music also restarts
    if (rhythm) {
      rhythm = createRhythmRuntime(
        rhythm.notes.map((n) => ({
          ...n,
          judged: false,
          result: null,
        })),
      )
    }
    const bpm = chartBpm + (wave - 1) * 2
    if (trackReady) clock.start(bpm, 0)
    else clock.startSilent(bpm)
    clock.beep('wave_start')
    scene = 'play'
    paused = false
    clearSettled = false
    tune.setOpen(false)
  }

  function highwaySnap(): FrameSnapshot['highway'] {
    const dur = clock.duration || 1
    const t = chartTime(clock.songTime, clock.duration)
    const notes =
      scene === 'play' && rhythm
        ? visibleHighwayNotes(rhythm, t)
        : []
    return {
      visible: scene === 'play' && !!rhythm && !world?.loadout.muteBeat,
      labels: [...LANE_LABELS],
      notes,
      songTitle: trackTitle,
      songProgress: Math.min(1, t / dur),
      judgePulse: rhythm ? Math.min(1, rhythm.flashT / 0.35) : 0,
      judgeResult: rhythm?.lastFlash ?? null,
      judgeLane: rhythm?.lastLane ?? -1,
      judgeSeq: rhythm?.flashSeq ?? 0,
      timingHint: world?.stats.timingHintT ? world.stats.timingHint : null,
    }
  }

  function stampMeta(s: FrameSnapshot): FrameSnapshot {
    const meta = loadMeta()
    s.purse = meta.purse
    s.blessingName = blessingLabel(blessingId)
    s.contractRows = CONTRACTS.map((c) => ({
      key: c.key,
      name: c.name,
      blurb: c.blurb,
      on: contractIds.includes(c.id),
      bankMul: c.bankMul,
    }))
    s.contractMul = contractBankMul(contractIds)
    s.feverMute = contractIds.includes('mute')
    s.beatMute = contractIds.includes('still')
    s.runMode = runMode
    const theme = hubThemeById(hubThemeId)
    s.hubThemeId = theme.id
    s.hubThemeName = theme.name
    s.hubThemeBlurb = theme.blurb
    const w1 = weatherById(pickWeather(seed, 1))
    s.weatherName = w1.name
    s.weatherBlurb = w1.blurb
    s.shopRows = SHOP_GOODS.map((g) => {
      const status = shopStatus(meta, g.id)
      let blurb = g.blurb
      if (g.id === 'hp') blurb = `${g.blurb} · 已 ${meta.startHp}/3`
      else if (g.id === 'luck') blurb = `${g.blurb} · 已 ${meta.startLuck}/3`
      else if (g.id === 'speed') blurb = `${g.blurb} · 已 ${meta.startSpeed}/3`
      else if (g.id === 'heat') blurb = `${g.blurb} · 已 ${meta.startHeat}/3`
      else if (g.id === 'radius') blurb = `${g.blurb} · 已 ${meta.startRadius}/3`
      return {
        name: g.name,
        blurb,
        price: g.price,
        status,
      }
    })
    const a = clock.sampleMusicSpectrum()
    s.audioSpectrum = a.bins
    s.audioBass = a.bass
    s.audioMid = a.mid
    s.audioEnergy = a.energy
    s.beatPhase = clock.beatPhase || s.beatPhase
    return s
  }

  function goResult(won: boolean): void {
    const g = world?.stats.gold ?? 0
    lastBanked = settleRunGold(g, won, blessingId, contractIds)
    addPurse(lastBanked)
    scene = 'result'
    paused = false
    tune.setOpen(false)
    clock.stop()
  }

  function navDir(k: string): { row: -1 | 0 | 1; col: -1 | 0 | 1 } {
    const x = k.length === 1 ? k.toLowerCase() : k
    if (x === 'w' || k === 'ArrowUp') return { row: -1, col: 0 }
    if (x === 's' || k === 'ArrowDown') return { row: 1, col: 0 }
    if (x === 'a' || k === 'ArrowLeft') return { row: 0, col: -1 }
    if (x === 'd' || k === 'ArrowRight') return { row: 0, col: 1 }
    return { row: 0, col: 0 }
  }

  function prepRows(): PrepFocus[] {
    return ['mode', 'track', 'starter', 'blessing', 'contract', 'go']
  }

  function movePrepRow(dir: -1 | 1): void {
    const rows = prepRows()
    const i = Math.max(0, rows.indexOf(prepFocus))
    prepFocus = rows[(i + dir + rows.length) % rows.length]!
    clock.beep('ui')
  }

  function stepTrack(dir: -1 | 1): void {
    trackIndex = (trackIndex + dir + TRACKS.length) % TRACKS.length
    track = TRACKS[trackIndex]!
    persistPrep()
    void prepareTrack(track)
    clock.beep('ui')
  }

  function stepDuo(dir: 1 | -1): void {
    if (blessingId !== 'duo') {
      clock.beep('ui_back')
      return
    }
    duoLearnId = cycleDuoLearn(starterId, duoLearnId, dir)
    persistPrep()
    clock.beep('ui')
  }

  function stepStarter(dir: -1 | 1): void {
    const i = STARTERS.findIndex((s) => s.id === starterId)
    const from = i < 0 ? 0 : i
    setStarter(STARTERS[(from + dir + STARTERS.length) % STARTERS.length]!.id)
  }

  function cycleBlessing(dir: 1 | -1): void {
    const unlocked = loadMeta().blessings
    if (unlocked.length === 0) {
      clock.beep('ui_back')
      return
    }
    const ids: (BlessingId | null)[] = [null, ...unlocked]
    const cur = ids.indexOf(blessingId)
    const i = cur < 0 ? 0 : (cur + dir + ids.length) % ids.length
    blessingId = ids[i]!
    if (blessingId === 'duo') duoLearnId = ensureDuoLearn(starterId, duoLearnId)
    persistPrep()
    clock.beep('ui')
  }

  function snapshot(): FrameSnapshot {
    if (scene === 'title') {
      const s = emptySnapshot('title')
      s.hubIndex = hubIndex
      s.hubRows = hubList().map(({ name, blurb }) => ({ name, blurb }))
      s.musicGain = clock.getMusicGain()
      s.sfxGain = clock.getSfxGain()
      return stampMeta(s)
    }
    if (scene === 'closet') {
      return stampMeta(emptySnapshot('closet'))
    }
    if (scene === 'options') {
      const s = emptySnapshot('options')
      s.optionsRow = optionsRow
      s.musicGain = clock.getMusicGain()
      s.sfxGain = clock.getSfxGain()
      return stampMeta(s)
    }
    if (scene === 'shop') {
      const s = emptySnapshot('shop')
      s.shopIndex = shopIndex
      return stampMeta(s)
    }
    if (scene === 'prep') {
      const s = emptySnapshot('prep')
      s.highway = {
        ...s.highway,
        songTitle: loading
          ? `加载中… ${trackTitle}`
          : trackError
            ? `加载失败: ${trackError}`
            : `${track.artist} - ${trackTitle}`,
      }
      s.starterId = starterId
      s.starterName = starterLabel(starterId)
      s.duoLearnName = blessingId === 'duo' ? duoLearnLabel(duoLearnId) : ''
      s.duoStarterId = blessingId === 'duo' ? (starterForLearn(duoLearnId) ?? '') : ''
      s.prepFocus = prepFocus
      s.prepContractIndex = prepContractIndex
      s.hint = trackReady
        ? track.source === 'osz'
          ? '本地 osz'
          : '资源仓曲'
        : trackError || '正在加载曲目…'
      return stampMeta(s)
    }
    if (scene === 'result') {
      return stampMeta({
        ...emptySnapshot('result'),
        fadeBlack,
        result: {
          won:
            !world?.dead &&
            (world?.runMode ?? runMode) === 'standard' &&
            (world?.stats.wave ?? 0) >= STANDARD_WAVES &&
            !!world?.cleared,
          score: runScore,
          kills: runKills,
          maxCombo: world?.stats.maxCombo ?? 0,
          banked: lastBanked,
          waves: world?.stats.wave ?? 0,
        },
      })
    }
    if (!world) {
      const s = emptySnapshot('title')
      s.fadeBlack = fadeBlack
      return stampMeta(s)
    }
    const base = worldToSnapshot(
      scene,
      world,
      clock,
      runScore,
      world.cleared && world.pickReason === 'wave'
        ? '关卡完成 · 选择强化进入下一波 · 1 / 2 / 3'
        :       world.offer &&
            (world.pickReason === 'level' ||
              world.pickReason === 'drop_minor' ||
              world.pickReason === 'drop_major' ||
              world.pickReason === 'chest')
          ? world.pickReason === 'drop_major'
            ? 'Boss 掉落 · 遗物 · 小键盘 1/2/3'
            : world.pickReason === 'drop_minor'
              ? '精英掉落 · 遗物 · 小键盘 1/2/3'
              : world.pickReason === 'chest'
                ? '宝箱 · 三选一 · 小键盘 1/2/3'
              : '升级 · 小强化 · 小键盘 1/2/3'
            : paused
            ? '已暂停 · Esc 继续'
            : world.loadout.muteBeat
              ? world.loadout.muteFever
                ? 'WASD 走位 · Shift 闪避 · 素打 · Fever 锁'
                : 'WASD 走位 · Shift 闪避 · 素打 · F 放 Fever'
              : world.loadout.muteFever
              ? 'J/K/L 打谱 · WASD 走位 · Shift 闪避 · Fever 锁'
              : world.stats.heat >= world.loadout.heatCfg.max * 0.98 &&
                  world.stats.feverActiveT <= 0 &&
                  world.stats.feverCooldownT <= 0
                ? '热度已满 · 按 F 放 Fever'
                : 'J/K/L 打谱 · WASD 走位 · F 放 Fever · Shift 闪',
      highwaySnap(),
      runKills,
    )
    base.fadeBlack = fadeBlack
    return base
  }

  let last = performance.now()
  let raf = 0

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    if (pendingKey && !paused && !fadeTx) {
      const k = pendingKey
      const code = pendingCode
      pendingKey = null
      pendingCode = null
      if (scene === 'title') {
        const n = hubList().length
        const d = navDir(k)
        if (d.row && n > 0) {
          hubIndex = (hubIndex + d.row + n) % n
          clock.beep('ui')
        } else if (d.col) {
          stepHubTheme(d.col > 0 ? 1 : -1)
        } else if (k === 'Enter' || k === ' ') {
          enterHubItem(hubIndex)
        }
      } else if (scene === 'shop') {
        const n = SHOP_GOODS.length
        const d = navDir(k)
        if (d.row && n > 0) {
          shopIndex = (shopIndex + d.row + n) % n
          clock.beep('ui')
        } else if ((k === 'Enter' || k === ' ') && n > 0) {
          const id = SHOP_GOODS[shopIndex]!.id
          const r = tryBuy(id)
          clock.beep(r.ok ? 'ui_ok' : 'ui_back')
        }
      } else if (scene === 'options') {
        const d = navDir(k)
        const optionCount = 3
        if (d.row) {
          const next = (optionsRow + d.row + optionCount) % optionCount
          if (optionsRow !== next) {
            optionsRow = next
            clock.beep('ui')
          }
        } else if (d.col) {
          if (optionsRow === 0) {
            applyMusicGain(clock.getMusicGain() + 0.05 * d.col)
            clock.beep('ui_tick')
          } else if (optionsRow === 1) {
            applySfxGain(clock.getSfxGain() + 0.05 * d.col)
            clock.beep('ui_tick')
          } else {
            stepHubTheme(d.col > 0 ? 1 : -1)
          }
        }
      } else if (scene === 'prep') {
        if (k === 'q' || k === 'Q') {
          stepDuo(-1)
        } else if (k === 'e' || k === 'E') {
          stepDuo(1)
        } else {
        const d = navDir(k)
        if (d.row) {
          movePrepRow(d.row)
        } else if (d.col) {
          const col = d.col > 0 ? 1 : -1
          if (prepFocus === 'mode') {
            runMode = runMode === 'standard' ? 'endless' : 'standard'
            persistPrep()
            clock.beep('ui')
          } else if (prepFocus === 'track') {
            stepTrack(col)
          } else if (prepFocus === 'starter') {
            stepStarter(col)
          } else if (prepFocus === 'blessing') {
            cycleBlessing(col)
          } else if (prepFocus === 'contract') {
            const n = CONTRACTS.length
            if (n > 0) {
              prepContractIndex = (prepContractIndex + col + n) % n
              clock.beep('ui')
            }
          }
        } else if (k === 'Enter' || k === ' ') {
          if (prepFocus === 'mode') {
            runMode = runMode === 'standard' ? 'endless' : 'standard'
            persistPrep()
            clock.beep('ui')
          } else if (prepFocus === 'blessing') {
            cycleBlessing(1)
          } else if (prepFocus === 'contract') {
            const cid = CONTRACTS[prepContractIndex]?.id
            if (cid) {
              const r = toggleContract(contractIds, cid)
              contractIds = r.next
              persistPrep()
              clock.beep(r.ok ? 'ui' : 'ui_back')
            }
          } else if (prepFocus === 'go' && !loading) {
            clock.beep('ui_ok')
            void startRun()
          }
        }
        }
      } else if (scene === 'result' && (k === 'Enter' || k === ' ')) {
        clock.beep('ui_ok')
        scene = 'title'
        world = null
        clock.stop()
      } else if (scene === 'play' && world?.offer) {
        const idx = pickIndexFromInput(k, code)
        if (idx >= 0 && idx < world.offer.length) {
          if (world.pickReason === 'wave') {
            const picked = world.offer[idx]!
            upgrades = chooseUpgrade(world, picked)
            world.offer = null
            world.pickReason = null
            clock.beep('upgrade')
            const next = world.stats.wave + 1
            if (world.runMode === 'standard' && next > STANDARD_WAVES) beginFadeToResult(true)
            else beginFadeToWave(next)
          } else if (
            world.pickReason === 'level' ||
            world.pickReason === 'drop_minor' ||
            world.pickReason === 'drop_major' ||
            world.pickReason === 'chest'
          ) {
            applySideChoice(world, idx)
          }
        }
      }
    } else {
      pendingKey = null
      pendingCode = null
    }

    if (fadeTx) {
      fadeTx.t += dt
      if (fadeTx.phase === 'out') {
        fadeBlack = Math.min(1, fadeTx.t / FADE_OUT_SEC)
        if (fadeTx.t >= FADE_OUT_SEC) {
          if (fadeTx.action === 'wave' && fadeTx.nextWave) {
            startWave(fadeTx.nextWave)
          } else if (fadeTx.action === 'result') {
            goResult(!!fadeTx.won)
          }
          fadeTx = { phase: 'in', t: 0, action: fadeTx.action }
          fadeBlack = 1
        }
      } else {
        fadeBlack = Math.max(0, 1 - fadeTx.t / FADE_IN_SEC)
        if (fadeTx.t >= FADE_IN_SEC) {
          fadeTx = null
          fadeBlack = 0
        }
      }
    }

    if (scene === 'play' && world && !paused) {
      tickWorld(world, dt, input.keys, clock)
      for (const ev of drainEvents(world.domainEvents)) {
        if (ev.type === 'LevelUpPending') clock.beep('level_up')
      }

      if (rhythm && !world.cleared && !world.loadout.muteBeat) {
        const period = clock.duration
        tickRhythmLoop(rhythm, clock.songTime, period)
        const t = chartTime(clock.songTime, period)
        const feverOn = isFeverActive(world)
        const judgeWin = {
          perfect: world.loadout.judgePerfectWin,
          good: world.loadout.judgeGoodWin,
        }
        if (feverOn) {
          for (const hit of tickFeverAutoHits(rhythm, t, judgeWin)) {
            applyBeatResult(world, clock, hit.result, hit.errorSec)
          }
        } else if (input.keys.lanePressed[0]) {
          const hit = hitLane(rhythm, 0, t, judgeWin)
          if (hit) applyBeatResult(world, clock, hit.result, hit.errorSec)
        }
        if (!feverOn) {
          const missEvents = tickRhythmMisses(rhythm, t, judgeWin)
          if (missEvents.length > 0) {
            applyBeatResult(world, clock, 'miss')
          }
        }
        if (feverOn && input.keys.lanePressed[0]) {
          const hit = hitLane(rhythm, 0, t, judgeWin)
          if (hit) applyBeatResult(world, clock, hit.result, hit.errorSec)
        }
        tickRhythmFlash(rhythm, dt)
        if (rhythm.flashT > 0) {
          world.stats.beatFlash = rhythm.lastFlash
          world.stats.beatFlashT = rhythm.flashT
        }
      }

      if (world.dead) {
        runScore += world.stats.score
        runKills += world.stats.kills
        goResult(false)
      } else if (
        !world.cleared &&
        !world.offer &&
        (world.stats.pendingLevelUps > 0 || world.offerQueue.length > 0)
      ) {
        if (drainOfferQueue(world)) clock.beep('offer')
      } else if (world.cleared) {
        if (!clearSettled) {
          clearSettled = true
          runScore += world.stats.score
          runKills += world.stats.kills
          world.stats.score = 0
          world.stats.kills = 0
          paused = false
          tune.setOpen(false)
          if (isLastStandardWave(world.runMode, world.stats.wave)) {
            beginFadeToResult(true)
          }
          // else stay on play with wave offer — arena keeps moving
        }
      }
    }

    if (
      (scene === 'title' ||
        scene === 'closet' ||
        scene === 'options' ||
        scene === 'shop' ||
        scene === 'prep' ||
        scene === 'result' ||
        scene === 'pick') &&
      trackReady &&
      !loading
    ) {
      clock.ensureMenuLoop()
    }

    closet?.setVisible(scene === 'closet')
    renderer.draw(snapshot())
    input.endFrame()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKey)
    input.dispose()
    tune.dispose()
    closet?.dispose()
    clock.stop()
    revokeAudioBlob()
  }
}

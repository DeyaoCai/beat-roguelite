import { AudioClock } from '../adapters/audio/clock'
import { createInput } from '../adapters/input/keys'
import { createThreeOrthoRenderer } from '../presentation/render/threeOrtho'
import type { PrepFocus, Renderer, SceneKind } from '../presentation/render/types'
import { createWorld, pushHint, resolveWaveDurationSec } from '../domain/combat'
import {
  settleRunGold,
  metaLoadoutMods,
  ensureDuoLearn,
  startFuseNeed,
  ensureStartFuses,
  duoFuseUpgradeId,
  makeOwned,
  rollStartStat,
} from '../domain/progression'
import type { OwnedUpgrade } from '../domain/progression'
import { CHARACTERS, DEFAULT_CHARACTER, type CharacterId } from '../content/characters'
import { codexAt, wrapCodexIndex, codexPreviewOf } from '../content/codex'
import { KITS } from '../content/kits'
import { DEFAULT_WEAPON, type WeaponId } from '../content/weapons'
import { hubItemsFor } from '../content/hub'
import { cycleHubTheme, type HubThemeId } from '../content/hubThemes'
import { loadSettings, saveSettings } from '../content/settingsStore'
import { addPurse, loadMeta } from '../content/metaStore'
import {
  DEFAULT_TRACK_ID,
  defaultTrack,
  listTracks,
  loadMusicMeta,
  metaDurationSec,
  resUrl,
  type TrackDef,
} from '../content/tracks'
import { isRhythmEnabled } from '../lib/rhythmEnabled'
import {
  chartFromRhythmPoints,
  createRhythmRuntime,
  type RhythmBandFile,
} from '../domain/rhythm'
import { loadOsz } from '../adapters/chart/oszLoad'
import { createTunePanel } from '../presentation/ui/tunePanel'
import { createWardrobe } from '../wardrobe'
import { mulberry32 } from '../domain/combat/math'
import {
  loadFigureManifest,
  resolveActiveFigureId,
  resolveVoicesCatalogUrl,
  cycleHubFigure,
  SKYRIM_FEMALE_ID,
} from '../figures'
import { loadFigureId, saveFigureId } from '../content/figureStore'
import {
  buildSnapshot,
  clampFusePicks,
  consumePendingKey,
  createSessionState,
  hydratePrep,
  loadPrep,
  tickFade,
  tickPlayFrame,
  writePrep,
  abandonRun,
  type SessionIO,
} from './session'

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

  const persistedFigure = loadFigureId()
  const figureIdBoot = opts.figureId ?? (await resolveActiveFigureId(persistedFigure))
  if (!opts.figureId && persistedFigure && persistedFigure !== figureIdBoot) {
    saveFigureId(figureIdBoot)
  }
  const makeRenderer = opts.createRenderer ?? createThreeOrthoRenderer
  const renderer = makeRenderer(app, { figureId: figureIdBoot })
  renderer.resize()
  const hubList = () => hubItemsFor({ wardrobe: renderer.heroCaps?.wardrobe === true })
  const onResize = () => renderer.resize()
  window.addEventListener('resize', onResize)

  const input = createInput()
  const clock = new AudioClock()
  const bootSettings = loadSettings()
  clock.setMusicGain(bootSettings.musicGain)
  clock.setSfxGain(bootSettings.sfxGain)
  const stubManifest = (id: string) => ({
    id,
    caption: '',
    body: '',
    height: 1.7,
    gaits: {},
    capabilities: { wardrobe: false, poses: false, jiggle: false },
  })
  void (async () => {
    const man = await loadFigureManifest(stubManifest(figureIdBoot))
    if (man.voices && figureIdBoot !== SKYRIM_FEMALE_ID) {
      const url = await resolveVoicesCatalogUrl(figureIdBoot, man.voices)
      if (url) await clock.loadVoices(url)
    }
    const radioMan = await loadFigureManifest(stubManifest(SKYRIM_FEMALE_ID))
    if (radioMan.voices) {
      const url = await resolveVoicesCatalogUrl(SKYRIM_FEMALE_ID, radioMan.voices)
      if (url) await clock.loadRadio(url)
    }
  })()

  const characterId = opts.characterId ?? DEFAULT_CHARACTER
  const weaponId = opts.weaponId ?? DEFAULT_WEAPON
  const starterId = KITS[CHARACTERS[characterId].kitId].defaultStarter
  let trackIndex = Math.max(
    0,
    listTracks().findIndex((t) => t.id === (opts.trackId ?? DEFAULT_TRACK_ID)),
  )
  const tracks = listTracks()
  const track: TrackDef = tracks[trackIndex] ?? defaultTrack()
  if (tracks.length > 0) trackIndex = Math.max(0, tracks.indexOf(track))

  const s = createSessionState({
    characterId,
    weaponId,
    starterId,
    trackIndex,
    track,
    hubThemeId: bootSettings.hubThemeId,
    figureId: figureIdBoot,
  })
  hydratePrep(s, loadPrep(), { forcedTrackId: opts.trackId })

  let audioBlobUrl: string | null = null
  let figureJob = Promise.resolve()
  let codexPreviewKey = ''

  const persistPrep = () => writePrep(s)
  const fuseNeedNow = () => startFuseNeed(loadMeta().startFuse)
  const refreshFuse = () => clampFusePicks(s, fuseNeedNow())
  refreshFuse()

  const applyMusicGain = (g: number) => {
    clock.setMusicGain(g)
    saveSettings({ musicGain: clock.getMusicGain() })
  }
  const applySfxGain = (g: number) => {
    clock.setSfxGain(g)
    saveSettings({ sfxGain: clock.getSfxGain() })
  }
  const applyHubTheme = (id: HubThemeId) => {
    s.hubThemeId = id
    saveSettings({ hubThemeId: s.hubThemeId })
  }
  const stepHubTheme = (dir: 1 | -1) => {
    applyHubTheme(cycleHubTheme(s.hubThemeId, dir))
    clock.beep('ui')
  }
  const syncBackgroundAudio = () => {
    const hidden = document.visibilityState !== 'visible'
    const unfocused = typeof document.hasFocus === 'function' && !document.hasFocus()
    clock.setOutputMute(hidden || unfocused)
    if (hidden) {
      void clock.pauseAudio()
      return
    }
    if (!s.paused) void clock.resumeAudio()
  }
  document.addEventListener('visibilitychange', syncBackgroundAudio)
  window.addEventListener('blur', syncBackgroundAudio)
  window.addEventListener('focus', syncBackgroundAudio)
  syncBackgroundAudio()

  const applyFigure = async (id: string) => {
    if (id !== s.figureId) return
    if (renderer.setFigure) await renderer.setFigure(id)
    if (id !== s.figureId) return
    clock.clearVoices()
    const man = await loadFigureManifest(stubManifest(id))
    if (id !== s.figureId) return
    if (man.voices && id !== SKYRIM_FEMALE_ID) {
      const url = await resolveVoicesCatalogUrl(id, man.voices)
      if (url) await clock.loadVoices(url)
      else clock.clearVoices()
    } else {
      clock.clearVoices()
    }
  }
  const stepFigure = (dir: 1 | -1) => {
    s.figureId = cycleHubFigure(s.figureId, dir)
    saveFigureId(s.figureId)
    const id = s.figureId
    figureJob = figureJob.then(() => applyFigure(id))
    clock.beep('ui')
  }
  const restoreHubFigureMesh = () => {
    figureJob = figureJob.then(async () => {
      if (renderer.setFigure) await renderer.setFigure(s.figureId)
    })
  }
  const syncCodexFigure = () => {
    if (s.scene !== 'codex') {
      if (codexPreviewKey) {
        codexPreviewKey = ''
        restoreHubFigureMesh()
      }
      return
    }
    const entry = codexAt(s.codexTab, wrapCodexIndex(s.codexTab, s.codexIndex))
    const key = `${entry.tab}:${entry.id}`
    if (key === codexPreviewKey) return
    codexPreviewKey = key
    const preview = codexPreviewOf(entry)
    const want = preview.packId ?? s.figureId
    figureJob = figureJob.then(async () => {
      if (renderer.setFigure) await renderer.setFigure(want)
    })
  }

  const enterHubItem = (i: number) => {
    const items = hubList()
    const it = items[i]
    if (!it) return
    if (it.scene === 'figure') {
      clock.beep('ui_ok')
      return
    }
    if (it.scene === 'closet' && !closet) {
      clock.beep('ui_back')
      return
    }
    s.hubIndex = i
    s.scene = it.scene as SceneKind
    if (it.scene === 'prep') {
      s.seed = Date.now() % 1_000_000
      s.prepFocus = 'mode' satisfies PrepFocus
      refreshFuse()
    }
    if (it.scene === 'shop') s.shopIndex = 0
    if (it.scene === 'codex') {
      s.codexTab = 'people'
      s.codexIndex = 0
    }
    clock.beep('ui_ok')
  }

  const setPaused = (v: boolean) => {
    if (s.scene !== 'play' || !s.world) return
    s.paused = v
    if (import.meta.env.DEV) {
      tune.setOpen(v)
      if (v) tune.syncFromWorld(s.world)
    }
    if (v) {
      void clock.pauseAudio()
    } else {
      tune.setOpen(false)
      syncBackgroundAudio()
    }
  }

  let io!: SessionIO
  const tune = createTunePanel(app, {
    onResume: () => setPaused(false),
    onAbandon: () => abandonRun(s, io),
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
    if (
      e.key === 'Escape' &&
      (s.scene === 'prep' ||
        s.scene === 'closet' ||
        s.scene === 'options' ||
        s.scene === 'shop' ||
        s.scene === 'codex')
    ) {
      e.preventDefault()
      s.scene = 'title'
      clock.beep('ui_back')
      return
    }
    if (e.key === 'Tab' && s.scene === 'prep') {
      e.preventDefault()
    }
    if (
      (s.scene === 'title' ||
        s.scene === 'options' ||
        s.scene === 'shop' ||
        s.scene === 'prep' ||
        s.scene === 'codex') &&
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
    if (e.key === 'Escape' && s.scene === 'play' && s.world) {
      e.preventDefault()
      setPaused(!s.paused)
      return
    }
    if (
      s.paused &&
      s.scene === 'play' &&
      s.world &&
      (e.key === 'Enter' || e.key === ' ')
    ) {
      e.preventDefault()
      abandonRun(s, io)
      return
    }
    if (s.paused) return
    s.pendingKey = e.key
    s.pendingCode = e.code
  }
  window.addEventListener('keydown', onKey)

  const revokeAudioBlob = () => {
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl)
      audioBlobUrl = null
    }
  }

  async function prepareTrack(t: TrackDef): Promise<void> {
    s.loading = true
    s.trackError = ''
    s.trackTitle = t.title
    s.trackDurSec = 0
    if (!isRhythmEnabled()) {
      s.trackReady = false
      s.rhythm = null
      s.loading = false
      return
    }
    try {
      await clock.ensure()
      revokeAudioBlob()

      if (t.source === 'osz') {
        if (!t.oszPath) throw new Error('osz track missing oszPath')
        const pack = await loadOsz(resUrl(t.oszPath), {
          preferVersion: t.oszPrefer,
          signal: AbortSignal.timeout(60_000),
        })
        audioBlobUrl = pack.audioUrl
        s.trackTitle = `${pack.title} [${pack.version}]`
        s.chartBpm = pack.bpm
        await clock.loadUrl(pack.audioUrl)
        s.trackDurSec = clock.duration
        s.rhythm = createRhythmRuntime(pack.notes, 1.65)
        s.trackReady = true
        console.info(
          `[osz] ${pack.artist} - ${pack.title} [${pack.version}]`,
          `${pack.notes.length} notes`,
          `bpm≈${pack.bpm.toFixed(1)}`,
          `diffs=${pack.versions.join(', ')}`,
        )
        return
      }

      const { meta, audioUrl } = await loadMusicMeta(t)
      s.trackTitle = meta.name || t.title
      s.trackDurSec = metaDurationSec(meta.duration)
      await clock.loadUrl(audioUrl)
      if (clock.duration > 0) s.trackDurSec = clock.duration
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
      s.chartBpm = 110
      s.rhythm = createRhythmRuntime(notes, 1.65)
      s.trackReady = true
    } catch (e) {
      s.trackReady = false
      s.trackError = e instanceof Error ? e.message : String(e)
      s.rhythm = null
      console.error('[track]', e)
    } finally {
      s.loading = false
      if (
        s.trackReady &&
        (s.scene === 'title' ||
          s.scene === 'closet' ||
          s.scene === 'options' ||
          s.scene === 'shop' ||
          s.scene === 'prep' ||
          s.scene === 'result')
      ) {
        clock.ensureMenuLoop()
      }
    }
  }

  if (isRhythmEnabled()) void prepareTrack(s.track)

  async function startRun(): Promise<void> {
    if (s.loading) return
    if (isRhythmEnabled()) {
      if (!s.trackReady) {
        await prepareTrack(s.track)
        if (!s.trackReady) return
      }
    } else {
      s.rhythm = null
      s.trackReady = false
    }
    await clock.ensure()
    await clock.resumeIfNeeded()
    const persist = loadMeta()
    s.runMeta = metaLoadoutMods(persist, s.blessingId, s.contractIds, {
      forceMuteBeat: !isRhythmEnabled(),
    })
    s.startGold = 0
    s.duoLearnId = ensureDuoLearn(s.starterId, s.duoLearnId)
    s.fuseLearnIds = ensureStartFuses(s.starterId, s.fuseLearnIds, startFuseNeed(persist.startFuse))
    s.upgrades = s.fuseLearnIds.map((id) => makeOwned(duoFuseUpgradeId(s.starterId, id), 1))
    let wildPick: OwnedUpgrade | null = null
    if (s.contractIds.includes('wild')) {
      wildPick = rollStartStat(mulberry32(s.seed ^ 0x51ed), s.upgrades, s.starterId, {
        autoPickup: persist.autoPickup,
        muteBeat: s.contractIds.includes('still') || !isRhythmEnabled(),
      })
      if (wildPick) s.upgrades = [...s.upgrades, wildPick]
    }
    s.runScore = 0
    s.runKills = 0
    startWave(1)
    if (wildPick && s.world) {
      pushHint(s.world, 'wild', `盲抽 · ${wildPick.meta.name} Ⅰ`, 3.2)
    }
  }

  function startWave(wave: number): void {
    const prev = s.world
    const waveDuration = resolveWaveDurationSec(clock.duration)
    s.world = createWorld({
      wave,
      upgrades: s.upgrades,
      seed: s.seed,
      characterId: s.characterId,
      weaponId: s.weaponId,
      starterId: s.starterId,
      waveDuration,
      runMeta: s.runMeta,
      startGold: s.startGold,
      runMode: s.runMode,
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
    if (s.rhythm) {
      s.rhythm = createRhythmRuntime(
        s.rhythm.notes.map((n) => ({
          ...n,
          judged: false,
          result: null,
        })),
      )
    }
    const bpm = s.chartBpm + (wave - 1) * 2
    if (s.trackReady) clock.start(bpm, 0)
    else clock.startSilent(bpm)
    clock.beep('wave_start')
    s.scene = 'play'
    s.paused = false
    s.clearSettled = false
    tune.setOpen(false)
  }

  function goResult(won: boolean): void {
    const g = s.world?.stats.gold ?? 0
    s.lastBanked = settleRunGold(g, won, s.blessingId, s.contractIds)
    addPurse(s.lastBanked)
    s.scene = 'result'
    s.paused = false
    tune.setOpen(false)
    clock.stop()
  }

  io = {
    clock,
    keys: input.keys,
    persistPrep,
    prepareTrack,
    startRun,
    startWave,
    goResult,
    fuseNeedNow,
    clampFusePicks: refreshFuse,
    hubList,
    enterHubItem,
    stepFigure,
    stepHubTheme,
    applyMusicGain,
    applySfxGain,
    setTuneOpen: (open) => tune.setOpen(open),
  }

  let last = performance.now()
  let raf = 0

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now

    consumePendingKey(s, io)
    tickFade(s, dt, { startWave, goResult })
    tickPlayFrame(s, dt, io)

    if (
      (s.scene === 'title' ||
        s.scene === 'closet' ||
        s.scene === 'options' ||
        s.scene === 'shop' ||
        s.scene === 'codex' ||
        s.scene === 'prep' ||
        s.scene === 'result' ||
        s.scene === 'pick') &&
      s.trackReady &&
      !s.loading
    ) {
      clock.ensureMenuLoop()
    }

    const mutter =
      !s.paused &&
      !s.fadeTx &&
      (s.scene === 'title' ||
        (s.scene === 'play' && !!s.world && !s.world.dead && !s.world.offer))
    clock.tickIdle(dt, mutter)

    closet?.setVisible(s.scene === 'closet')
    syncCodexFigure()
    renderer.draw(buildSnapshot(s, io))
    input.endFrame()
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('keydown', onKey)
    document.removeEventListener('visibilitychange', syncBackgroundAudio)
    window.removeEventListener('blur', syncBackgroundAudio)
    window.removeEventListener('focus', syncBackgroundAudio)
    input.dispose()
    tune.dispose()
    closet?.dispose()
    clock.stop()
    revokeAudioBlob()
  }
}

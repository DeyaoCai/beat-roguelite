import type { AudioClock } from '../../adapters/audio/clock'
import type { HubItem } from '../../content/hub'
import type { CodexTab } from '../../content/codex'
import type { HubThemeId } from '../../content/hubThemes'
import type { BlessingId, ContractId } from '../../content/meta'
import type { CharacterId } from '../../content/characters'
import type { TrackDef } from '../../content/tracks'
import type { StarterId, WeaponId } from '../../content/weapons'
import type { RunMode, World } from '../../domain/combat'
import type { MetaLoadoutMods, OwnedUpgrade, UpgradeId } from '../../domain/progression'
import type { RhythmRuntime } from '../../domain/rhythm'
import type { KeyState } from '../../domain/shared/ports'
import type { PrepFocus, SceneKind } from '../../presentation/render/types'

export const FADE_OUT_SEC = 0.4
export const FADE_IN_SEC = 0.55

export type FadeTx = {
  phase: 'out' | 'in'
  t: number
  action: 'wave' | 'result'
  nextWave?: number
  won?: boolean
}

export type SessionState = {
  scene: SceneKind
  world: World | null
  upgrades: OwnedUpgrade[]
  runScore: number
  runKills: number
  seed: number
  pendingKey: string | null
  pendingCode: string | null
  loading: boolean
  paused: boolean
  hubIndex: number
  hubThemeId: HubThemeId
  optionsRow: number
  shopIndex: number
  codexTab: CodexTab
  codexIndex: number
  prepFocus: PrepFocus
  prepContractIndex: number
  blessingId: BlessingId | null
  duoLearnId: UpgradeId
  fuseLearnIds: UpgradeId[]
  fuseCursorId: UpgradeId
  contractIds: ContractId[]
  runMeta: MetaLoadoutMods | null
  startGold: number
  lastBanked: number
  clearSettled: boolean
  runMode: RunMode
  fadeBlack: number
  fadeTx: FadeTx | null
  starterId: StarterId
  trackIndex: number
  track: TrackDef
  trackTitle: string
  trackDurSec: number
  trackReady: boolean
  trackError: string
  rhythm: RhythmRuntime | null
  chartBpm: number
  characterId: CharacterId
  weaponId: WeaponId
  figureId: string
}

export type SessionIO = {
  clock: AudioClock
  keys: KeyState
  persistPrep: () => void
  prepareTrack: (t: TrackDef) => Promise<void>
  startRun: () => Promise<void>
  startWave: (wave: number) => void
  goResult: (won: boolean) => void
  fuseNeedNow: () => number
  clampFusePicks: () => void
  hubList: () => HubItem[]
  enterHubItem: (i: number) => void
  stepFigure: (dir: 1 | -1) => void
  stepHubTheme: (dir: 1 | -1) => void
  applyMusicGain: (g: number) => void
  applySfxGain: (g: number) => void
  setTuneOpen: (open: boolean) => void
}

export function createSessionState(init: {
  characterId: CharacterId
  weaponId: WeaponId
  starterId: StarterId
  trackIndex: number
  track: TrackDef
  hubThemeId: HubThemeId
  figureId: string
}): SessionState {
  return {
    scene: 'title',
    world: null,
    upgrades: [],
    runScore: 0,
    runKills: 0,
    seed: Date.now() % 1_000_000,
    pendingKey: null,
    pendingCode: null,
    loading: false,
    paused: false,
    hubIndex: 0,
    hubThemeId: init.hubThemeId,
    optionsRow: 0,
    shopIndex: 0,
    codexTab: 'people',
    codexIndex: 0,
    prepFocus: 'mode',
    prepContractIndex: 0,
    blessingId: null,
    duoLearnId: 'learn_orb',
    fuseLearnIds: ['learn_orb'],
    fuseCursorId: 'learn_orb',
    contractIds: [],
    runMeta: null,
    startGold: 0,
    lastBanked: 0,
    clearSettled: false,
    runMode: 'standard',
    fadeBlack: 0,
    fadeTx: null,
    starterId: init.starterId,
    trackIndex: init.trackIndex,
    track: init.track,
    trackTitle: init.track.title,
    trackDurSec: 0,
    trackReady: false,
    trackError: '',
    rhythm: null,
    chartBpm: 120,
    characterId: init.characterId,
    weaponId: init.weaponId,
    figureId: init.figureId,
  }
}

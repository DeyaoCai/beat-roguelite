import type { AudioClockPort, KeyState } from '../shared/ports'
import {
  DEFAULT_CHARACTER,
  type CharacterId,
} from '../../content/characters'
import { DEFAULT_MARTIAL, DEFAULT_STARTER, type MagicId, type MartialId, type StarterId } from '../../content/weapons'
import {
  AUTO_FUSE_MAIN_LEVEL,
  AUTO_FUSE_OFF_LEVEL,
  fuseIdForOffhand,
  fuseOfferName,
  isFuseUpgradeId,
  learnIdForOffhand,
  offhandForFuseId,
  spellLevel,
} from '../../content/fusions'
import type { OwnedUpgrade, UpgradeOffer } from '../progression/upgrades'
import { ownedFusableOffhands } from '../progression/upgrades'
import { heatToMult, tickHeat } from './heat'
import { mulberry32 } from './math'
import { resolveLoadout, tickPickups, xpToNextFor, grantXp } from '../progression'
import type { MetaLoadoutMods } from '../progression/meta'
import { carapaceStacksForWave, hasRelic, sparkFeverFloor } from '../progression/relics'
import {
  tickEnemies,
  tickPlayerMove,
  tickPlayerWeapons,
  tickProjectiles,
  tickWaveClear,
} from './systems'
import { spawnWaveChest } from './spawn'
import { tickFever, tryManualFever } from './beatBridge'
import { tickRelics } from './status'
import { ARENA_HALF, WAVE_DURATION_FALLBACK_SEC, WAVE_DURATION_MIN_SEC, type RunMode } from './arena'
import { generateMap } from './map'
import { generateField, heatDecayMul, tickGroundBurn } from './weather'
import { tickFloaters } from './combat'
import { ELITE_FIRST_SEC } from './spawn'
import type { World } from './types'

export {
  ARENA_HALF,
  PLAY_VIEW_HALF,
  resolveWaveDurationSec,
  WAVE_DURATION_MIN_SEC,
  WAVE_DURATION_MAX_SEC,
  STANDARD_WAVES,
  isLastStandardWave,
  type RunMode,
} from './arena'

export type { World } from './types'
export { applyBeatResult } from './systems'
export { grantXp }
export { isFeverActive, tickFever, tryManualFever, enterFever, endFeverCrash } from './beatBridge'

export type CreateWorldOpts = {
  wave: number
  upgrades: OwnedUpgrade[]
  seed?: number
  characterId?: CharacterId
  martialId?: MartialId
  starterId?: StarterId
  magicIds?: MagicId[]
  /** @deprecated alias of martialId */
  weaponId?: MartialId
  /** Carry XP / level / best combo / gold across waves. */
  progress?: { level: number; xp: number; xpToNext: number; maxCombo?: number; gold?: number }
  /** Wave length in seconds — fixed 3–5 min band (see resolveWaveDurationSec). */
  waveDuration?: number
  runMeta?: MetaLoadoutMods | null
  startGold?: number
  runMode?: RunMode
}

export function createWorld(opts: CreateWorldOpts): World {
  const {
    wave,
    upgrades,
    seed = 1,
    characterId = DEFAULT_CHARACTER,
    martialId,
    starterId,
    magicIds,
    weaponId,
    progress,
    waveDuration,
    runMeta = null,
    startGold = 0,
    runMode = 'standard',
  } = opts
  const rng = mulberry32(seed + wave * 997)
  const loadout = resolveLoadout({
    characterId,
    martialId: martialId ?? weaponId ?? DEFAULT_MARTIAL,
    starterId: starterId ?? DEFAULT_STARTER,
    magicIds,
    upgrades,
    meta: runMeta ?? undefined,
  })
  const level = progress?.level ?? 1
  const xp = progress?.xp ?? 0
  const xpToNext = progress?.xpToNext ?? xpToNextFor(level)
  const arenaHalf = ARENA_HALF
  const obstacles = generateMap(rng, arenaHalf, wave)
  const field = generateField(seed, wave, arenaHalf)

  const w: World = {
    arena: { half: arenaHalf },
    player: {
      x: 0,
      z: 0,
      hp: loadout.maxHp,
      maxHp: loadout.maxHp,
      r: loadout.radius,
      speed: loadout.moveSpeed,
      fireCd: 0,
      meleeCd: 0,
      auraCd: 0,
      chainCd: 0,
      starCd: 0,
      tickCritLock: 0,
      invuln: 0,
      hurtFlash: 0,
      facingX: 0,
      facingZ: -1,
      slowT: 0,
      slowMul: 1,
      poisonT: 0,
      poisonDps: 0,
      poisonAcc: 0,
      bleedT: 0,
      bleedDps: 0,
      bleedAcc: 0,
      hurtAcc: 0,
      dashT: 0,
      dashCd: 0,
      dashVx: 0,
      dashVz: 0,
      lastMoveX: 0,
      lastMoveZ: -1,
      moving: false,
      iceVx: 0,
      iceVz: 0,
      burnAcc: 0,
      shieldOn: hasRelic(upgrades, 'relic_ward'),
      shieldCd: 0,
      leechBank: 0,
      castSeq: 0,
    },
    enemies: [],
    bullets: [],
    slashes: [],
    craters: [],
    chains: [],
    fxPops: [],
    pickups: [],
    floaters: [],
    auraPulseT: 0,
    orbitAng: 0,
    orbitPulseT: 0,
    flameBoostT: 0,
    obstacles,
    weatherId: field.weatherId,
    windX: field.windX,
    windZ: field.windZ,
    terrain: field.terrain,
    stats: {
      score: 0,
      kills: 0,
      wave,
      heat: sparkFeverFloor(upgrades),
      mult: 1,
      beatFlash: null,
      beatFlashT: 0,
      combo: 0,
      maxCombo: progress?.maxCombo ?? 0,
      fever: 0,
      feverMax: 100,
      feverFlashT: 0,
      feverActiveT: 0,
      feverActiveMax: 0,
      feverCooldownT: 0,
      timingHint: null,
      timingHintT: 0,
      comboFlashT: 0,
      comboBreakT: 0,
      comboMilestone: null,
      comboMilestoneT: 0,
      level,
      xp,
      xpToNext,
      pendingLevelUps: 0,
      levelFlashT: 0,
      gold: progress?.gold ?? startGold,
    },
    loadout,
    upgrades: [...upgrades],
    waveTime: 0,
    // Match combat window; silent fallback ~4 minutes (clamped 3–5 elsewhere).
    waveDuration: Math.max(WAVE_DURATION_MIN_SEC, waveDuration ?? WAVE_DURATION_FALLBACK_SEC),
    spawnCd: 1.2,
    eliteCd: ELITE_FIRST_SEC,
    bossSpawned: false,
    lootGraceT: 0,
    nextPickupId: 1,
    cleared: false,
    dead: false,
    offer: null,
    pickReason: null,
    offerQueue: [],
    domainEvents: [],
    rng,
    runMeta,
    carapaceStacks: hasRelic(upgrades, 'relic_carapace')
      ? carapaceStacksForWave(wave)
      : 0,
    bossHint: '',
    bossHintT: 0,
    eliteTeleT: 0,
    eliteTeleMax: 0,
    eliteTeleX: 0,
    eliteTeleZ: 0,
    elitePending: false,
    runMode,
  }
  spawnWaveChest(w)
  return w
}

export function tickWorld(
  w: World,
  dt: number,
  keys: KeyState,
  clock: AudioClockPort,
): void {
  if (w.dead) return
  if (w.cleared) {
    // Keep the arena alive so clear doesn't look like a hang.
    w.stats.beatFlashT = Math.max(0, w.stats.beatFlashT - dt)
    if (w.stats.beatFlashT <= 0) w.stats.beatFlash = null
    w.stats.levelFlashT = Math.max(0, w.stats.levelFlashT - dt)
    w.stats.feverFlashT = Math.max(0, w.stats.feverFlashT - dt)
    w.stats.timingHintT = Math.max(0, w.stats.timingHintT - dt)
    if (w.stats.timingHintT <= 0) w.stats.timingHint = null
    w.stats.comboFlashT = Math.max(0, w.stats.comboFlashT - dt)
    w.stats.comboBreakT = Math.max(0, w.stats.comboBreakT - dt)
    w.stats.comboMilestoneT = Math.max(0, w.stats.comboMilestoneT - dt)
    if (w.stats.comboMilestoneT <= 0) w.stats.comboMilestone = null
    w.player.invuln = Math.max(0, w.player.invuln - dt)
    w.player.hurtFlash = Math.max(0, w.player.hurtFlash - dt)
    tickFloaters(w, dt)
    tickPlayerMove(w, dt, keys, clock)
    tickGroundBurn(w, dt, clock)
    return
  }

  // Combat clock is real-time (fixed 3–5 min window), not full track length.
  w.waveTime = Math.min(w.waveDuration, w.waveTime + dt)
  w.stats.beatFlashT = Math.max(0, w.stats.beatFlashT - dt)
  if (w.stats.beatFlashT <= 0) w.stats.beatFlash = null
  w.stats.levelFlashT = Math.max(0, w.stats.levelFlashT - dt)
  w.stats.feverFlashT = Math.max(0, w.stats.feverFlashT - dt)
  w.stats.timingHintT = Math.max(0, w.stats.timingHintT - dt)
  if (w.stats.timingHintT <= 0) w.stats.timingHint = null
  w.stats.comboFlashT = Math.max(0, w.stats.comboFlashT - dt)
  w.stats.comboBreakT = Math.max(0, w.stats.comboBreakT - dt)
  w.stats.comboMilestoneT = Math.max(0, w.stats.comboMilestoneT - dt)
  if (w.stats.comboMilestoneT <= 0) w.stats.comboMilestone = null

  if (w.stats.feverActiveT <= 0) {
    w.stats.heat = tickHeat(
      w.stats.heat,
      dt,
      w.loadout.heatCfg,
      heatDecayMul(w.weatherId),
    )
    w.stats.mult = heatToMult(w.stats.heat, w.loadout.heatCfg.max)
  }

  tickFloaters(w, dt)
  if (w.eliteTeleT > 0) w.eliteTeleT = Math.max(0, w.eliteTeleT - dt)
  tickPlayerMove(w, dt, keys, clock)
  tickGroundBurn(w, dt, clock)
  tickPlayerWeapons(w, dt, clock)
  tickEnemies(w, dt, clock)
  tickPickups(w, dt, clock)
  tickProjectiles(w, dt, clock)
  tickWaveClear(w, dt, clock)
  tryManualFever(w, clock, keys.feverPressed)
  tickFever(w, dt, clock)
  tickRelics(w, dt)
}

export function chooseUpgrade(w: World, offer: UpgradeOffer): OwnedUpgrade[] {
  return [...w.upgrades, { id: offer.id, grade: offer.grade }]
}

function refreshLoadout(w: World): void {
  const beforeMax = w.player.maxHp
  w.loadout = resolveLoadout({
    characterId: w.loadout.characterId,
    martialId: w.loadout.martialId,
    starterId: w.loadout.starterId,
    upgrades: w.upgrades,
    meta: w.runMeta ?? undefined,
  })
  w.player.maxHp = w.loadout.maxHp
  if (w.player.maxHp > beforeMax) {
    w.player.hp += w.player.maxHp - beforeMax
  }
  w.player.speed = w.loadout.moveSpeed
  w.player.r = w.loadout.radius
}

/**
 * 主手与某副手灌注层级都达标 → 自动融合（不占三选池）。
 * 多门副手同时达标时，吃灌注层级最高的那门。
 */
export function tryAutoFuse(w: World): boolean {
  if (w.upgrades.some((o) => isFuseUpgradeId(o.id))) return false
  const main = w.loadout.starterId
  if (spellLevel(main, w.upgrades, main) < AUTO_FUSE_MAIN_LEVEL) return false
  const ready = ownedFusableOffhands(main, w.upgrades)
    .map((off) => ({ off, lv: spellLevel(main, w.upgrades, off) }))
    .filter((x) => x.lv >= AUTO_FUSE_OFF_LEVEL)
  if (ready.length === 0) return false
  ready.sort((a, b) => b.lv - a.lv)
  const off = ready[0]!.off
  const learn = learnIdForOffhand(off)
  w.upgrades = [
    ...w.upgrades.filter((u) => u.id !== learn && !isFuseUpgradeId(u.id)),
    { id: fuseIdForOffhand(off), grade: 1 },
  ]
  refreshLoadout(w)
  w.bossHint = fuseOfferName(main, off)
  w.bossHintT = 2.5
  return true
}

/** Re-apply loadout after a mid-run upgrade. */
export function applyUpgradeToWorld(
  w: World,
  offer: UpgradeOffer,
  opts?: { consumeLevel?: boolean },
): void {
  if (isFuseUpgradeId(offer.id)) {
    // 遗留：融合已改自动；若仍传入 fuse 卡则按同规则落地
    const off = offhandForFuseId(offer.id)
    const learn = learnIdForOffhand(off)
    w.upgrades = [
      ...w.upgrades.filter((u) => u.id !== learn && !isFuseUpgradeId(u.id)),
      { id: offer.id, grade: 1 },
    ]
  } else {
    w.upgrades = chooseUpgrade(w, offer)
  }
  refreshLoadout(w)
  if (offer.id === 'max_hp') w.player.hp = w.player.maxHp
  if (offer.id === 'relic_ward') {
    w.player.shieldOn = true
    w.player.shieldCd = 0
  }
  if (offer.id === 'relic_carapace') {
    w.carapaceStacks = carapaceStacksForWave(w.stats.wave)
  }
  if (offer.id === 'relic_spark') {
    const floor = sparkFeverFloor(w.upgrades)
    if (floor > 0 && w.stats.feverActiveT <= 0) {
      w.stats.heat = Math.max(w.stats.heat, floor)
    }
  }
  tryAutoFuse(w)
  if (opts?.consumeLevel !== false) {
    w.stats.pendingLevelUps = Math.max(0, w.stats.pendingLevelUps - 1)
  }
}

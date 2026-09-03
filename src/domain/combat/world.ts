import type { AudioClockPort, KeyState } from '../shared/ports'
import {
  DEFAULT_CHARACTER,
  type CharacterId,
} from '../../content/characters'
import { DEFAULT_MARTIAL, DEFAULT_STARTER, type MagicId, type MartialId, type StarterId } from '../../content/weapons'
import {
  fuseOfferName,
  isFuseUpgradeId,
  learnIdForOffhand,
  offhandForFuseId,
} from '../../content/fusions'
import type { OwnedUpgrade, UpgradeOffer } from '../progression/upgrades'
import { isStackableUpgrade, makeOwned } from '../progression/upgrades'
import { heatToMult, tickHeat } from './heat'
import { mulberry32 } from './math'
import { resolveLoadout, tickPickups, xpToNextFor, grantXp, drainOfferQueue } from '../progression'
import type { MetaLoadoutMods } from '../progression/meta'
import { carapaceStacksForWave, hasRelic, sparkFeverFloor } from '../progression/relics'
import {
  tickEnemies,
  tickPlayerMove,
  tickPlayerWeapons,
  tickProjectiles,
  tickWaveClear,
} from './systems'
import { ELITE_FIRST_SEC, rollChestAtSec } from './spawn'
import { tickFever, tryManualFever } from './beatBridge'
import { tickRelics } from './status'
import { ARENA_HALF, WAVE_DURATION_FALLBACK_SEC, WAVE_DURATION_MIN_SEC, type RunMode } from './arena'
import { generateMap } from './map'
import { generateField, heatDecayMul, rollWeatherCycle, tickGroundBurn, tickWeatherCycle } from './weather'
import { pushHint, tickHint } from './hints'
import { tickFloaters } from './combat'
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
  const duration = Math.max(WAVE_DURATION_MIN_SEC, waveDuration ?? WAVE_DURATION_FALLBACK_SEC)
  const weatherCycle = rollWeatherCycle(seed, wave, duration)
  const field = generateField(seed, wave, arenaHalf, weatherCycle[0] ?? 'clear', 0)
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
    flameBoostT: 0,
    obstacles,
    weatherId: field.weatherId,
    fieldSeed: seed,
    weatherCycle,
    weatherSlot: 0,
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
    waveDuration: duration,
    spawnCd: 1.2,
    eliteCd: ELITE_FIRST_SEC,
    eliteSpawned: false,
    bossSpawned: false,
    chestAtSec: rollChestAtSec(duration, rng),
    chestSpawned: false,
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
    hintKind: null,
    eliteTeleT: 0,
    eliteTeleMax: 0,
    eliteTeleX: 0,
    eliteTeleZ: 0,
    elitePending: false,
    runMode,
  }
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
    tickHint(w, dt)
    w.player.invuln = Math.max(0, w.player.invuln - dt)
    w.player.hurtFlash = Math.max(0, w.player.hurtFlash - dt)
    tickFloaters(w, dt)
    tickPlayerMove(w, dt, keys, clock)
    tickGroundBurn(w, dt, clock)
    return
  }

  // Combat clock is real-time (fixed 3–5 min window), not full track length.
  w.waveTime = Math.min(w.waveDuration, w.waveTime + dt)
  tickHint(w, dt)
  tickWeatherCycle(w)
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
  tickWildOffers(w, clock)
}

/** 盲抽：局内三选当场随机一张。关末 `wave` 留给 application 切波。 */
function tickWildOffers(w: World, clock: AudioClockPort): void {
  if (!w.loadout.wildPick || w.dead) return
  if (!w.offer) drainOfferQueue(w)
  let guard = 8
  while (guard-- > 0) {
    if (!w.offer?.length || !w.pickReason || w.pickReason === 'wave') return
    const picked = w.offer[Math.floor(w.rng() * w.offer.length)]!
    applyUpgradeToWorld(w, picked, {
      consumeLevel: w.pickReason === 'level',
      announce: 'wild',
    })
    w.offer = null
    w.pickReason = null
    w.player.invuln = Math.max(w.player.invuln, 0.45)
    w.stats.levelFlashT = Math.max(w.stats.levelFlashT, 0.55)
    clock.beep('upgrade')
    drainOfferQueue(w)
  }
}

export function chooseUpgrade(w: World, offer: UpgradeOffer): OwnedUpgrade[] {
  if (!isStackableUpgrade(offer.id) && w.upgrades.some((u) => u.id === offer.id)) {
    return w.upgrades
  }
  return [...w.upgrades, makeOwned(offer.id, offer.grade, offer.meta)]
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

/** Re-apply loadout after a mid-run upgrade. */
export function applyUpgradeToWorld(
  w: World,
  offer: UpgradeOffer,
  opts?: { consumeLevel?: boolean; announce?: 'auto' | 'wild' | 'none' },
): void {
  if (isFuseUpgradeId(offer.id)) {
    const off = offhandForFuseId(offer.id)
    const learn = learnIdForOffhand(off)
    w.upgrades = [
      ...w.upgrades.filter((u) => u.id !== learn),
      makeOwned(offer.id, 1, offer.meta),
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
  const announce = opts?.announce ?? 'auto'
  if (announce === 'wild') {
    pushHint(w, 'wild', `盲抽 · ${offer.label}`)
  } else if (announce === 'auto' && isFuseUpgradeId(offer.id)) {
    const off = offhandForFuseId(offer.id)
    pushHint(w, 'fuse', fuseOfferName(w.loadout.starterId, off))
  }
  if (opts?.consumeLevel === true) {
    w.stats.pendingLevelUps = Math.max(0, w.stats.pendingLevelUps - 1)
  }
}

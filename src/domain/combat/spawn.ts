import type { AudioClockPort } from '../shared/ports'
import {
  BOSS_SPAWN_PHASE,
  FOE_SHOT,
  FODDER_KINDS,
  FODDER_UNLOCK_WAVE,
  PREFER_TRASH_WEIGHT,
  SPAWN_DENSITY,
  SPAWN_PLACE,
  SPAWN_PHASES,
  SPAWN_RATE,
  SPAWN_TIMING,
  SPECIAL_HP,
  type SpawnFodderKind,
  type SpawnPhaseCfg,
} from '../../content/rules'
import { clamp, norm } from './math'
import { hitsObstacle, moveWithObstacles } from './map'
import { makeEnemyMeta } from './enemyMeta'
import { makeFoeBulletMeta } from './bulletMeta'
import { bossDefForWave, tickBoss } from './bosses'
import { hitEffectForKind } from './status'
import { enemyMoveMul, idleCombat, isFrozen, outgoingMul, tickEnemyKnock, tickEnemyStatuses } from './elemental'
import { displaceEnemyGround, groundMoveMul } from './weather'
import { bossHpMul, fodderHp, scaleEnemySpeed } from './waveScale'
import { pushHint } from './hints'
import type { Enemy, EnemyKind, HitEffect, World } from './types'

/** Don't spawn until this many seconds into the wave. */
export const SPAWN_OPEN_SEC = SPAWN_TIMING.openSec
/** First elite not before this many seconds (also gated by phase progress). */
export const ELITE_FIRST_SEC = SPAWN_TIMING.eliteFirstSec
/** Boss spawn time cap (clamped by track length). */
export const BOSS_AT_SEC = SPAWN_TIMING.bossAtSec
/** Boss 最早也要等这么久（给脆皮练级窗）。 */
export const BOSS_EARLIEST_SEC = SPAWN_TIMING.bossEarliestSec
/** 波 1～2：至少升到该等级才放 Boss（否则继续刷脆皮给经验）。 */
export const BOSS_MIN_LEVEL_EARLY = SPAWN_TIMING.bossMinLevelEarly

type FodderSpec = {
  kind: EnemyKind
  hpMul: number
  r: number
  speed: number
  shootCd: number
}

type PhaseCfg = SpawnPhaseCfg

function aiDefaults(rng: () => number): Pick<
  Enemy,
  'aiCd' | 'aiPhase' | 'windupT' | 'windupMax' | 'windupKind' | 'dashT' | 'dashVx' | 'dashVz' | 'spin'
> {
  return {
    aiCd: 0.35 + rng() * 1.4,
    aiPhase: 0,
    windupT: 0,
    windupMax: 0,
    windupKind: null,
    dashT: 0,
    dashVx: 0,
    dashVz: 0,
    spin: 0,
  }
}

function songProgress(w: World): number {
  const d = Math.max(1, w.waveDuration)
  return clamp(w.waveTime / d, 0, 1)
}

function bossAtSec(w: World): number {
  return Math.min(
    BOSS_AT_SEC,
    Math.max(BOSS_EARLIEST_SEC, w.waveDuration * SPAWN_TIMING.bossProgressFrac),
  )
}

export function spawnPhaseAt(w: World, bossAlive: boolean): PhaseCfg {
  if (bossAlive) return BOSS_SPAWN_PHASE
  const p = songProgress(w)
  for (const phase of SPAWN_PHASES) {
    if (p < phase.until) return phase
  }
  return SPAWN_PHASES[SPAWN_PHASES.length - 1]!
}

function distToPlayer(w: World, x: number, z: number): number {
  return Math.hypot(x - w.player.x, z - w.player.z)
}

function onSpawnDisk(x: number, z: number): boolean {
  return Math.hypot(x, z) < SPAWN_PLACE.spawnDiskR
}

function spawnBlocked(w: World, x: number, z: number, r: number): boolean {
  if (hitsObstacle(x, z, r, w.obstacles)) return true
  if (onSpawnDisk(x, z)) return true
  for (const e of w.enemies) {
    if (Math.hypot(e.x - x, e.z - z) < SPAWN_PLACE.foeSep + e.r * 0.35) return true
  }
  return false
}

function tryPos(
  w: World,
  x: number,
  z: number,
  minPlayer: number,
  maxPlayer: number,
): { x: number; z: number } | null {
  const half = w.arena.half - 1.2
  x = clamp(x, -half, half)
  z = clamp(z, -half, half)
  const d = distToPlayer(w, x, z)
  if (d < minPlayer || d > maxPlayer) return null
  if (spawnBlocked(w, x, z, 0.45)) return null
  return { x, z }
}

function pickAround(
  w: World,
  cx: number,
  cz: number,
  jitter: number,
  minPlayer: number,
  maxPlayer: number,
): { x: number; z: number } | null {
  for (let i = 0; i < 16; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = (0.35 + w.rng() * 0.65) * jitter
    const hit = tryPos(w, cx + Math.cos(ang) * rad, cz + Math.sin(ang) * rad, minPlayer, maxPlayer)
    if (hit) return hit
  }
  return tryPos(w, cx, cz, minPlayer, maxPlayer)
}

function pickPressurePos(w: World): { x: number; z: number } {
  const half = w.arena.half - 1.2
  const minR = SPAWN_PLACE.pressureMin
  const maxR = Math.min(SPAWN_PLACE.pressureMax, half * 0.7)
  for (let i = 0; i < 22; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = minR + w.rng() * Math.max(1.5, maxR - minR)
    const hit = tryPos(
      w,
      w.player.x + Math.cos(ang) * rad,
      w.player.z + Math.sin(ang) * rad,
      SPAWN_PLACE.safeR,
      maxR + 2,
    )
    if (hit) return hit
  }
  const side = Math.floor(w.rng() * 4)
  if (side === 0) return { x: -half + w.rng() * half * 2, z: -half }
  if (side === 1) return { x: -half + w.rng() * half * 2, z: half }
  if (side === 2) return { x: -half, z: -half + w.rng() * half * 2 }
  return { x: half, z: -half + w.rng() * half * 2 }
}

function pickTerrainCamp(w: World, minPlayer: number, maxPlayer: number): { x: number; z: number } | null {
  if (!w.terrain.length) return null
  const n = w.terrain.length
  const start = (w.rng() * n) | 0
  for (let i = 0; i < n; i++) {
    const t = w.terrain[(start + i) % n]!
    const jx = (w.rng() - 0.5) * t.w * 0.35
    const jz = (w.rng() - 0.5) * t.d * 0.35
    const hit = tryPos(w, t.x + jx, t.z + jz, minPlayer, maxPlayer)
    if (hit) return hit
  }
  return null
}

function pickFieldCamp(w: World, minPlayer: number, maxPlayer: number): { x: number; z: number } {
  const half = w.arena.half - 1.4
  for (let i = 0; i < 32; i++) {
    const hit = tryPos(
      w,
      (w.rng() * 2 - 1) * half,
      (w.rng() * 2 - 1) * half,
      minPlayer,
      maxPlayer,
    )
    if (hit) return hit
  }
  return pickPressurePos(w)
}

/** 野外营地：场地散落，可贴天气地块，不贴脸。 */
function pickWildCamp(w: World): { x: number; z: number } {
  const half = w.arena.half - 1.4
  const minP = SPAWN_PLACE.wildMin
  const maxP = Math.max(minP + 4, half * SPAWN_PLACE.wildMaxFrac + 8)
  if (w.rng() < SPAWN_PLACE.terrainBias) {
    const onLand = pickTerrainCamp(w, minP, maxP)
    if (onLand) return onLand
  }
  return pickFieldCamp(w, minP, maxP)
}

function pickSpawnPos(w: World): { x: number; z: number } {
  return pickPressurePos(w)
}

function popEmerge(w: World, x: number, z: number): void {
  w.fxPops.push({ x, z, kind: 'emerge', life: 0.38, maxLife: 0.38 })
  if (w.fxPops.length > 28) w.fxPops.splice(0, w.fxPops.length - 28)
}

function specForKind(w: World, kind: EnemyKind): FodderSpec {
  const wave = w.stats.wave
  const key: SpawnFodderKind =
    kind === 'frost' ||
    kind === 'spitter' ||
    kind === 'leech' ||
    kind === 'brute' ||
    kind === 'shooter'
      ? kind
      : 'chaser'
  const rule = FODDER_KINDS[key]
  const speed = scaleEnemySpeed(
    rule.speedBase + Math.max(0, wave - 1) * rule.speedPerWave,
    wave,
    rule.role,
  )
  let shootCd: number
  if (rule.shootCdFixed != null) {
    shootCd = rule.shootCdFixed
  } else if (rule.shootCdBase != null) {
    shootCd =
      Math.max(
        rule.shootCdMin ?? 0,
        rule.shootCdBase - wave * (rule.shootCdPerWave ?? 0),
      ) +
      w.rng() * (rule.shootCdJitter ?? 0)
  } else {
    shootCd =
      (rule.shootCdIdleBase ?? 0.35) + w.rng() * (rule.shootCdIdleJitter ?? 0.7)
  }
  return {
    kind: key,
    hpMul: rule.hpMul,
    r: rule.r,
    speed,
    shootCd,
  }
}

/** Gate status / heavy fodder by wave number even if the phase wants them. */
function filterWeights(
  wave: number,
  weights: Partial<Record<SpawnFodderKind, number>>,
): Array<{ kind: SpawnFodderKind; w: number }> {
  const out: Array<{ kind: SpawnFodderKind; w: number }> = []
  for (const [kind, wt] of Object.entries(weights) as [SpawnFodderKind, number][]) {
    if (wt <= 0) continue
    const unlock = FODDER_UNLOCK_WAVE[kind]
    if (unlock != null && wave < unlock) continue
    out.push({ kind, w: wt })
  }
  if (out.length === 0) out.push({ kind: 'chaser', w: 1 })
  return out
}

function isMeatKind(kind: EnemyKind): boolean {
  return kind === 'brute' || kind === 'elite'
}

function countField(w: World): { trash: number; meat: number; fodder: number } {
  let trash = 0
  let meat = 0
  for (const e of w.enemies) {
    if (e.kind === 'boss' || e.kind === 'chest') continue
    if (isMeatKind(e.kind)) meat += 1
    else trash += 1
  }
  return { trash, meat, fodder: trash + meat }
}

/** 重装/精英同时在场上限：少而肥，别把脆皮挤光。 */
function meatCap(maxEnemies: number, wave: number): number {
  const soft = Math.max(1, Math.floor(maxEnemies * SPAWN_DENSITY.meatCapFrac))
  const hard =
    wave >= SPAWN_DENSITY.meatCapWaveGate
      ? SPAWN_DENSITY.meatCapMaxLate
      : SPAWN_DENSITY.meatCapMaxEarly
  return Math.min(hard, soft)
}

function rollFodder(
  w: World,
  phase: PhaseCfg,
  opts?: { preferTrash?: boolean; meatFull?: boolean },
): FodderSpec {
  let entries = filterWeights(w.stats.wave, phase.weights)
  if (opts?.meatFull || opts?.preferTrash) {
    const stripped = entries.filter((e) => e.kind !== 'brute')
    if (stripped.length > 0) entries = stripped
  }
  if (opts?.preferTrash) {
    entries = entries.map((e) => ({
      kind: e.kind,
      w:
        e.kind === 'chaser' || e.kind === 'shooter'
          ? e.w * PREFER_TRASH_WEIGHT.chaser
          : e.kind === 'leech'
            ? e.w * PREFER_TRASH_WEIGHT.leech
            : e.w * PREFER_TRASH_WEIGHT.other,
    }))
  }
  let total = 0
  for (const e of entries) total += e.w
  let r = w.rng() * total
  for (const e of entries) {
    r -= e.w
    if (r <= 0) return specForKind(w, e.kind)
  }
  return specForKind(w, entries[entries.length - 1]!.kind)
}

function scaledHp(w: World, hp: number): number {
  const mul = w.runMeta?.ironHpMul ?? 1
  return Math.max(1, Math.floor(hp * mul))
}

export function rollChestAtSec(waveDuration: number, rng: () => number): number {
  const min = SPAWN_TIMING.chestProgressMin
  const max = SPAWN_TIMING.chestProgressMax
  const p = min + rng() * (max - min)
  return Math.max(1, waveDuration * p)
}

function pickChestPos(w: World): { x: number; z: number } {
  const half = w.arena.half - 2.2
  const minD = SPAWN_TIMING.chestMinPlayerDist
  const rim0 = SPAWN_TIMING.chestRimMin
  const rim1 = SPAWN_TIMING.chestRimMax
  for (let i = 0; i < 36; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = half * (rim0 + w.rng() * (rim1 - rim0))
    const x = clamp(Math.cos(ang) * rad, -half, half)
    const z = clamp(Math.sin(ang) * rad, -half, half)
    if (Math.hypot(x - w.player.x, z - w.player.z) < minD) continue
    if (hitsObstacle(x, z, 0.55, w.obstacles)) continue
    return { x, z }
  }
  const away = Math.hypot(w.player.x, w.player.z) < 0.4
    ? w.rng() * Math.PI * 2
    : Math.atan2(w.player.z, w.player.x) + Math.PI
  return {
    x: clamp(Math.cos(away) * half * rim1, -half, half),
    z: clamp(Math.sin(away) * half * rim1, -half, half),
  }
}

/** 每波一只可击碎宝箱；曲中段才出现，远处要找。一口碎。 */
export function spawnWaveChest(w: World): void {
  if (w.chestSpawned || w.enemies.some((e) => e.kind === 'chest')) {
    w.chestSpawned = true
    return
  }
  const wave = w.stats.wave
  const { x, z } = pickChestPos(w)
  const meta = makeEnemyMeta('chest')
  const hp = SPECIAL_HP.chestHp
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: 0.55,
    speed: 0,
    shootCd: 99,
    kind: 'chest',
    meta,
    ...idleCombat('chest', wave, meta.armor),
    ...aiDefaults(w.rng),
    aiCd: 99,
  })
  w.chestSpawned = true
}

function maybeSpawnChest(w: World): void {
  if (w.chestSpawned || w.cleared || w.dead) return
  if (w.waveTime < w.chestAtSec) return
  spawnWaveChest(w)
}

function spawnEnemy(
  w: World,
  phase: PhaseCfg,
  pos: { x: number; z: number },
  opts?: { preferTrash?: boolean; meatFull?: boolean },
): void {
  const { x, z } = pos
  const wave = w.stats.wave
  const spec = rollFodder(w, phase, opts)
  const meta = makeEnemyMeta(spec.kind)
  const hpMul = meta.fodder?.hpMul ?? spec.hpMul
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * hpMul))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: meta.fodder?.r ?? spec.r,
    speed: spec.speed,
    shootCd: spec.shootCd,
    kind: spec.kind,
    meta,
    ...idleCombat(spec.kind, wave, meta.armor),
    ...aiDefaults(w.rng),
    hurtFlash: 0.42,
  })
  popEmerge(w, x, z)
}

/** Arm yellow-ring warn; elite entity appears when tele hits 0. */
function armElite(w: World): void {
  const { x, z } = pickWildCamp(w)
  w.eliteTeleX = x
  w.eliteTeleZ = z
  w.eliteTeleMax = 1.6
  w.eliteTeleT = 1.6
  w.elitePending = true
  pushHint(w, 'elite', '精英出现')
}

function commitElite(w: World): void {
  const x = w.eliteTeleX
  const z = w.eliteTeleZ
  const wave = w.stats.wave
  const hp = scaledHp(
    w,
    Math.floor(
      fodderHp(wave) *
        (wave <= 1
          ? SPECIAL_HP.eliteMulWave1
          : SPECIAL_HP.eliteMulBase + wave * SPECIAL_HP.eliteMulPerWave),
    ),
  )
  const meta = makeEnemyMeta('elite')
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: 0.52,
    speed: scaleEnemySpeed(2.15 + Math.max(0, wave - 1) * 0.06, wave, 'tank'),
    shootCd: Math.max(0.35, 0.6 - wave * 0.03),
    kind: 'elite',
    meta,
    ...idleCombat('elite', wave, meta.armor),
    ...aiDefaults(w.rng),
    hurtFlash: 0.7,
  })
  w.elitePending = false
  w.eliteTeleT = 0
  w.eliteTeleMax = 0
  w.eliteSpawned = true
  popEmerge(w, x, z)
}

function spawnBoss(w: World): void {
  const { x, z } = pickSpawnPos(w)
  const wave = w.stats.wave
  const def = bossDefForWave(wave)
  const meta = makeEnemyMeta('boss', def)
  const boss = meta.boss ?? def
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * bossHpMul(wave, boss.hpMul)))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: boss.r,
    speed: scaleEnemySpeed(boss.speed + Math.max(0, wave - 1) * 0.05, wave, 'boss'),
    shootCd: Math.max(0.55, boss.shootCd0 - wave * 0.04),
    kind: 'boss',
    meta,
    bossId: boss.id,
    ...idleCombat('boss', wave, meta.armor),
    ...aiDefaults(w.rng),
    aiCd: boss.id === 'warden' ? 2.5 : boss.id === 'caller' ? 3 : 2,
  })
  const intro: Record<string, string> = {
    warden: '节拍监守 · 躲开脉冲环',
    caller: '猎群号手 · 先清增援',
    hex: '镜咒法师 · 预判闪现',
    choir: '铁律合唱 · 读攻击窗',
    tyrant: '终曲暴君 · 半血会变相',
  }
  pushHint(w, 'boss', intro[boss.id] ?? boss.name)
}

function foeBullet(
  w: World,
  x: number,
  z: number,
  vx: number,
  vz: number,
  opts: { r?: number; life?: number; hitFx?: HitEffect; dmgMul?: number },
): void {
  w.bullets.push({
    x,
    z,
    vx,
    vz,
    life: opts.life ?? FOE_SHOT.life,
    damage: 1,
    pierce: 0,
    friendly: false,
    r: opts.r ?? FOE_SHOT.r,
    meta: makeFoeBulletMeta('foe'),
    hit: new Set(),
    hitFx: opts.hitFx,
    dmgMul: opts.dmgMul,
  })
}

export function tickEnemies(w: World, dt: number, clock: AudioClockPort): void {
  const wave = w.stats.wave
  w.spawnCd -= dt
  maybeSpawnChest(w)
  const bossAlive = w.enemies.some((e) => e.kind === 'boss' && e.hp > 0)
  const phase = spawnPhaseAt(w, bossAlive)
  const progress = songProgress(w)

  const stillSpawning =
    w.lootGraceT <= 0 &&
    w.waveTime >= SPAWN_OPEN_SEC &&
    (w.waveTime < w.waveDuration - SPAWN_TIMING.endPadSec || bossAlive)

  const maxEnemies = Math.floor(
    (phase.maxBase + wave * phase.maxPerWave) * (w.runMeta?.hordeCapMul ?? 1),
  )
  const baseRate = Math.max(SPAWN_RATE.min, SPAWN_RATE.base - wave * SPAWN_RATE.perWave)
  const fodderRate = baseRate * phase.rateMul * (w.runMeta?.hordeRateMul ?? 1)

  // 场上密度：维持脆皮为主；肉盾有软顶，补刷优先追击/射手
  const { trash, meat, fodder: fodderAlive } = countField(w)
  const softTarget = Math.max(4, Math.floor(maxEnemies * SPAWN_DENSITY.softTargetFrac))
  const trashTarget = Math.max(3, Math.floor(maxEnemies * SPAWN_DENSITY.trashTargetFrac))
  const criticalFloor = Math.max(2, Math.floor(maxEnemies * SPAWN_DENSITY.criticalFloorFrac))
  const meatLimit = meatCap(maxEnemies, wave)

  if (stillSpawning && w.spawnCd <= 0 && fodderAlive < maxEnemies) {
    const emptyField = fodderAlive === 0
    const criticallyLow = fodderAlive < criticalFloor
    const depleted = fodderAlive < softTarget
    const trashThin = trash < trashTarget
    const meatFull = meat >= meatLimit
    const horde = (w.runMeta?.hordeCapMul ?? 1) > 1
    const room = maxEnemies - fodderAlive
    let pack = phase.packIdle
    if (emptyField) pack = phase.packBusy + 1 + (horde ? 1 : 0)
    else if (criticallyLow || trashThin) pack = phase.packBusy + (horde ? 1 : 0)
    else if (depleted) pack = phase.packBusy
    else pack = phase.packIdle + (horde ? 1 : 0)
    if (wave >= 4 && phase.id === 'pressure' && depleted && trashThin) pack += 1
    const n = Math.min(pack, room)
    const preferTrash = emptyField || criticallyLow || trashThin || meatFull
    const starve = emptyField || criticallyLow
    const camp = starve ? pickPressurePos(w) : pickWildCamp(w)
    const maxPlayer = w.arena.half * 1.6
    for (let i = 0; i < n; i++) {
      let pos = camp
      if (starve) {
        pos = pickPressurePos(w)
      } else if (i > 0) {
        pos =
          pickAround(
            w,
            camp.x,
            camp.z,
            SPAWN_PLACE.campJitter,
            SPAWN_PLACE.safeR,
            maxPlayer,
          ) ??
          pickAround(
            w,
            camp.x,
            camp.z,
            SPAWN_PLACE.campJitter * 1.8,
            SPAWN_PLACE.safeR,
            maxPlayer,
          ) ??
          pickWildCamp(w)
      }
      spawnEnemy(w, phase, pos, { preferTrash, meatFull })
    }
    w.spawnCd = emptyField
      ? fodderRate * SPAWN_RATE.emptyMul
      : criticallyLow || trashThin
        ? fodderRate * SPAWN_RATE.criticalMul
        : depleted
          ? fodderRate * SPAWN_RATE.depletedMul
          : fodderRate
  }

  w.eliteCd -= dt
  if (w.elitePending && w.eliteTeleT <= 0) {
    commitElite(w)
    clock.beep('elite_spawn')
  }
  const bossAt = bossAtSec(w)
  const eliteAlive = w.enemies.some((e) => e.kind === 'elite')
  const canArmElite =
    !bossAlive &&
    stillSpawning &&
    !w.elitePending &&
    !eliteAlive &&
    w.waveTime >= ELITE_FIRST_SEC
  const phaseWantsElite =
    phase.elite &&
    progress >= SPAWN_TIMING.eliteProgressMin &&
    w.eliteCd <= 0
  const mustBeforeBoss =
    !w.eliteSpawned && w.waveTime >= bossAt - SPAWN_TIMING.eliteBeforeBossSec
  if (canArmElite && (phaseWantsElite || mustBeforeBoss)) {
    armElite(w)
    w.eliteCd = phase.eliteEvery
  }

  // Boss：偏曲中后段；早期波还要等级门槛，避免零强化裸打。
  // 首只精英落地（或预告中）后再放 Boss，避免 3 分钟曲把精英窗挤掉。
  const bossLevelOk =
    w.stats.wave >= 3 ||
    w.stats.level >= BOSS_MIN_LEVEL_EARLY ||
    progress >= 0.82
  if (
    !w.bossSpawned &&
    bossLevelOk &&
    w.waveTime >= bossAt &&
    w.waveTime < w.waveDuration &&
    !w.enemies.some((e) => e.kind === 'boss') &&
    (w.eliteSpawned || w.elitePending || w.waveTime >= bossAt + SPAWN_TIMING.eliteBeforeBossSec + 2)
  ) {
    spawnBoss(w)
    w.bossSpawned = true
    clock.beep('boss_spawn')
  }

  const shotSpd = FOE_SHOT.spdBase + wave * FOE_SHOT.spdPerWave
  tickEnemyStatuses(w, dt)
  for (const e of w.enemies) {
    e.hurtFlash = Math.max(0, e.hurtFlash - dt)
    tickEnemyKnock(w, e, dt)
    if (isFrozen(e)) continue
    if (tickBoss(w, e, dt, clock)) {
      displaceEnemyGround(w, e, dt)
      continue
    }

    tickFodderMove(w, e, dt)
    displaceEnemyGround(w, e, dt)

    const d = norm(w.player.x - e.x, w.player.z - e.z)
    const shoots =
      e.kind === 'shooter' ||
      e.kind === 'elite' ||
      e.kind === 'spitter' ||
      e.kind === 'frost'
    if (!shoots) continue

    e.shootCd -= dt
    if (e.shootCd <= 0) {
      const hitFx = hitEffectForKind(e.kind, 'bullet')
      const dmgMul = outgoingMul(e)
      if (e.kind === 'frost') {
        foeBullet(w, e.x, e.z, d.x * shotSpd * 0.85, d.z * shotSpd * 0.85, {
          r: FOE_SHOT.frostR,
          life: FOE_SHOT.frostLife,
          hitFx,
          dmgMul,
        })
        e.shootCd = FOE_SHOT.frostCdBase + w.rng() * FOE_SHOT.frostCdJitter
      } else if (e.kind === 'spitter') {
        for (const t of [-0.14, 0.14]) {
          const c = Math.cos(t)
          const si = Math.sin(t)
          const dx = d.x * c - d.z * si
          const dz = d.x * si + d.z * c
          foeBullet(w, e.x, e.z, dx * shotSpd * 0.8, dz * shotSpd * 0.8, {
            r: FOE_SHOT.spitterR,
            life: FOE_SHOT.spitterLife,
            hitFx,
            dmgMul,
          })
        }
        e.shootCd = FOE_SHOT.spitterCdBase + w.rng() * FOE_SHOT.spitterCdJitter
      } else {
        const shots =
          e.kind === 'elite' ? 3 : wave >= FOE_SHOT.shooterDoubleFromWave ? 2 : 1
        const spread = e.kind === 'elite' ? 0.32 : FOE_SHOT.shooterSpread
        for (let s = 0; s < shots; s++) {
          const t = shots === 1 ? 0 : (s / (shots - 1) - 0.5) * spread
          const c = Math.cos(t)
          const si = Math.sin(t)
          const dx = d.x * c - d.z * si
          const dz = d.x * si + d.z * c
          foeBullet(w, e.x, e.z, dx * shotSpd, dz * shotSpd, {
            r: FOE_SHOT.r,
            life: FOE_SHOT.life,
            hitFx: e.kind === 'elite' ? hitFx : undefined,
            dmgMul,
          })
        }
        e.shootCd =
          e.kind === 'elite'
            ? 0.85 + w.rng() * 0.35
            : Math.max(
                FOE_SHOT.shooterCdMin,
                FOE_SHOT.shooterCdBase - wave * FOE_SHOT.shooterCdPerWave,
              )
      }
    }
  }
}

/** Per-kind movement: dash / kite / orbit — not straight lemmings. */
function tickFodderMove(w: World, e: Enemy, dt: number): void {
  if (e.kind === 'chest') return
  const lim = w.arena.half - e.r
  const speedMul = enemyMoveMul(e) * groundMoveMul(w, e.x, e.z) * (e.knockT > 0 ? 0.4 : 1)
  const toP = norm(w.player.x - e.x, w.player.z - e.z)
  const dist = Math.hypot(w.player.x - e.x, w.player.z - e.z)

  e.aiCd = Math.max(0, e.aiCd - dt)

  if (e.dashT > 0) {
    e.dashT = Math.max(0, e.dashT - dt)
    const next = moveWithObstacles(
      e.x,
      e.z,
      e.dashVx * dt,
      e.dashVz * dt,
      e.r,
      w.obstacles,
      lim,
    )
    e.x = next.x
    e.z = next.z
    return
  }

  let mx = toP.x
  let mz = toP.z
  let spd = e.speed

  switch (e.kind) {
    case 'chaser': {
      // 贴脸冲：间歇短突进
      if (e.aiCd <= 0 && dist < 9 && dist > 2.2) {
        const boost = FOE_SHOT.chaserDashBoost
        e.dashVx = toP.x * e.speed * boost
        e.dashVz = toP.z * e.speed * boost
        e.dashT = FOE_SHOT.chaserDashT
        e.aiCd = 1.6 + w.rng() * 1.1
        e.aiPhase = 1
        return
      }
      if (e.aiPhase === 1 && dist < 3.5) {
        // 贴身后略侧移
        mx = -toP.z * 0.55 + toP.x * 0.45
        mz = toP.x * 0.55 + toP.z * 0.45
      }
      break
    }
    case 'leech': {
      if (e.aiCd <= 0) {
        const side = w.rng() < 0.5 ? 1 : -1
        e.dashVx = (toP.x * 0.7 + -toP.z * side * 0.7) * e.speed * FOE_SHOT.leechDashMul
        e.dashVz = (toP.z * 0.7 + toP.x * side * 0.7) * e.speed * FOE_SHOT.leechDashMul
        e.dashT = 0.28
        e.aiCd = 1.1 + w.rng() * 0.8
        return
      }
      spd *= 1.08
      break
    }
    case 'brute': {
      // 蓄力冲锋
      if (e.aiCd <= 0 && dist < 11) {
        e.aiPhase = 1
        e.aiCd = 0.55
      }
      if (e.aiPhase === 1) {
        spd *= 0.35
        if (e.aiCd <= 0) {
          e.dashVx = toP.x * e.speed * 3.2
          e.dashVz = toP.z * e.speed * 3.2
          e.dashT = 0.42
          e.aiPhase = 0
          e.aiCd = 2.4 + w.rng() * 1.2
          return
        }
      } else {
        spd *= 0.85
      }
      break
    }
    case 'shooter': {
      const prefer = 7.2
      if (dist < prefer - 1.2) {
        mx = -toP.x
        mz = -toP.z
        spd *= 1.15
      } else if (dist > prefer + 1.8) {
        mx = toP.x
        mz = toP.z
      } else {
        const side = e.aiPhase % 2 === 0 ? 1 : -1
        mx = -toP.z * side
        mz = toP.x * side
        if (e.aiCd <= 0) {
          e.aiPhase += 1
          e.aiCd = 1.4 + w.rng() * 1.2
        }
      }
      break
    }
    case 'frost':
    case 'spitter': {
      const prefer = e.kind === 'frost' ? 6.5 : 7.5
      const side = e.aiPhase % 2 === 0 ? 1 : -1
      if (dist < prefer - 1.5) {
        mx = -toP.x * 0.6 + -toP.z * side * 0.8
        mz = -toP.z * 0.6 + toP.x * side * 0.8
      } else if (dist > prefer + 2) {
        mx = toP.x * 0.7 + -toP.z * side * 0.5
        mz = toP.z * 0.7 + toP.x * side * 0.5
      } else {
        mx = -toP.z * side
        mz = toP.x * side
      }
      if (e.aiCd <= 0) {
        e.aiPhase += 1
        e.aiCd = 1.8 + w.rng() * 1.5
      }
      break
    }
    case 'elite': {
      if (e.aiCd <= 0 && dist < 10) {
        if (w.rng() < 0.45) {
          e.dashVx = toP.x * e.speed * 2.6
          e.dashVz = toP.z * e.speed * 2.6
          e.dashT = 0.26
        } else {
          const side = w.rng() < 0.5 ? 1 : -1
          e.dashVx = -toP.z * side * e.speed * 2.2
          e.dashVz = toP.x * side * e.speed * 2.2
          e.dashT = 0.3
        }
        e.aiCd = 1.8 + w.rng() * 1.0
        return
      }
      if (dist < 4) {
        mx = -toP.z * 0.7 + toP.x * 0.3
        mz = toP.x * 0.7 + toP.z * 0.3
      }
      break
    }
    default:
      break
  }

  const len = Math.hypot(mx, mz) || 1
  mx /= len
  mz /= len
  const step = spd * speedMul * dt
  const next = moveWithObstacles(e.x, e.z, mx * step, mz * step, e.r, w.obstacles, lim)
  e.x = next.x
  e.z = next.z
}

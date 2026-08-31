import type { AudioClockPort } from '../shared/ports'
import { clamp, norm } from './math'
import { hitsObstacle, moveWithObstacles } from './map'
import { bossDefForWave, tickBoss } from './bosses'
import { hitEffectForKind } from './status'
import { enemyMoveMul, idleCombat, isFrozen, outgoingMul, tickEnemyStatuses } from './elemental'
import { displaceEnemyGround, groundMoveMul } from './weather'
import { bossHpMul, fodderHp, scaleEnemySpeed } from './waveScale'
import type { Enemy, EnemyKind, HitEffect, World } from './types'

/** Don't spawn until this many seconds into the wave. */
export const SPAWN_OPEN_SEC = 2.4
/** First elite not before this many seconds (also gated by phase progress). */
export const ELITE_FIRST_SEC = 18
/** Boss spawn time cap (clamped by track length). */
export const BOSS_AT_SEC = 78
/** Boss 最早也要等这么久（给脆皮练级窗）。 */
export const BOSS_EARLIEST_SEC = 52
/** 波 1～2：至少升到该等级才放 Boss（否则继续刷脆皮给经验）。 */
export const BOSS_MIN_LEVEL_EARLY = 2

type FodderSpec = {
  kind: EnemyKind
  hpMul: number
  r: number
  speed: number
  shootCd: number
}

type PhaseId = 'intro' | 'build' | 'spice' | 'pressure' | 'boss'

type PhaseCfg = {
  id: PhaseId
  /** Song progress [0,1) upper bound for this phase (boss overrides). */
  until: number
  maxBase: number
  maxPerWave: number
  /** Multiplier on base spawn interval (higher = slower). */
  rateMul: number
  packIdle: number
  packBusy: number
  elite: boolean
  /** Seconds between elites in this phase. */
  eliteEvery: number
  /** Relative roll weights for fodder kinds. */
  weights: Partial<Record<EnemyKind, number>>
}

/**
 * Phases scale with track length via waveTime/waveDuration.
 * Short tracks compress; long tracks stretch — types unlock by %.
 */
const PHASES: PhaseCfg[] = [
  {
    id: 'intro',
    until: 0.32,
    maxBase: 8,
    maxPerWave: 1,
    rateMul: 1.05,
    packIdle: 2,
    packBusy: 3,
    elite: false,
    eliteEvery: 99,
    weights: { chaser: 1 },
  },
  {
    id: 'build',
    until: 0.5,
    maxBase: 10,
    maxPerWave: 2,
    rateMul: 0.95,
    packIdle: 2,
    packBusy: 3,
    elite: false,
    eliteEvery: 99,
    weights: { chaser: 0.72, shooter: 0.28 },
  },
  {
    id: 'spice',
    until: 0.7,
    maxBase: 13,
    maxPerWave: 2,
    rateMul: 0.85,
    packIdle: 2,
    packBusy: 3,
    elite: true,
    eliteEvery: 22,
    weights: {
      chaser: 0.5,
      shooter: 0.28,
      brute: 0.08,
      frost: 0.08,
      spitter: 0.06,
    },
  },
  {
    id: 'pressure',
    until: 1,
    maxBase: 15,
    maxPerWave: 3,
    rateMul: 0.78,
    packIdle: 2,
    packBusy: 3,
    elite: true,
    eliteEvery: 16,
    weights: {
      chaser: 0.4,
      shooter: 0.22,
      brute: 0.08,
      frost: 0.12,
      spitter: 0.1,
      leech: 0.08,
    },
  },
]

const BOSS_PHASE: PhaseCfg = {
  id: 'boss',
  until: 1,
  maxBase: 9,
  maxPerWave: 2,
  rateMul: 1.1,
  packIdle: 2,
  packBusy: 2,
  elite: false,
  eliteEvery: 99,
  weights: {
    chaser: 0.55,
    shooter: 0.25,
    brute: 0.05,
    frost: 0.08,
    spitter: 0.07,
  },
}

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

export function spawnPhaseAt(w: World, bossAlive: boolean): PhaseCfg {
  if (bossAlive) return BOSS_PHASE
  const p = songProgress(w)
  for (const phase of PHASES) {
    if (p < phase.until) return phase
  }
  return PHASES[PHASES.length - 1]!
}

function pickSpawnPos(w: World): { x: number; z: number } {
  const half = w.arena.half - 1.2
  const wave = w.stats.wave
  const minR = 10.5
  const maxR = Math.min(18 + wave * 0.6, half * 0.85)
  for (let i = 0; i < 20; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = minR + w.rng() * Math.max(2.5, maxR - minR)
    const x = clamp(w.player.x + Math.cos(ang) * rad, -half, half)
    const z = clamp(w.player.z + Math.sin(ang) * rad, -half, half)
    if (Math.hypot(x - w.player.x, z - w.player.z) < minR * 0.72) continue
    if (hitsObstacle(x, z, 0.45, w.obstacles)) continue
    return { x, z }
  }
  const side = Math.floor(w.rng() * 4)
  if (side === 0) return { x: -half + w.rng() * half * 2, z: -half }
  if (side === 1) return { x: -half + w.rng() * half * 2, z: half }
  if (side === 2) return { x: -half, z: -half + w.rng() * half * 2 }
  return { x: half, z: -half + w.rng() * half * 2 }
}

function specForKind(w: World, kind: EnemyKind): FodderSpec {
  const wave = w.stats.wave
  const trash = (base: number, per: number) =>
    scaleEnemySpeed(base + Math.max(0, wave - 1) * per, wave, 'trash')
  const tank = (base: number, per: number) =>
    scaleEnemySpeed(base + Math.max(0, wave - 1) * per, wave, 'tank')
  switch (kind) {
    case 'frost':
      return {
        kind,
        hpMul: 1.35,
        r: 0.3,
        speed: trash(2.65, 0.12),
        shootCd: Math.max(0.4, 0.75 - wave * 0.03) + w.rng() * 0.45,
      }
    case 'spitter':
      return {
        kind,
        hpMul: 1.2,
        r: 0.29,
        speed: trash(2.85, 0.13),
        shootCd: Math.max(0.35, 0.6 - wave * 0.035) + w.rng() * 0.4,
      }
    case 'leech':
      return {
        kind,
        hpMul: 1.55,
        r: 0.34,
        speed: trash(4.45, 0.22),
        shootCd: 99,
      }
    case 'brute':
      // 高血高防：走慢、多抗一会，给玩家抽汁
      return {
        kind,
        hpMul: 6.2,
        r: 0.48,
        speed: tank(1.55, 0.04),
        shootCd: 0.35 + w.rng() * 0.7,
      }
    case 'shooter':
      return {
        kind,
        hpMul: 0.85,
        r: 0.28,
        speed: trash(3.05, 0.16),
        shootCd: Math.max(0.32, 0.55 - wave * 0.03) + w.rng() * 0.55,
      }
    default:
      // 垃圾追击：脆、略快，清完就该补
      return {
        kind: 'chaser',
        hpMul: 0.78,
        r: 0.3,
        speed: trash(4.25, 0.24),
        shootCd: 0.35 + w.rng() * 0.7,
      }
  }
}

/** Gate status / heavy fodder by wave number even if the phase wants them. */
function filterWeights(
  wave: number,
  weights: Partial<Record<EnemyKind, number>>,
): Array<{ kind: EnemyKind; w: number }> {
  const out: Array<{ kind: EnemyKind; w: number }> = []
  for (const [kind, wt] of Object.entries(weights) as [EnemyKind, number][]) {
    if (wt <= 0) continue
    if (kind === 'frost' || kind === 'spitter') {
      if (wave < 2) continue
    }
    if (kind === 'leech' || kind === 'brute') {
      if (wave < 3 && kind === 'leech') continue
      if (wave < 2 && kind === 'brute') continue
    }
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
  const soft = Math.max(1, Math.floor(maxEnemies * 0.16))
  return Math.min(wave >= 5 ? 3 : 2, soft)
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
          ? e.w * 3.2
          : e.kind === 'leech'
            ? e.w * 1.4
            : e.w * 0.7,
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

/** 每波一只可击碎宝箱；掉落三选一（属性 / 灌注）。 */
export function spawnWaveChest(w: World): void {
  if (w.enemies.some((e) => e.kind === 'chest')) return
  const wave = w.stats.wave
  const half = w.arena.half - 2.2
  let x = 0
  let z = 0
  let ok = false
  for (let i = 0; i < 24; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = 6.5 + w.rng() * 5.5
    x = clamp(Math.cos(ang) * rad, -half, half)
    z = clamp(Math.sin(ang) * rad, -half, half)
    if (Math.hypot(x - w.player.x, z - w.player.z) < 5) continue
    if (hitsObstacle(x, z, 0.55, w.obstacles)) continue
    ok = true
    break
  }
  if (!ok) {
    x = clamp(7.5 * (w.rng() < 0.5 ? 1 : -1), -half, half)
    z = clamp(5.5 * (w.rng() < 0.5 ? 1 : -1), -half, half)
  }
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * (3.8 + wave * 0.25)))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: 0.55,
    speed: 0,
    shootCd: 99,
    kind: 'chest',
    ...idleCombat('chest', wave),
    ...aiDefaults(w.rng),
    aiCd: 99,
  })
}

function spawnEnemy(
  w: World,
  phase: PhaseCfg,
  opts?: { preferTrash?: boolean; meatFull?: boolean },
): void {
  const { x, z } = pickSpawnPos(w)
  const wave = w.stats.wave
  const spec = rollFodder(w, phase, opts)
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * spec.hpMul))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: spec.r,
    speed: spec.speed,
    shootCd: spec.shootCd,
    kind: spec.kind,
    ...idleCombat(spec.kind, wave),
    ...aiDefaults(w.rng),
  })
}

/** Arm yellow-ring warn; elite entity appears when tele hits 0. */
function armElite(w: World): void {
  const { x, z } = pickSpawnPos(w)
  w.eliteTeleX = x
  w.eliteTeleZ = z
  w.eliteTeleMax = 1.6
  w.eliteTeleT = 1.6
  w.elitePending = true
  if (w.bossHintT <= 0.4) {
    w.bossHint = '精英出现'
    w.bossHintT = 1.6
  }
}

function commitElite(w: World): void {
  const x = w.eliteTeleX
  const z = w.eliteTeleZ
  const wave = w.stats.wave
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * (wave <= 1 ? 7.5 : 9 + wave * 0.55)))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: 0.52,
    speed: scaleEnemySpeed(2.15 + Math.max(0, wave - 1) * 0.06, wave, 'tank'),
    shootCd: Math.max(0.35, 0.6 - wave * 0.03),
    kind: 'elite',
    ...idleCombat('elite', wave),
    ...aiDefaults(w.rng),
    hurtFlash: 0.7,
  })
  w.elitePending = false
  w.eliteTeleT = 0
  w.eliteTeleMax = 0
}

function spawnBoss(w: World): void {
  const { x, z } = pickSpawnPos(w)
  const wave = w.stats.wave
  const def = bossDefForWave(wave)
  const hp = scaledHp(w, Math.floor(fodderHp(wave) * bossHpMul(wave, def.hpMul)))
  w.enemies.push({
    x,
    z,
    hp,
    maxHp: hp,
    r: def.r,
    speed: scaleEnemySpeed(def.speed + Math.max(0, wave - 1) * 0.05, wave, 'boss'),
    shootCd: Math.max(0.55, def.shootCd0 - wave * 0.04),
    kind: 'boss',
    bossId: def.id,
    ...idleCombat('boss', wave),
    ...aiDefaults(w.rng),
    aiCd: def.id === 'warden' ? 2.5 : def.id === 'caller' ? 3 : 2,
  })
  const intro: Record<string, string> = {
    warden: '节拍监守 · 躲开脉冲环',
    caller: '猎群号手 · 先清增援',
    hex: '镜咒法师 · 预判闪现',
    choir: '铁律合唱 · 读攻击窗',
    tyrant: '终曲暴君 · 半血会变相',
  }
  w.bossHint = intro[def.id] ?? def.name
  w.bossHintT = 2.4
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
    life: opts.life ?? 2.6,
    damage: 1,
    pierce: 0,
    friendly: false,
    r: opts.r ?? 0.2,
    hit: new Set(),
    hitFx: opts.hitFx,
    dmgMul: opts.dmgMul,
  })
}

export function tickEnemies(w: World, dt: number, clock: AudioClockPort): void {
  const wave = w.stats.wave
  w.spawnCd -= dt
  const bossAlive = w.enemies.some((e) => e.kind === 'boss' && e.hp > 0)
  const phase = spawnPhaseAt(w, bossAlive)
  const progress = songProgress(w)

  const stillSpawning =
    w.lootGraceT <= 0 &&
    w.waveTime >= SPAWN_OPEN_SEC &&
    (w.waveTime < w.waveDuration - 0.8 || bossAlive)

  const maxEnemies = Math.floor(
    (phase.maxBase + wave * phase.maxPerWave) * (w.runMeta?.hordeCapMul ?? 1),
  )
  const baseRate = Math.max(0.1, 0.42 - wave * 0.035)
  const fodderRate = baseRate * phase.rateMul * (w.runMeta?.hordeRateMul ?? 1)

  // 场上密度：维持脆皮为主；肉盾有软顶，补刷优先追击/射手
  const { trash, meat, fodder: fodderAlive } = countField(w)
  const softTarget = Math.max(4, Math.floor(maxEnemies * 0.52))
  const trashTarget = Math.max(3, Math.floor(maxEnemies * 0.4))
  const criticalFloor = Math.max(2, Math.floor(maxEnemies * 0.24))
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
    for (let i = 0; i < n; i++) {
      spawnEnemy(w, phase, { preferTrash, meatFull })
    }
    w.spawnCd = emptyField
      ? fodderRate * 0.28
      : criticallyLow || trashThin
        ? fodderRate * 0.42
        : depleted
          ? fodderRate * 0.62
          : fodderRate
  }

  w.eliteCd -= dt
  if (w.elitePending && w.eliteTeleT <= 0) {
    commitElite(w)
    clock.beep('elite_spawn')
  }
  if (
    phase.elite &&
    !bossAlive &&
    stillSpawning &&
    progress >= 0.28 &&
    w.waveTime >= ELITE_FIRST_SEC &&
    w.eliteCd <= 0 &&
    !w.elitePending &&
    !w.enemies.some((e) => e.kind === 'elite')
  ) {
    armElite(w)
    w.eliteCd = phase.eliteEvery
  }

  // Boss：偏曲中后段；早期波还要等级门槛，避免零强化裸打。
  const bossAt = Math.min(BOSS_AT_SEC, Math.max(BOSS_EARLIEST_SEC, w.waveDuration * 0.55))
  const bossLevelOk =
    w.stats.wave >= 3 ||
    w.stats.level >= BOSS_MIN_LEVEL_EARLY ||
    progress >= 0.82
  if (
    !w.bossSpawned &&
    bossLevelOk &&
    w.waveTime >= bossAt &&
    w.waveTime < w.waveDuration &&
    !w.enemies.some((e) => e.kind === 'boss')
  ) {
    spawnBoss(w)
    w.bossSpawned = true
    clock.beep('boss_spawn')
  }

  const shotSpd = 7 + wave * 0.35
  tickEnemyStatuses(w, dt)
  for (const e of w.enemies) {
    e.hurtFlash = Math.max(0, e.hurtFlash - dt)
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
          r: 0.24,
          life: 3.0,
          hitFx,
          dmgMul,
        })
        e.shootCd = 1.05 + w.rng() * 0.35
      } else if (e.kind === 'spitter') {
        for (const t of [-0.18, 0.18]) {
          const c = Math.cos(t)
          const si = Math.sin(t)
          const dx = d.x * c - d.z * si
          const dz = d.x * si + d.z * c
          foeBullet(w, e.x, e.z, dx * shotSpd * 0.8, dz * shotSpd * 0.8, {
            r: 0.22,
            life: 2.8,
            hitFx,
            dmgMul,
          })
        }
        e.shootCd = 0.95 + w.rng() * 0.4
      } else {
        const shots = e.kind === 'elite' ? 3 : wave >= 4 ? 2 : 1
        const spread = e.kind === 'elite' ? 0.38 : 0.22
        for (let s = 0; s < shots; s++) {
          const t = shots === 1 ? 0 : (s / (shots - 1) - 0.5) * spread
          const c = Math.cos(t)
          const si = Math.sin(t)
          const dx = d.x * c - d.z * si
          const dz = d.x * si + d.z * c
          foeBullet(w, e.x, e.z, dx * shotSpd, dz * shotSpd, {
            hitFx: e.kind === 'elite' ? hitFx : undefined,
            dmgMul,
          })
        }
        e.shootCd =
          e.kind === 'elite' ? 0.7 + w.rng() * 0.35 : Math.max(0.4, 1.2 - wave * 0.12)
      }
    }
  }
}

/** Per-kind movement: dash / kite / orbit — not straight lemmings. */
function tickFodderMove(w: World, e: Enemy, dt: number): void {
  if (e.kind === 'chest') return
  const lim = w.arena.half - e.r
  const speedMul = enemyMoveMul(e) * groundMoveMul(w, e.x, e.z)
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
        const boost = 2.4 + w.rng() * 0.6
        e.dashVx = toP.x * e.speed * boost
        e.dashVz = toP.z * e.speed * boost
        e.dashT = 0.22
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
        e.dashVx = (toP.x * 0.7 + -toP.z * side * 0.7) * e.speed * 2.8
        e.dashVz = (toP.z * 0.7 + toP.x * side * 0.7) * e.speed * 2.8
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

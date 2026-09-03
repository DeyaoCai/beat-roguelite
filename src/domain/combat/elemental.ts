import { ARMOR_BY_KIND, ELEM_RULES, FOE_SHOT } from '../../content/rules'
import { moveWithObstacles } from './map'
import { sampleGround } from './weather'
import type { ElemSource, Enemy, EnemyKind, World } from './types'
import { waveArmorBonus, waveAtkMul } from './waveScale'

export const ELEM_MAX_STACKS = ELEM_RULES.maxStacks
const AMP_MUL = ELEM_RULES.ampMul
const WEAK_MUL = ELEM_RULES.weakMul
const BREAK_STRIP = ELEM_RULES.breakStrip
const AMP_SEC = ELEM_RULES.ampSec
const BREAK_SEC = ELEM_RULES.breakSec
const WEAK_SEC = ELEM_RULES.weakSec
const FREEZE_SEC = ELEM_RULES.freezeSec
const EXPLODE_R = ELEM_RULES.explodeR
const EXPLODE_LOCK = ELEM_RULES.explodeLock

const EMPTY_STACKS = (): Record<ElemSource, number> => ({
  flame: 0,
  orb: 0,
  aura: 0,
  chain: 0,
  star: 0,
})

export function armorForKind(kind: EnemyKind): number {
  return ARMOR_BY_KIND[kind] ?? ARMOR_BY_KIND.chaser ?? 0.02
}

export function idleCombat(kind: EnemyKind, wave = 1, metaArmor?: number) {
  const base = metaArmor ?? armorForKind(kind)
  return {
    hurtFlash: 0,
    armor: Math.min(ELEM_RULES.armorCap, base + waveArmorBonus(wave)),
    slowT: 0,
    slowMul: 1,
    freezeT: 0,
    ampT: 0,
    breakT: 0,
    weakT: 0,
    explodeLockT: 0,
    elemStacks: EMPTY_STACKS(),
    atkMul: waveAtkMul(wave),
    knockT: 0,
    knockVx: 0,
    knockVz: 0,
  }
}

export function incomingMul(e: Enemy): number {
  const armor = e.breakT > 0 ? Math.max(0, e.armor - BREAK_STRIP) : e.armor
  return (1 - armor) * (e.ampT > 0 ? AMP_MUL : 1)
}

export function outgoingMul(e: Enemy): number {
  const base = e.atkMul > 0 ? e.atkMul : 1
  const role = e.meta.role
  const hit =
    role === 'boss'
      ? FOE_SHOT.bossHitMul
      : role === 'elite'
        ? FOE_SHOT.eliteHitMul
        : FOE_SHOT.fodderHitMul
  return base * hit * (e.weakT > 0 ? WEAK_MUL : 1)
}

export function enemyMoveMul(e: Enemy): number {
  if (e.freezeT > 0) return 0
  return e.slowT > 0 ? e.slowMul : 1
}

export function isFrozen(e: Enemy): boolean {
  return e.freezeT > 0
}

function crowdDur(e: Enemy, sec: number): number {
  if (e.kind === 'boss') return sec * 0.4
  if (e.kind === 'elite') return sec * 0.55
  return sec
}

function crowdPush(e: Enemy, dist: number): number {
  if (e.kind === 'boss') return dist * 0.35
  if (e.kind === 'elite') return dist * 0.55
  return dist
}

const KNOCK_SLIDE = 0.22

export function tickEnemyKnock(w: World, e: Enemy, dt: number): void {
  if (e.knockT <= 0) {
    e.knockVx = 0
    e.knockVz = 0
    return
  }
  e.knockT = Math.max(0, e.knockT - dt)
  if (e.freezeT > 0) {
    if (e.knockT <= 0) {
      e.knockVx = 0
      e.knockVz = 0
    }
    return
  }
  const lim = w.arena.half - e.r
  const next = moveWithObstacles(
    e.x,
    e.z,
    e.knockVx * dt,
    e.knockVz * dt,
    e.r,
    w.obstacles,
    lim,
  )
  e.x = next.x
  e.z = next.z
  if (e.knockT <= 0) {
    e.knockVx = 0
    e.knockVz = 0
  }
}

function procActive(e: Enemy, src: ElemSource): boolean {
  if (src === 'flame') return e.breakT > 0
  if (src === 'orb') return e.explodeLockT > 0
  if (src === 'aura') return e.freezeT > 0
  if (src === 'chain') return e.ampT > 0
  return e.weakT > 0
}

export function tickEnemyStatuses(w: World, dt: number): void {
  for (const e of w.enemies) {
    if (e.slowT > 0) {
      e.slowT = Math.max(0, e.slowT - dt)
      if (e.slowT <= 0) e.slowMul = 1
    }
    if (e.freezeT > 0) e.freezeT = Math.max(0, e.freezeT - dt)
    if (e.ampT > 0) e.ampT = Math.max(0, e.ampT - dt)
    if (e.breakT > 0) e.breakT = Math.max(0, e.breakT - dt)
    if (e.weakT > 0) e.weakT = Math.max(0, e.weakT - dt)
    if (e.explodeLockT > 0) e.explodeLockT = Math.max(0, e.explodeLockT - dt)
  }
}

export function applyAuraSlow(w: World, e: Enemy): void {
  const mul = w.loadout.auraSlowMul
  const dur = w.loadout.auraSlowT
  e.slowT = Math.max(e.slowT, dur)
  e.slowMul = Math.min(e.slowMul, mul)
}

export function applyKnockback(w: World, e: Enemy): void {
  let dist = crowdPush(e, w.loadout.knockback)
  if (dist <= 0) return
  if (sampleGround(w, e.x, e.z).ice) dist *= 1.4
  let dx = e.x - w.player.x
  let dz = e.z - w.player.z
  let len = Math.hypot(dx, dz)
  if (len < 0.08) {
    dx = w.player.facingX
    dz = w.player.facingZ
    len = Math.hypot(dx, dz) || 1
  }
  dx /= len
  dz /= len
  const fresh = e.knockT <= 0.04
  const speed = dist / KNOCK_SLIDE
  e.knockVx = dx * speed
  e.knockVz = dz * speed
  e.knockT = KNOCK_SLIDE
  const lim = w.arena.half - e.r
  const snap = dist * 0.35
  const next = moveWithObstacles(e.x, e.z, dx * snap, dz * snap, e.r, w.obstacles, lim)
  e.x = next.x
  e.z = next.z
  if (fresh || w.loadout.graft.knockback) {
    w.fxPops.push({
      x: e.x,
      z: e.z,
      kind: 'knock',
      dirX: dx,
      dirZ: dz,
      life: 0.2,
      maxLife: 0.2,
    })
    if (w.fxPops.length > 16) w.fxPops.splice(0, w.fxPops.length - 16)
  }
}

export type ElemProc = { explode: { x: number; z: number; r: number; dmg: number } } | null

const ELEM_SRCS: ElemSource[] = ['flame', 'orb', 'aura', 'chain', 'star']

/** Stack this 元素伤. Returns explode splash if 火 proc'd. */
export function noteElemHit(w: World, e: Enemy, src: ElemSource, hitDmg: number): ElemProc {
  if (!w.loadout.elem[src]) return null
  if (procActive(e, src)) return null
  e.elemStacks[src] += 1
  if (e.elemStacks[src] < ELEM_MAX_STACKS) return null
  e.elemStacks[src] = 0
  if (src === 'flame') {
    e.breakT = BREAK_SEC
    return null
  }
  if (src === 'chain') {
    e.ampT = AMP_SEC
    return null
  }
  if (src === 'star') {
    e.weakT = WEAK_SEC
    return null
  }
  if (src === 'aura') {
    e.freezeT = crowdDur(e, FREEZE_SEC)
    return null
  }
  e.explodeLockT = EXPLODE_LOCK
  return {
    explode: {
      x: e.x,
      z: e.z,
      r: EXPLODE_R,
      dmg: Math.max(0.4, hitDmg * 0.85),
    },
  }
}

/** 已学的元素伤都叠；不限这下是哪门打的。 */
export function noteOwnedElemHits(w: World, e: Enemy, hitDmg: number): ElemProc {
  let explode: ElemProc = null
  for (const src of ELEM_SRCS) {
    const proc = noteElemHit(w, e, src, hitDmg)
    if (proc?.explode) explode = proc
  }
  return explode
}

import { moveWithObstacles } from './map'
import { sampleGround } from './weather'
import type { ElemSource, Enemy, EnemyKind, World } from './types'
import { waveArmorBonus, waveAtkMul } from './waveScale'

export const ELEM_MAX_STACKS = 3
const AMP_MUL = 1.32
const WEAK_MUL = 0.65
const BREAK_STRIP = 0.25
const AMP_SEC = 3.2
const BREAK_SEC = 3.2
const WEAK_SEC = 3.2
const BLEED_SEC = 2.6
const BLEED_DPS = 0.5
const FREEZE_SEC = 1.35
const EXPLODE_R = 2.35
const EXPLODE_LOCK = 0.22

const EMPTY_STACKS = (): Record<ElemSource, number> => ({
  flame: 0,
  orb: 0,
  aura: 0,
  chain: 0,
  star: 0,
  orbit: 0,
})

export function armorForKind(kind: EnemyKind): number {
  if (kind === 'boss') return 0.42
  if (kind === 'elite') return 0.36
  if (kind === 'brute') return 0.3
  if (kind === 'chest') return 0.22
  if (kind === 'leech') return 0.1
  if (kind === 'frost' || kind === 'spitter') return 0.06
  if (kind === 'shooter') return 0.03
  return 0.02
}

export function idleCombat(kind: EnemyKind, wave = 1) {
  return {
    hurtFlash: 0,
    armor: Math.min(0.5, armorForKind(kind) + waveArmorBonus(wave)),
    slowT: 0,
    slowMul: 1,
    freezeT: 0,
    ampT: 0,
    breakT: 0,
    weakT: 0,
    explodeLockT: 0,
    orbitHitT: 0,
    bleedT: 0,
    bleedDps: 0,
    bleedAcc: 0,
    elemStacks: EMPTY_STACKS(),
    atkMul: waveAtkMul(wave),
  }
}

export function incomingMul(e: Enemy): number {
  const armor = e.breakT > 0 ? Math.max(0, e.armor - BREAK_STRIP) : e.armor
  return (1 - armor) * (e.ampT > 0 ? AMP_MUL : 1)
}

export function outgoingMul(e: Enemy): number {
  const base = e.atkMul > 0 ? e.atkMul : 1
  return base * (e.weakT > 0 ? WEAK_MUL : 1)
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
  if (e.kind === 'boss') return dist * 0.28
  if (e.kind === 'elite') return dist * 0.45
  return dist
}

function procActive(e: Enemy, src: ElemSource): boolean {
  if (src === 'flame') return e.breakT > 0
  if (src === 'orb') return e.explodeLockT > 0
  if (src === 'aura') return e.freezeT > 0
  if (src === 'chain') return e.ampT > 0
  if (src === 'orbit') return e.bleedT > 0
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
    if (e.orbitHitT > 0) e.orbitHitT = Math.max(0, e.orbitHitT - dt)
    if (e.bleedT > 0) {
      e.bleedT = Math.max(0, e.bleedT - dt)
      e.bleedAcc += e.bleedDps * dt
      while (e.bleedAcc >= 0.4 && e.hp > 0) {
        e.bleedAcc -= 0.4
        e.hp -= 0.4 * incomingMul(e)
        e.hurtFlash = 0.1
      }
      if (e.bleedT <= 0) {
        e.bleedDps = 0
        e.bleedAcc = 0
      }
    }
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
  const lim = w.arena.half - e.r
  const next = moveWithObstacles(
    e.x,
    e.z,
    w.player.facingX * dist,
    w.player.facingZ * dist,
    e.r,
    w.obstacles,
    lim,
  )
  e.x = next.x
  e.z = next.z
}

export type ElemProc = { explode: { x: number; z: number; r: number; dmg: number } } | null

/** Stack this weapon's 元素伤. Returns explode splash if 火 proc'd. */
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
  if (src === 'orbit') {
    e.bleedT = crowdDur(e, BLEED_SEC)
    e.bleedDps = BLEED_DPS
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

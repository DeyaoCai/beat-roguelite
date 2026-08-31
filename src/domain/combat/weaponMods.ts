import type { DamageKind } from './types'

/**
 * Per-hit context for weapon situational multipliers.
 * Applied in damageEnemy after weather / before crit.
 */
export type WeaponHitRole =
  | 'primary'
  | 'split'
  | 'splash'
  | 'chainJump'
  | 'graft'
  | 'pulse'

export type WeaponHitCtx = {
  /** Enemies this attack wave hits (AOE / cone / ring). */
  targets?: number
  /** Distance from cast origin (player / blast / prior hop) to this enemy. */
  dist?: number
  /** Soft max for normalizing dist (weapon reach). */
  range?: number
  /** 0-based hop for chains / pierce sequence. */
  hop?: number
  /** Which part of the weapon cast this hit is. */
  role?: WeaponHitRole
  /**
   * Extra situational bump: elemental status already on target,
   * knockback/slow/split/etc. packing on this hit, Perfect pulse, …
   */
  special?: boolean
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function rangeNorm(ctx: WeaponHitCtx): number | null {
  if (ctx.dist == null || ctx.range == null || ctx.range <= 0.01) return null
  return clamp(ctx.dist / ctx.range, 0, 1.35)
}

function targetMul(targets: number | undefined, sweet: number, diluteAfter: number, dilute: number): number {
  const n = Math.max(1, targets ?? 1)
  if (n <= sweet) return 1 + (sweet - n) * 0.06
  if (n <= diluteAfter) return 1
  return Math.max(0.72, 1 - (n - diluteAfter) * dilute)
}

/**
 * Weapon situational coefficient (成算一层).
 * Shapes each door's job: cone wants focus+close, chain wants hops, orb wants mid single, etc.
 */
export function weaponHitMul(kind: DamageKind, ctx?: WeaponHitCtx | null): number {
  if (!ctx) return 1
  const role = ctx.role ?? 'primary'
  const rn = rangeNorm(ctx)
  let mul = 1

  switch (kind) {
    case 'flame':
    case 'slash': {
      // 风息：贴脸少目标更疼；扇面扫多人 / 锥尖衰减
      mul *= targetMul(ctx.targets, 1, 3, 0.07)
      if (rn != null) {
        if (rn < 0.4) mul *= 1.12
        else if (rn > 0.9) mul *= 0.82
      }
      if (role === 'pulse') mul *= 1.06
      break
    }
    case 'orb': {
      // 火球：中距单体；分裂 / 嫁接次伤打折
      if (role === 'split' || role === 'graft') mul *= 0.78
      else {
        mul *= targetMul(ctx.targets, 1, 1, 0.12)
        if (rn != null) {
          if (rn < 0.15) mul *= 0.92
          else if (rn >= 0.25 && rn <= 0.7) mul *= 1.1
          else if (rn > 1.05) mul *= 0.88
        }
      }
      if (role === 'pulse') mul *= 1.05
      break
    }
    case 'aura': {
      // 霜环：圈内人越多略赚；贴身略强
      const n = Math.max(1, ctx.targets ?? 1)
      mul *= clamp(0.9 + Math.min(4, n - 1) * 0.04, 0.9, 1.12)
      if (rn != null && rn < 0.45) mul *= 1.06
      if (role === 'pulse') mul *= 1.05
      break
    }
    case 'chain': {
      // 雷链：首跳满额，越跳越弱；跳得近略强
      const hop = Math.max(0, ctx.hop ?? (role === 'chainJump' ? 1 : 0))
      mul *= Math.max(0.55, 1 - hop * 0.12)
      if (rn != null && rn < 0.35) mul *= 1.08
      if (role === 'graft') mul *= 0.85
      if (role === 'pulse') mul *= 1.05
      break
    }
    case 'star': {
      // 落岩：落点主伤；溅射随距中心衰减；多人溅射略稀释
      if (role === 'splash' || role === 'graft') {
        mul *= 0.72
        if (rn != null) mul *= clamp(1.05 - rn * 0.45, 0.55, 1)
        mul *= targetMul(ctx.targets, 2, 4, 0.05)
      } else {
        mul *= 1.08
        if (rn != null && rn < 0.35) mul *= 1.06
      }
      if (role === 'pulse') mul *= 1.05
      break
    }
    case 'orbit': {
      // 环刃：绕身中距；扫到多人略稀释；Perfect 扫圈略强
      mul *= targetMul(ctx.targets, 1, 2, 0.06)
      if (rn != null) {
        if (rn < 0.55) mul *= 0.94
        else if (rn > 1.15) mul *= 0.9
        else mul *= 1.06
      }
      if (role === 'pulse') mul *= 1.08
      break
    }
    case 'fever':
      mul *= 1
      break
    default:
      break
  }

  if (ctx.special) mul *= 1.08
  return clamp(mul, 0.5, 1.35)
}

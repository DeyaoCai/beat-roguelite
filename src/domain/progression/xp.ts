import { XP_CURVE } from '../../content/rules'

/** XP / level curve (run-scoped). Coeffs in content/rules/progressionCurve. */

export function xpToNextFor(level: number): number {
  const c = XP_CURVE
  return c.toNextBase + Math.max(0, level - 1) * c.toNextPerLevel
}

export function xpForKill(mult: number, wave: number): number {
  const c = XP_CURVE
  return Math.max(
    1,
    Math.floor(
      (c.killBase + wave * c.killPerWave) *
        (c.killMultBase + c.killMultPerHeat * Math.max(1, mult)),
    ),
  )
}

export function xpForHit(mult: number): number {
  const c = XP_CURVE
  return Math.max(0, Math.floor(1 * Math.max(1, mult * c.hitMultFactor)))
}

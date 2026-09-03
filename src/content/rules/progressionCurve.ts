/** 经验曲线系数（公式在 domain/progression/xp.ts）。 */
export const XP_CURVE = {
  toNextBase: 42,
  toNextPerLevel: 26,
  killBase: 6,
  killPerWave: 1,
  killMultBase: 0.85,
  killMultPerHeat: 0.08,
  hitMultFactor: 0.4,
  bossXpMul: 4,
  eliteXpMul: 2,
} as const

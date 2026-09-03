/**
 * 敌弹手感：小控制。小兵擦弹 / 接触要叠几下才掉一心；精英接近一口一心，Boss 一口一心以上。
 */
export const FOE_SHOT = {
  spdBase: 5.5,
  spdPerWave: 0.2,
  r: 0.12,
  frostR: 0.14,
  spitterR: 0.13,
  life: 2.1,
  frostLife: 2.35,
  spitterLife: 2.2,
  /** 相对 1 心；再乘 waveAtkMul。 */
  fodderHitMul: 0.4,
  eliteHitMul: 0.9,
  bossHitMul: 1.2,
  shooterDoubleFromWave: 6,
  shooterSpread: 0.18,
  shooterCdBase: 1.45,
  shooterCdPerWave: 0.08,
  shooterCdMin: 0.75,
  frostCdBase: 1.25,
  frostCdJitter: 0.4,
  spitterCdBase: 1.15,
  spitterCdJitter: 0.45,
  chaserDashBoost: 1.75,
  chaserDashT: 0.18,
  leechDashMul: 2.2,
} as const

/** 波次成长系数（公式在 domain/combat/waveScale.ts）。 */
export const WAVE_SCALE = {
  atkPerWave: 0.11,
  atkExtraAfter5: 0.08,

  speedPerWave: 0.04,
  speedExtraAfter5: 0.025,

  tankSpeedPerWave: 0.018,
  tankSpeedExtraAfter5: 0.012,

  armorFromWave: 3,
  armorPerWave: 0.045,
  armorCap: 0.26,

  fodderHpBase: 5,
  fodderHpPerWave: 1,
  fodderHpExtraFromWave: 1,
  fodderHpExtraStartWave: 4,
  fodderHpRampFromWave: 6,
  fodderHpRampPer: 0.12,

  bossRampBase: 0.72,
  bossRampPerWave: 0.07,
  bossEndlessPerWave: 0.08,
  bossFullAtWave: 5,
} as const

/** 精英相对 fodderHp 的血量倍率。宝箱白给，一口碎。 */
export const SPECIAL_HP = {
  chestHp: 1,
  eliteMulWave1: 8.5,
  eliteMulBase: 10.5,
  eliteMulPerWave: 0.65,
} as const

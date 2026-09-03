/** 地面掉落 / 磁铁 / 击杀掉落量。 */
export const DROP_RULES = {
  pickupReach: 1.45,
  magnetPull: 11,
  relicMagnetMul: 0.55,
  /** 商店自动拾取：吸入速度倍率。 */
  autoPullMul: 2.4,
  lifeXp: 42,
  lifeOther: 28,
  relicLifePad: 16,

  chestGoldBase: 3,
  chestGoldPerWave: 1,
  chestLootGrace: 2.5,

  bossGoldBase: 28,
  bossGoldPerWave: 6,
  bossLootGrace: 8,

  eliteGoldBase: 10,
  eliteGoldPerWave: 2,
  eliteLootGrace: 5,

  trashGoldBase: 1,
  trashGoldBonusChance: 0.35,
  trashBruteBonus: 1,
} as const

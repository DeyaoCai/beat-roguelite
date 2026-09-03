/**
 * 商店叠层 / 祝福·契约战斗向乘数。
 * 货架文案与价格仍在 content/meta.ts。
 */

export const SHOP_STACKS = {
  speedPerStack: 0.1,
  heatDecayPerStack: 0.82,
  radiusShrinkPerStack: 0.1,
  radiusFloor: 0.55,
  hpPerStack: 1,
  luckPerStack: 1,
  damagePerStack: 0.08,
  hastePerStack: -0.03,
  armorPerStack: 0.04,
  dodgePerStack: 0.04,
  critPerStack: 0.04,
  growthPerStack: 0.05,
  magnetPerStack: 1.2,
  reachPerStack: 0.05,
  areaPerStack: 0.06,
  regenPerStack: 0.1,
  stackMax: 3,
  startFuseMax: 4,
} as const

export const BLESSING_COMBAT = {
  feverGainMul: 1.22,
  glassDamageMul: 1.1,
  goldfingerBankMul: 1.5,
  /** 败局入袋比例（胜局 1.0）。 */
  lossBankFrac: 0.5,
} as const

export const CONTRACT_COMBAT = {
  hordeCapMul: 1.35,
  hordeRateMul: 0.72,
  ironHpMul: 1.28,
  /** 盲抽开局人物属性档。 */
  wildGrade: 1,
} as const

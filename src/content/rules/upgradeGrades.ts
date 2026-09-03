import { FEVER_RULES } from './fever'

/**
 * 升级档位效果（Ⅰ/Ⅱ/Ⅲ）与 loadout 软顶。
 * 同一轴加算：(Σ add + 1) * base * modify；范围轴再开方（按面积）。
 * resolveLoadout 读表；文案仍在 upgradePool / GRADE_DETAILS。
 */

export type Grade3 = readonly [number, number, number]

export const LOADOUT_BASE = {
  magnetR: 4.5,
  knockback: 0.48,
  /** 风息被吃掉后是单下推，不是锥 tick，加一截才看得出来。 */
  graftKnockMul: 2.35,
  auraSlowMul: 0.72,
  judgePerfectWin: 0.1,
  judgeGoodWin: 0.24,
  feverActiveSec: FEVER_RULES.activeSec,
  comboBreakKeep: 0.5,
  comboDmgCap: FEVER_RULES.defaultComboCap,
  critDamage: 1.5,
} as const

export const LOADOUT_CAPS = {
  critChance: 0.45,
  critDamage: 2.5,
  xpMul: 1.4,
  magnetR: 12,
  armorDr: 0.4,
  dodgeChance: 0.4,
  /** 锥半角几何顶（整圆）；范围叠不加玩法锁。 */
  meleeHalfAngle: Math.PI,
  /** 冷却 / 间隔轴 (Σ add + 1) 的软底，避免叠穿。 */
  cdFactorMin: 0.4,
  heatDecayMin: 0.25,
  /** 范围面积因数开方前的软底。 */
  rangeAreaMin: 0.25,
  /** 人物施法距离软顶。范围不锁，叠了铺场割草。 */
  castReach: 1.75,
} as const

/**
 * 同一轴加算：(Σ add + 1) * base * modify。
 * 冷却 / 回落类 add 为负。生命、护甲等本来就是扁值，直接加。
 */
export function stackedFactor(add: number, min = Number.NEGATIVE_INFINITY): number {
  return Math.max(min, 1 + add)
}

/** 范围按面积叠：线性尺寸 = √(Σ add + 1) * base * modify。 */
export function stackedRangeFactor(add: number, areaMin = 0.25): number {
  return Math.sqrt(Math.max(areaMin, 1 + add))
}

/** 人物属性 / 本门方向 / 专项的档位加值（Ⅰ/Ⅱ/Ⅲ）。 */
export const UPGRADE_GRADES = {
  damage: { add: [0.1, 0.18, 0.28] as Grade3 },
  haste: { add: [-0.03, -0.07, -0.12] as Grade3 },
  fire_rate: { add: [-0.06, -0.12, -0.2] as Grade3 },
  move_speed: { add: [0.06, 0.12, 0.2] as Grade3 },
  max_hp: { add: [1, 1, 2] as Grade3 },
  hp_regen: { add: [0.12, 0.2, 0.32] as Grade3 },
  armor: { add: [0.05, 0.08, 0.12] as Grade3 },
  dodge: { add: [0.05, 0.08, 0.12] as Grade3 },
  critChance: { add: [0.05, 0.08, 0.12] as Grade3 },
  critDamage: { add: [0, 0.12, 0.28] as Grade3 },
  growth: { add: [0.05, 0.1, 0.16] as Grade3 },
  magnet: { add: [1.5, 2.5, 4] as Grade3 },
  cast_reach: { add: [0.06, 0.12, 0.2] as Grade3 },
  cast_area: { add: [0.08, 0.14, 0.22] as Grade3 },
  heat_decay: { add: [-0.12, -0.22, -0.35] as Grade3 },
  heat_cap: { addFlat: 15 },
  melee_range: {
    rangeAdd: [0.06, 0.12, 0.18] as Grade3,
    angleAdd: [0.05, 0.09, 0.13] as Grade3,
  },
  melee_power: { knockbackAdd: 0.12 },
  aura_widen: { add: [0.06, 0.12, 0.2] as Grade3 },
  aura_slow: { add: -0.1 },
  chain_reach: {
    reachAdd: [0.08, 0.14, 0.22] as Grade3,
    jumpAdd: [0.08, 0.16, 0.26] as Grade3,
  },
  star_rain: { add: [-0.08, -0.14, -0.22] as Grade3 },
  star_crater: { lifeAdd: 0.6, sizeAdd: 0.2 },
  star_scale: { add: [0.06, 0.1, 0.14] as Grade3 },
  skill_dmg: { add: [0.1, 0.16, 0.24] as Grade3 },
  skill_cd: { add: [-0.03, -0.06, -0.1] as Grade3 },
  rhythm_window: { add: 0.18 },
  rhythm_fever_gain: { add: 0.22 },
  rhythm_fever_hold: { addSec: 1.5 },
} as const

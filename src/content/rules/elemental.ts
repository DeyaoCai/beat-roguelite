/** 元素叠层与种类基础护甲。 */
export const ELEM_RULES = {
  maxStacks: 3,
  ampMul: 1.32,
  weakMul: 0.65,
  breakStrip: 0.25,
  ampSec: 3.2,
  breakSec: 3.2,
  weakSec: 3.2,
  freezeSec: 1.35,
  explodeR: 2.35,
  explodeLock: 0.22,
  armorCap: 0.5,
} as const

export const ARMOR_BY_KIND: Record<string, number> = {
  boss: 0.48,
  elite: 0.42,
  brute: 0.36,
  chest: 0,
  leech: 0.12,
  frost: 0.08,
  spitter: 0.08,
  shooter: 0.03,
  chaser: 0.02,
}

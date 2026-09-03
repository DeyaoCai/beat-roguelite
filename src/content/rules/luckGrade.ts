/** 幸运 → 三选档位权重（Ⅰ / Ⅱ / Ⅲ）。 */
export const LUCK_GRADE = {
  luckCap: 14,
  baseW1: 0.78,
  baseW2: 0.18,
  baseW3: 0.04,
  w1PerLuck: -0.03,
  w2PerLuck: 0.018,
  w3PerLuck: 0.02,
  w1Floor: 0.22,
} as const

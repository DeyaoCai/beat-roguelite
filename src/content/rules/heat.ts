/** 热度 / Fever 槽底数。 */
export const HEAT_RULES = {
  max: 100,
  decayPerSec: 6,
  hitGain: 0.85,
  killGain: 6,
  perfectGain: 10,
  goodGain: 5,
  missLoss: 4,
  hurtLoss: 12,
} as const

/** 遗物数值（池 id 仍在 upgradePool）。 */
export const RELIC_IDS = [
  'relic_ward',
  'relic_leech',
  'relic_carapace',
  'relic_greed',
  'relic_ember',
  'relic_spark',
] as const

export const RELIC_RULES = {
  cap: 3,
  carapaceDr: 0.06,
  carapaceStackCap: 5,
  carapaceDrCap: 0.3,
  shieldRegenSec: 8,
  leechPerHit: 0.045,
  leechHitCap: 0.16,
  leechBankCap: 1.15,
  leechDrainPerSec: 0.55,
  greedGoldMul: 1.4,
  emberDashHeatMul: 0.55,
  dashHeatBase: 16,
  dashHeatMin: 6,
  sparkFever: 40,
} as const

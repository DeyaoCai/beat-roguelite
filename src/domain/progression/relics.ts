import { RELIC_IDS as RELIC_ID_LIST, RELIC_RULES } from '../../content/rules'
import type { OwnedUpgrade, UpgradeId } from './upgrades'

export const RELIC_IDS = RELIC_ID_LIST
export type RelicId = (typeof RELIC_IDS)[number]

export const RELIC_CAP = RELIC_RULES.cap
export const CARAPACE_DR = RELIC_RULES.carapaceDr
export const CARAPACE_STACK_CAP = RELIC_RULES.carapaceStackCap
export const SHIELD_REGEN_SEC = RELIC_RULES.shieldRegenSec
export const LEECH_PER_HIT = RELIC_RULES.leechPerHit
export const LEECH_HIT_CAP = RELIC_RULES.leechHitCap
export const LEECH_BANK_CAP = RELIC_RULES.leechBankCap
export const LEECH_DRAIN_PER_SEC = RELIC_RULES.leechDrainPerSec
/** 拾荒：本局金币获取。 */
export const GREED_GOLD_MUL = RELIC_RULES.greedGoldMul
/** 余烬：位移闪避耗热。 */
export const EMBER_DASH_HEAT_MUL = RELIC_RULES.emberDashHeatMul
/** 起势：每波开场 Fever 保底。 */
export const SPARK_FEVER = RELIC_RULES.sparkFever

export function isRelicId(id: UpgradeId): id is RelicId {
  return (RELIC_IDS as readonly string[]).includes(id)
}

export function ownedRelics(owned: OwnedUpgrade[]): RelicId[] {
  return RELIC_IDS.filter((id) => owned.some((o) => o.id === id))
}

export function hasRelic(owned: OwnedUpgrade[], id: RelicId): boolean {
  return owned.some((o) => o.id === id)
}

export function atRelicCap(owned: OwnedUpgrade[]): boolean {
  return ownedRelics(owned).length >= RELIC_CAP
}

export function carapaceStacksForWave(wave: number): number {
  return Math.min(CARAPACE_STACK_CAP, Math.max(0, wave - 1))
}

export function carapaceDr(stacks: number): number {
  return Math.min(RELIC_RULES.carapaceDrCap, stacks * CARAPACE_DR)
}

export function greedGoldMul(owned: OwnedUpgrade[]): number {
  return hasRelic(owned, 'relic_greed') ? GREED_GOLD_MUL : 1
}

export function dashHeatCost(
  owned: OwnedUpgrade[],
  base = RELIC_RULES.dashHeatBase,
): number {
  if (!hasRelic(owned, 'relic_ember')) return base
  return Math.max(RELIC_RULES.dashHeatMin, Math.ceil(base * EMBER_DASH_HEAT_MUL))
}

export function sparkFeverFloor(owned: OwnedUpgrade[]): number {
  return hasRelic(owned, 'relic_spark') ? SPARK_FEVER : 0
}

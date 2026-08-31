import type { OwnedUpgrade, UpgradeId } from './upgrades'

export const RELIC_IDS = [
  'relic_ward',
  'relic_leech',
  'relic_carapace',
  'relic_greed',
  'relic_ember',
  'relic_spark',
] as const
export type RelicId = (typeof RELIC_IDS)[number]

export const RELIC_CAP = 3
export const CARAPACE_DR = 0.06
export const CARAPACE_STACK_CAP = 5
export const SHIELD_REGEN_SEC = 8
export const LEECH_PER_HIT = 0.045
export const LEECH_HIT_CAP = 0.16
export const LEECH_BANK_CAP = 1.15
export const LEECH_DRAIN_PER_SEC = 0.55
/** 拾荒：本局金币获取。 */
export const GREED_GOLD_MUL = 1.4
/** 余烬：位移闪避耗热。 */
export const EMBER_DASH_HEAT_MUL = 0.55
/** 起势：每波开场 Fever 保底。 */
export const SPARK_FEVER = 40

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
  return Math.min(0.3, stacks * CARAPACE_DR)
}

export function greedGoldMul(owned: OwnedUpgrade[]): number {
  return hasRelic(owned, 'relic_greed') ? GREED_GOLD_MUL : 1
}

export function dashHeatCost(owned: OwnedUpgrade[], base = 16): number {
  if (!hasRelic(owned, 'relic_ember')) return base
  return Math.max(6, Math.ceil(base * EMBER_DASH_HEAT_MUL))
}

export function sparkFeverFloor(owned: OwnedUpgrade[]): number {
  return hasRelic(owned, 'relic_spark') ? SPARK_FEVER : 0
}

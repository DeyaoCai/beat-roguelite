/**
 * Progression BC — XP, gold, upgrades, luck grades, loadout resolve, drops.
 */
export {
  UPGRADE_POOL,
  pickThree,
  rollStartStat,
  ownedFusableOffhands,
  totalLuck,
  rollGrade,
  gradeDetail,
  makeOwned,
  OFFHAND_CAP,
  MAGIC_SLOT_MAX,
  magicSlotCap,
  freeMagicSlots,
  magicSlotUnlockedAt,
  isLearnUpgradeId,
  isSpellBoostId,
  isStackableUpgrade,
  activeOffhandCount,
  atOffhandCap,
  type UpgradeId,
  type UpgradeKind,
  type UpgradeGrade,
  type UpgradeDef,
  type OwnedUpgrade,
  type UpgradeOffer,
  type PickMode,
  type PickOpts,
  type UpgradeTier,
} from './upgrades'

export { resolveLoadout, type LoadoutInput } from './loadout'

export {
  settleRunGold,
  pickDuoLearn,
  duoLearnPool,
  duoLearnLabel,
  starterForLearn,
  cycleDuoLearn,
  ensureDuoLearn,
  startFuseNeed,
  ensureStartFuses,
  cycleStartFuseCursor,
  toggleStartFuse,
  duoFuseUpgradeId,
  metaLoadoutMods,
  blessingStartGold,
  toggleContract,
  contractBankMul,
  contractFromKey,
  type MetaLoadoutMods,
  type ShopRunStacks,
} from './meta'

export {
  grantXp,
  grantGold,
  spawnPickup,
  vacuumPickups,
  applyEnemyDefeatedRewards,
  openOffer,
  drainOfferQueue,
  tickPickups,
  PICKUP_REACH,
  xpForKill,
  xpToNextFor,
  xpForHit,
} from './drops'

export { makePickupMeta, type PickupMeta, type PickupKind } from './pickupMeta'

export {
  isRelicId,
  ownedRelics,
  hasRelic,
  atRelicCap,
  carapaceStacksForWave,
  carapaceDr,
  greedGoldMul,
  dashHeatCost,
  sparkFeverFloor,
  RELIC_IDS,
  RELIC_CAP,
  SHIELD_REGEN_SEC,
  type RelicId,
} from './relics'

export {
  isRhythmCard,
  RHYTHM_IDS,
  type RhythmCardId,
} from './rhythmCards'

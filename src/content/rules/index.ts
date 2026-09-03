/**
 * Play rules — tune numbers / quotas / card copy here.
 * Domain only reads these tables; design.md is the prose SSOT.
 *
 * Already catalogs (leave in place): content/weapons · kits · weather · meta(货架文案)
 */

export { MAGIC_SLOTS } from './magicSlots'
export {
  OFFER_COUNT,
  LEVEL_PICK,
  CHEST_PICK,
  WAVE_PICK,
  DROP_PICK,
  WAVE_STARTER_CARDS,
  SKILL_EXCLUSIVE_SPECIALS,
  SPECIALIST_IDS,
  ELEM_EFFECT_IDS,
  BEAT_MAIN_IDS,
  RHYTHM_SPECIAL_IDS,
  type PickModeId,
} from './pickPolicies'
export {
  CARD_TIERS,
  START_TIER,
  ownedSkills,
  CARD_META,
  cardMeta,
  type CardTier,
  type CardMeta,
  type PickCtx,
} from './cardMeta'
export { LUCK_GRADE } from './luckGrade'
export { XP_CURVE } from './progressionCurve'
export { DROP_RULES } from './drops'
export { WAVE_SCALE, SPECIAL_HP } from './waveScale'
export { FOE_SHOT } from './foeShots'
export {
  SPAWN_TIMING,
  SPAWN_RATE,
  SPAWN_DENSITY,
  SPAWN_PLACE,
  SPAWN_PHASES,
  BOSS_SPAWN_PHASE,
  FODDER_KINDS,
  FODDER_UNLOCK_WAVE,
  PREFER_TRASH_WEIGHT,
  type SpawnPhaseCfg,
  type SpawnPhaseId,
  type SpawnFodderKind,
  type FodderKindRule,
} from './spawn'
export {
  LOADOUT_BASE,
  LOADOUT_CAPS,
  UPGRADE_GRADES,
  stackedFactor,
  stackedRangeFactor,
  type Grade3,
} from './upgradeGrades'
export {
  UPGRADE_POOL_ROWS,
  STACKABLE_IDS,
  GRADE_DETAILS,
  type UpgradePoolRow,
  type UpgradePoolKind,
} from './upgradePool'
export { RELIC_IDS, RELIC_RULES } from './relics'
export { RHYTHM_IDS, RHYTHM_RULES } from './rhythm'
export {
  SHOP_STACKS,
  BLESSING_COMBAT,
  CONTRACT_COMBAT,
} from './metaCombat'
export {
  BOSS_BY_WAVE,
  BOSS_CYCLE,
  BOSS_SHOT,
  bossSkillsFor,
  type BossRuleDef,
  type BossRuleId,
  type BossSkillDef,
  type BossFanShot,
  type BossRingShot,
  type BossTeleId,
} from './bosses'
export { ARENA_RULES } from './arena'
export { WEATHER_CYCLE } from './weatherCycle'
export { HINT_RULES, type HintKind } from './hints'
export { HEAT_RULES } from './heat'
export { ELEM_RULES, ARMOR_BY_KIND } from './elemental'
export { FEVER_RULES } from './fever'

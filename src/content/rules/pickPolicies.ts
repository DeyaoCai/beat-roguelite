/**
 * 三选一来源配额（对齐 design.md「三选一来源」）。
 * 引擎按 mode 读表拼牌；不含卡池文案（仍在 domain UPGRADE_POOL）。
 */

import { RHYTHM_IDS } from './rhythm'

export type PickModeId = 'level' | 'drop_minor' | 'drop_major' | 'wave' | 'chest'

export const OFFER_COUNT = 3

/** 升级三选：只出人物属性。不出习得、本门方向。 */
export const LEVEL_PICK = {
  /** 局内不再习得副手。 */
  learnWhenFree: 0,
  learnOnSlotUnlock: 0,
  /** 单技能后不再拆本门伤/CD/范围。 */
  boostWhenSlotsFull: 0,
  boostWhenSlotsFree: 0,
} as const

/** 宝箱：从遗物层起舀；软顶满后改属性。不出习得 / 融合 / 专精。 */
export const CHEST_PICK = {
  startTier: 'relic',
  relicCap: 3,
} as const

/** 关末：三选融合（立刻嫁接进主手）；融满后改属性。 */
export const WAVE_PICK = {
  preferRhythmChance: 0,
  relicSlots: 0,
  allowLearn: false,
  allowFuseOffer: true,
  fuseCards: 3,
} as const

/** 精英 / Boss 从专属层起舀；凑不满三张再往下层。 */
export const DROP_PICK = {
  startTier: 'specialist',
} as const

/**
 * 当前主手专精 + 对应满层 id。专精可叠；满层只学一次、关联已学技能。
 */
export const WAVE_STARTER_CARDS = {
  flame: { specialist: 'melee_power', elem: 'elem_break' },
  spirit_orb: { specialist: 'orb_split', elem: 'elem_explode' },
  ward_aura: { specialist: 'aura_slow', elem: 'elem_freeze' },
  thunder_chain: { specialist: 'chain_fork', elem: 'elem_amp' },
  starfall: { specialist: 'star_volley', elem: 'elem_weak' },
} as const

/** 专精 id。只跟当前主手走，可叠。 */
export const SPECIALIST_IDS = [
  'melee_power',
  'orb_split',
  'aura_slow',
  'chain_fork',
  'star_volley',
] as const

/** 满层效果：精英可学，每张只学一次，不能叠档。 */
export const ELEM_EFFECT_IDS = [
  'elem_break',
  'elem_explode',
  'elem_freeze',
  'elem_amp',
  'elem_weak',
] as const

/** 拍点加码：精英 / Boss。只强化主手 Perfect。 */
export const BEAT_MAIN_IDS = ['beat_bonus'] as const

/** 节奏专项：只进 Boss 掉落。升级 / 关末不出。 */
export const RHYTHM_SPECIAL_IDS = RHYTHM_IDS

/** 技能专属并集（专精 / 满层 / 拍点 / 节拍）。 */
export const SKILL_EXCLUSIVE_SPECIALS = [
  ...SPECIALIST_IDS,
  ...ELEM_EFFECT_IDS,
  ...BEAT_MAIN_IDS,
  ...RHYTHM_SPECIAL_IDS,
] as const

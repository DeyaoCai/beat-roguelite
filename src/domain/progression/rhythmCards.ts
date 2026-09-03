import { RHYTHM_IDS as RHYTHM_ID_LIST, RHYTHM_RULES } from '../../content/rules'
import type { UpgradeId } from './upgrades'

export const RHYTHM_IDS = RHYTHM_ID_LIST
export type RhythmCardId = (typeof RHYTHM_IDS)[number]

export const FEVER_GAIN_CAP = RHYTHM_RULES.feverGainCap
export const JUDGE_PERFECT_CAP = RHYTHM_RULES.judgePerfectCap
export const JUDGE_GOOD_CAP = RHYTHM_RULES.judgeGoodCap
export const FEVER_HOLD_CAP = RHYTHM_RULES.feverHoldCap
export const COMBO_DMG_CAP_CARD = RHYTHM_RULES.comboDmgCapCard
export const COMBO_BREAK_KEEP_SOFT = RHYTHM_RULES.comboBreakKeepSoft

export function isRhythmCard(id: UpgradeId): id is RhythmCardId {
  return (RHYTHM_IDS as readonly string[]).includes(id)
}

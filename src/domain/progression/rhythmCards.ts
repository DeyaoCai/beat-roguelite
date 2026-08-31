import type { UpgradeId } from './upgrades'

export const RHYTHM_IDS = [
  'rhythm_window',
  'rhythm_fever_gain',
  'rhythm_fever_hold',
  'rhythm_combo_soft',
  'rhythm_combo_cap',
] as const

export type RhythmCardId = (typeof RHYTHM_IDS)[number]

export const FEVER_GAIN_CAP = 2
export const JUDGE_PERFECT_CAP = 0.14
export const JUDGE_GOOD_CAP = 0.32
export const FEVER_HOLD_CAP = 11
export const COMBO_DMG_CAP_CARD = 80
export const COMBO_BREAK_KEEP_SOFT = 0.75

export function isRhythmCard(id: UpgradeId): id is RhythmCardId {
  return (RHYTHM_IDS as readonly string[]).includes(id)
}

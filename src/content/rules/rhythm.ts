/** 节奏专项数值与软顶。 */
export const RHYTHM_IDS = [
  'rhythm_window',
  'rhythm_fever_gain',
  'rhythm_fever_hold',
  'rhythm_combo_soft',
  'rhythm_combo_cap',
] as const

export const RHYTHM_RULES = {
  feverGainCap: 2,
  judgePerfectCap: 0.14,
  judgeGoodCap: 0.32,
  feverHoldCap: 11,
  comboDmgCapCard: 80,
  comboBreakKeepSoft: 0.75,
} as const

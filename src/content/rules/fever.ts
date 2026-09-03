/** Fever / 连击手感。 */
export const FEVER_RULES = {
  /** 默认窗口；loadout 可被延烧加长。 */
  activeSec: 7,
  cooldownSec: 12,
  /** 热度 ≥ max * readyFrac 才能按 F。 */
  readyFrac: 0.98,
  comboDmgPerPoint: 0.014,
  defaultComboCap: 50,
  milestones: [10, 25, 50, 100] as const,
} as const

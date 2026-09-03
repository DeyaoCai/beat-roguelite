/** 魔法槽（副手）：主手不占槽。 */
export const MAGIC_SLOTS = {
  /** 上限格数。 */
  max: 3,
  /** 每隔多少级解锁一格：Lv10→1 · Lv20→2 · Lv30→3。 */
  everyLevels: 10,
} as const

/** 一波内天气轮换。不每秒改。 */
export const WEATHER_CYCLE = {
  /** 一段最短秒数；一波按曲长切成 3～6 段。 */
  minSlotSec: 50,
  minSlots: 3,
  maxSlots: 6,
} as const

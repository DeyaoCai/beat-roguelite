/** 场地尺度与一波时长带。 */
export const ARENA_RULES = {
  half: 42,
  playViewHalf: 22,
  waveDurationMinSec: 3 * 60,
  waveDurationMaxSec: 5 * 60,
  waveDurationFallbackSec: 4 * 60,
  standardWaves: 5,
  /** 关末清场后等遗物拾取的宽限（秒）。 */
  lootGraceSec: 8,
} as const

import { beginFadeToResult } from './fade'
import type { SessionIO, SessionState } from './types'

/** 主动结束本局：按阵亡结算（50% 入袋），淡出后进结算屏。 */
export function abandonRun(s: SessionState, io: SessionIO): void {
  if (s.scene !== 'play' || !s.world || s.fadeTx) return
  s.paused = false
  io.setTuneOpen(false)
  s.runScore += s.world.stats.score
  s.runKills += s.world.stats.kills
  beginFadeToResult(s, false)
}

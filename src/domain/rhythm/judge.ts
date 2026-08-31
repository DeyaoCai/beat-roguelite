export type JudgeResult = 'perfect' | 'good' | 'miss'

export type JudgeWindows = {
  perfect: number
  good: number
}

/** Casual windows — easier to land hits. */
export const DEFAULT_JUDGE_WINDOWS: JudgeWindows = {
  perfect: 0.1,
  good: 0.24,
}

/** How far past the note a press / auto-miss still counts. */
export function catchSec(win: JudgeWindows = DEFAULT_JUDGE_WINDOWS): number {
  return win.good + 0.04
}

export function judgeBeat(
  errorSec: number,
  win: JudgeWindows = DEFAULT_JUDGE_WINDOWS,
): JudgeResult {
  const e = Math.abs(errorSec)
  if (e <= win.perfect) return 'perfect'
  if (e <= win.good) return 'good'
  return 'miss'
}

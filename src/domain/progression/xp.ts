/** XP / level curve (run-scoped). */

export function xpToNextFor(level: number): number {
  // 前几级快一点，保证 Boss 前能吃到 1～2 次三选一。
  return 28 + Math.max(0, level - 1) * 18
}

export function xpForKill(mult: number, wave: number): number {
  // 波 1 小怪约 10 XP；约 3 杀升一级。
  return Math.max(1, Math.floor((8 + wave * 2) * (0.9 + 0.1 * Math.max(1, mult))))
}

export function xpForHit(mult: number): number {
  return Math.max(0, Math.floor(1 * Math.max(1, mult * 0.5)))
}

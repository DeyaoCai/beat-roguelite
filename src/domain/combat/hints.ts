import { HINT_RULES, type HintKind } from '../../content/rules'
import type { World } from './types'

export function canReplaceHint(
  current: HintKind | null,
  remainSec: number,
  next: HintKind,
): boolean {
  if (!current || remainSec <= 0) return true
  const cur = HINT_RULES.priority[current]
  const nxt = HINT_RULES.priority[next]
  if (nxt > cur) return true
  return remainSec <= HINT_RULES.stealBelow
}

export function pushHint(
  w: World,
  kind: HintKind,
  text: string,
  hold?: number,
): boolean {
  if (!canReplaceHint(w.hintKind, w.bossHintT, kind)) return false
  w.bossHint = text
  w.bossHintT = hold ?? HINT_RULES.hold[kind]
  w.hintKind = kind
  return true
}

export function tickHint(w: World, dt: number): void {
  if (w.bossHintT <= 0) {
    w.bossHint = ''
    w.hintKind = null
    return
  }
  w.bossHintT = Math.max(0, w.bossHintT - dt)
  if (w.bossHintT <= 0) {
    w.bossHint = ''
    w.hintKind = null
  }
}

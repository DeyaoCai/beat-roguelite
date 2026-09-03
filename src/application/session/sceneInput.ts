import { handleMenuKey } from './menuInput'
import { handlePlayOfferKey } from './playFrame'
import { handlePrepKey } from './prepInput'
import type { SessionIO, SessionState } from './types'

export function consumePendingKey(s: SessionState, io: SessionIO): void {
  if (!s.pendingKey || s.paused || s.fadeTx) {
    s.pendingKey = null
    s.pendingCode = null
    return
  }
  const k = s.pendingKey
  const code = s.pendingCode
  s.pendingKey = null
  s.pendingCode = null
  if (
    s.scene === 'title' ||
    s.scene === 'shop' ||
    s.scene === 'codex' ||
    s.scene === 'options' ||
    s.scene === 'result'
  ) {
    handleMenuKey(s, k, io)
  } else if (s.scene === 'prep') {
    handlePrepKey(s, k, code, io)
  } else if (s.scene === 'play') {
    handlePlayOfferKey(s, k, code, io)
  }
}

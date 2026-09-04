/** Touch vs desk UI shell. Force with `?ui=touch` / `?ui=desk`. */

export type UiMode = 'touch' | 'desk'

export function isMiniProgramEnv(
  search = typeof window !== 'undefined' ? window.location.search : '',
  ua = typeof navigator !== 'undefined' ? navigator.userAgent : '',
): boolean {
  try {
    const q = new URLSearchParams(search)
    if (q.get('mp') === '1' || q.get('mp') === 'true') return true
  } catch {
    /* ignore */
  }
  if (/miniProgram/i.test(ua)) return true
  try {
    const w = window as Window & {
      __wxjs_environment?: string
      wx?: { miniProgram?: unknown }
    }
    if (w.__wxjs_environment === 'miniprogram') return true
    if (w.wx?.miniProgram) return true
  } catch {
    /* ignore */
  }
  return false
}

export function resolveUiMode(
  search = typeof window !== 'undefined' ? window.location.search : '',
  opts?: { coarse?: boolean; width?: number; ua?: string },
): UiMode {
  try {
    const q = new URLSearchParams(search)
    const forced = q.get('ui')
    if (forced === 'touch' || forced === 'mobile') return 'touch'
    if (forced === 'desk' || forced === 'desktop') return 'desk'
  } catch {
    /* ignore */
  }
  if (isMiniProgramEnv(search, opts?.ua)) return 'touch'
  const coarse =
    opts?.coarse ??
    (typeof window !== 'undefined' &&
      !!window.matchMedia?.('(pointer: coarse)').matches)
  const width =
    opts?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1280)
  if (coarse || width < 900) return 'touch'
  return 'desk'
}

export function isTouchUi(mode = resolveUiMode()): boolean {
  return mode === 'touch'
}

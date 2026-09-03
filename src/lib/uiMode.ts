/** Touch vs desk UI shell. Force with `?ui=touch` / `?ui=desk`. */

export type UiMode = 'touch' | 'desk'

export function resolveUiMode(
  search = typeof window !== 'undefined' ? window.location.search : '',
  opts?: { coarse?: boolean; width?: number },
): UiMode {
  try {
    const q = new URLSearchParams(search)
    const forced = q.get('ui')
    if (forced === 'touch' || forced === 'mobile') return 'touch'
    if (forced === 'desk' || forced === 'desktop') return 'desk'
  } catch {
    /* ignore */
  }
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

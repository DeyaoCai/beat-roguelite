/** Dev default on; prod / ship build off unless `VITE_RHYTHM_ENABLED=true`. */
export function isRhythmEnabled(): boolean {
  const env = (import.meta as ImportMeta & { env?: { VITE_RHYTHM_ENABLED?: string } }).env
    ?.VITE_RHYTHM_ENABLED
  if (env === 'false' || env === '0') return false
  if (env === 'true' || env === '1') return true
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('rhythm') === 'off') return false
    if (q.get('rhythm') === 'on') return true
  } catch {
    /* ignore */
  }
  return import.meta.env.DEV
}

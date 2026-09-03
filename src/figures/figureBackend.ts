export type FigureBackend = 'procedural' | 'gltf'

/** `?backend=gltf|procedural` or `?quality=high` → gltf. Else env, else procedural. */
export function resolveFigureBackend(): FigureBackend {
  try {
    const q = new URLSearchParams(window.location.search)
    const backend = q.get('backend')
    if (backend === 'gltf' || backend === 'procedural') return backend
    if (q.get('quality') === 'high') return 'gltf'
  } catch {
    /* ignore */
  }
  const env = (import.meta as ImportMeta & { env?: { VITE_FIGURE_BACKEND?: string } }).env
    ?.VITE_FIGURE_BACKEND
  if (env === 'gltf' || env === 'procedural') return env
  return 'procedural'
}

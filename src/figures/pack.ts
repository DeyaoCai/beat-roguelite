/** Vite public root for hero figure packs (`public/figures` → `/figures`). */
export const FIGURES_PUBLIC_ROOT = '/figures'

export const TKA_JODI_ID = 'tka-jodi'
export const SKYRIM_FEMALE_ID = 'skyrim-female'

/** TKA wardrobe / body / clips: `public/figures/tka-jodi/models`. */
export const TKA_MODELS_PUBLIC_ROOT = `${FIGURES_PUBLIC_ROOT}/${TKA_JODI_ID}/models`

export function joinPublic(root: string, ...parts: string[]): string {
  const segs = parts
    .flatMap((p) => String(p ?? '').replace(/\\/g, '/').split('/'))
    .filter((s) => s.length > 0 && s !== '.')
  const base = root.replace(/\/+$/, '')
  return segs.length ? `${base}/${segs.join('/')}` : base
}

export function figurePackUrl(id: string, ...parts: string[]): string {
  return joinPublic(FIGURES_PUBLIC_ROOT, id, ...parts)
}

export function tkaModelsUrl(...parts: string[]): string {
  return joinPublic(TKA_MODELS_PUBLIC_ROOT, ...parts)
}

/** Resolve a path in `figure.json` (relative to the pack root). */
export function resolveFigureRel(id: string, rel: string): string {
  const n = rel.replace(/\\/g, '/')
  if (n.startsWith('/')) return n
  return figurePackUrl(id, n)
}

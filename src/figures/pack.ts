import { assetUrl } from '../lib/assetUrl'

/** co_der-resource path prefix (sibling repo, dev-mounted at `/res/*`). */
export const FIGURES_RESOURCE_PREFIX = 'beat-roguelite/figures'

export const TKA_JODI_ID = 'tka-jodi'
export const SKYRIM_FEMALE_ID = 'skyrim-female'
export const SKYRIM_FOLGI_ID = 'skyrim-folgi'
export const HOLYSEE_VIE_ID = 'holysee-vie'
export const HOLYSEE_LITE_ID = 'holysee-lite'
export const HOLYSEE_IRU_ID = 'holysee-iru'

/** Session default — game repo `public/figures/active.json` only. */
export const FIGURES_ACTIVE_URL = assetUrl('figures/active.json')

/** @deprecated use {@link figureResourceUrl} / {@link figurePackUrl} */
export const FIGURES_PUBLIC_ROOT = figureResourceUrl()

/** @deprecated use {@link tkaModelsUrl} */
export const TKA_MODELS_PUBLIC_ROOT = figureResourceUrl(TKA_JODI_ID, 'models')

export function joinPublic(root: string, ...parts: string[]): string {
  const segs = parts
    .flatMap((p) => String(p ?? '').replace(/\\/g, '/').split('/'))
    .filter((s) => s.length > 0 && s !== '.')
  const base = root.replace(/\/+$/, '')
  return segs.length ? `${base}/${segs.join('/')}` : base
}

/** Absolute URL under co_der-resource: `{base}res/beat-roguelite/figures/...` */
export function figureResourceUrl(...parts: string[]): string {
  const rel = joinPublic(FIGURES_RESOURCE_PREFIX, ...parts)
  return assetUrl(`res/${rel}`)
}

export function figurePackUrl(id: string, ...parts: string[]): string {
  return figureResourceUrl(id, ...parts)
}

export function tkaModelsUrl(...parts: string[]): string {
  return figureResourceUrl(TKA_JODI_ID, 'models', ...parts)
}

/** Resolve a path in `figure.json` (relative to the pack root). */
export function resolveFigureRel(id: string, rel: string): string {
  const n = rel.replace(/\\/g, '/')
  if (n.startsWith('/')) return n
  return figurePackUrl(id, n)
}

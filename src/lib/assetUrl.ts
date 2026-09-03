/** Join Vite `base` (e.g. `/games/`) with a site-root path (`figures/x`). */
export function assetUrl(sitePath: string): string {
  const base = import.meta.env.BASE_URL
  const rel = sitePath.replace(/^\/+/, '')
  return rel ? `${base}${rel}` : base
}

/** Encode each path segment for static files under `public/`. */
export function encodePublicPath(relPath: string): string {
  return relPath
    .split(/[/\\]/)
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

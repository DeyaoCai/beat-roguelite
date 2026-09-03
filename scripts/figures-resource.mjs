import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Sibling co_der-resource repo (universe layout). */
export const RESOURCE_REPO = path.resolve(repoRoot, '../co_der-resource')

/** On-disk root for beat-roguelite figure packs. */
export const FIGURES_RESOURCE_ROOT = path.join(RESOURCE_REPO, 'beat-roguelite/figures')

/** URL path segment after `/res/` (matches `src/figures/pack.ts`). */
export const FIGURES_RESOURCE_PREFIX = 'beat-roguelite/figures'

export function figurePackDir(packId, ...parts) {
  return path.join(FIGURES_RESOURCE_ROOT, packId, ...parts)
}

export function tkaModelsDir(...parts) {
  return figurePackDir('tka-jodi', 'models', ...parts)
}

/** Relative path from beat-roguelite repo root (for import CLI / outfit json). */
export function figureResourceRel(packId, ...parts) {
  return path.join('..', 'co_der-resource', FIGURES_RESOURCE_PREFIX, packId, ...parts).replace(/\\/g, '/')
}

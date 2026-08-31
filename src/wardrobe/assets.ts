import { TKA_MODELS_PUBLIC_ROOT, tkaModelsUrl } from '../figures/pack'

/** TKA wardrobe assets: `public/figures/tka-jodi/models` → `/figures/tka-jodi/models`. */
export const MODELS_PUBLIC_ROOT = TKA_MODELS_PUBLIC_ROOT

/**
 * Join path segments under the active TKA figure pack models root.
 */
export function modelUrl(...parts: string[]): string {
  return tkaModelsUrl(...parts)
}

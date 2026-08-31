import { SKYRIM_FEMALE_ID, TKA_JODI_ID } from './pack'
import { createSkyrimFemaleFigure } from './skyrim-female'
import { createTkaJodiFigure } from './tka-jodi'
import type { CreatedHero, WardrobeHooks } from './types'

export type { CreatedHero, Gait, HeroCaps, HeroFigure, WardrobeHooks } from './types'
export { SKYRIM_FEMALE_ID, TKA_JODI_ID, figurePackUrl, tkaModelsUrl } from './pack'

const KNOWN = new Set([SKYRIM_FEMALE_ID, TKA_JODI_ID])

function figureIdFromQuery(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('figure')
    if (q && KNOWN.has(q)) return q
  } catch {
    /* ignore */
  }
  return null
}

/** Persist / `public/figures/active.json`. Query `?figure=` wins. */
export async function resolveActiveFigureId(): Promise<string> {
  const fromQuery = figureIdFromQuery()
  if (fromQuery) return fromQuery
  try {
    const res = await fetch('/figures/active.json')
    if (!res.ok) return TKA_JODI_ID
    const data = (await res.json()) as { id?: string }
    return data.id && KNOWN.has(data.id) ? data.id : TKA_JODI_ID
  } catch {
    return TKA_JODI_ID
  }
}

export type CreateHeroOpts = WardrobeHooks & { id?: string }

export function createHeroFigure(opts: CreateHeroOpts = {}): CreatedHero {
  const id = opts.id ?? figureIdFromQuery() ?? TKA_JODI_ID
  if (id === SKYRIM_FEMALE_ID) return createSkyrimFemaleFigure()
  return createTkaJodiFigure(opts)
}

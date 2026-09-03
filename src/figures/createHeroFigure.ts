import { FIGURES_ACTIVE_URL } from './pack'
import { resolveFigureBackend, type FigureBackend } from './figureBackend'
import {
  DEFAULT_FIGURE_ID,
  isHubFigureId,
  isKnownFigureId,
  isSkyrimFigureId,
} from './catalog'
import { SKYRIM_FEMALE_ID, TKA_JODI_ID } from './pack'
import { createProceduralFigure, isProceduralKitId, type ProceduralVariant } from './procedural'
import { createSkyrimFemaleFigure } from './skyrim-female'
import { createTkaJodiFigure } from './tka-jodi'
import type { CreatedHero, WardrobeHooks } from './types'

export type { CreatedHero, Gait, HeroCaps, HeroFigure, WardrobeHooks } from './types'
export {
  cycleHubFigure,
  DEFAULT_FIGURE_ID,
  HUB_FIGURES,
  hubFigureCaption,
  isKnownFigureId,
} from './catalog'
export { resolveFigureBackend, type FigureBackend } from './figureBackend'
export { SKYRIM_FEMALE_ID, SKYRIM_FOLGI_ID, TKA_JODI_ID, figurePackUrl, tkaModelsUrl } from './pack'
export type { ProceduralVariant }

function figureIdFromQuery(): string | null {
  try {
    const q = new URLSearchParams(window.location.search).get('figure')
    if (q && isKnownFigureId(q)) return q
  } catch {
    /* ignore */
  }
  return null
}

/** Query `?figure=` wins, then persist, then `{base}figures/active.json`. */
export async function resolveActiveFigureId(persisted?: string | null): Promise<string> {
  const fromQuery = figureIdFromQuery()
  if (fromQuery) return fromQuery
  if (persisted && isHubFigureId(persisted)) return persisted
  try {
    const res = await fetch(FIGURES_ACTIVE_URL)
    if (!res.ok) return DEFAULT_FIGURE_ID
    const data = (await res.json()) as { id?: string }
    return data.id && isKnownFigureId(data.id) ? data.id : DEFAULT_FIGURE_ID
  } catch {
    return DEFAULT_FIGURE_ID
  }
}

export type CreateHeroOpts = WardrobeHooks & {
  id?: string
  backend?: FigureBackend
  /** Procedural only — radio operator uses bust. */
  variant?: ProceduralVariant
}

export function createHeroFigure(opts: CreateHeroOpts = {}): CreatedHero {
  const id = opts.id ?? figureIdFromQuery() ?? DEFAULT_FIGURE_ID
  const backend = opts.backend ?? resolveFigureBackend()

  if (id === TKA_JODI_ID) return createTkaJodiFigure(opts)

  if (backend === 'procedural' && isProceduralKitId(id)) {
    return createProceduralFigure(id, { variant: opts.variant ?? 'full' })
  }

  if (isSkyrimFigureId(id)) return createSkyrimFemaleFigure(id)
  return createSkyrimFemaleFigure(SKYRIM_FEMALE_ID)
}

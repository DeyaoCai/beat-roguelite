import { resolveFigureRel } from './pack'
import type { FigureManifest } from './types'

export async function loadFigureManifest(fallback: FigureManifest): Promise<FigureManifest> {
  try {
    const res = await fetch(resolveFigureRel(fallback.id, 'figure.json'))
    if (!res.ok) return fallback
    const raw = (await res.json()) as Partial<FigureManifest>
    return {
      ...fallback,
      ...raw,
      id: fallback.id,
      gaits: { ...fallback.gaits, ...raw.gaits },
      capabilities: { ...fallback.capabilities, ...raw.capabilities },
      voices: raw.voices ?? fallback.voices,
    }
  } catch {
    return fallback
  }
}

import { resolveFigureBackend, type FigureBackend } from './figureBackend'
import { resolveFigureRel } from './pack'

/** Prefer slim ship catalog under procedural; fall back to workshop full list. */
export async function resolveVoicesCatalogUrl(
  packId: string,
  voicesRel: string,
  backend: FigureBackend = resolveFigureBackend(),
): Promise<string | null> {
  const candidates: string[] = []
  if (backend === 'procedural') {
    candidates.push(resolveFigureRel(packId, 'voices.ship.json'))
    if (/voices\/voices\.json$/.test(voicesRel.replace(/\\/g, '/'))) {
      candidates.push(resolveFigureRel(packId, voicesRel.replace(/voices\.json$/, 'voices.ship.json')))
    }
  }
  candidates.push(resolveFigureRel(packId, voicesRel))

  for (const url of candidates) {
    try {
      const res = await fetch(url)
      if (res.ok) return url
    } catch {
      /* try next */
    }
  }
  return null
}

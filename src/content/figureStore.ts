const KEY = 'beat-roguelite.figure.v1'

type FigurePersist = {
  v: 1
  figureId: string
}

export function loadFigureId(): string | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<FigurePersist>
    if (p.v !== 1 || typeof p.figureId !== 'string' || !p.figureId) return null
    return p.figureId
  } catch {
    return null
  }
}

export function saveFigureId(figureId: string): void {
  if (!figureId) return
  try {
    const row: FigurePersist = { v: 1, figureId }
    localStorage.setItem(KEY, JSON.stringify(row))
  } catch {
    /* private mode / quota */
  }
}

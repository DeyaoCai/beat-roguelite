export type AnimRow = {
  id: string
  caption: string
  /** glTF path under the TKA figure pack models root. */
  url: string
  clip: number
  loop: boolean
  icon: string | null
}

let imported: AnimRow[] = []

export function allAnims(): AnimRow[] {
  return imported
}

export function animById(id: string): AnimRow | undefined {
  return imported.find((r) => r.id === id)
}

export function looksLikeLoopAnim(name: string): boolean {
  return /(^|[^a-z])(idle|wait|walk|run|sprint|loop|groove|dance|jiggle)([^a-z]|$)/i.test(name)
}

type CatalogAnim = {
  id?: string
  caption?: string
  url?: string
  mesh?: string
  clip?: number
  loop?: boolean
  icon?: string | null
}

export function replaceImportedAnims(rows: AnimRow[]) {
  imported = rows
}

export function animsFromCatalog(raw: CatalogAnim[] | undefined): AnimRow[] {
  const out: AnimRow[] = []
  for (const item of raw ?? []) {
    const url = item.url || item.mesh
    if (!item?.id || !url) continue
    const loop = item.loop ?? looksLikeLoopAnim(`${item.id} ${item.caption ?? ''} ${url}`)
    out.push({
      id: item.id,
      caption: item.caption || item.id,
      url,
      clip: Number.isFinite(item.clip) ? Number(item.clip) : 0,
      loop,
      icon: item.icon ?? null,
    })
  }
  return out
}

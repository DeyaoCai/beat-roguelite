import { animPoseFamily, isDevAnimLabel, isSamplePackId, looksLikeAnim, looksLikeLoopAnim } from './guess'
import { catalogFromFiles } from './fromScan'
import { catalogFromLegacy, type LegacyCatalog } from './fromLegacy'
import { catalogFromTables, type RawTableFile } from './fromTables'
import { modelUrl } from '../assets'
import type { ClothesRow, MakeupRow } from './types'

export type LoadedCatalogs = {
  clothes: ClothesRow[]
  makeup: MakeupRow[]
  anims: Array<{ id: string; caption: string; url: string; clip: number; loop: boolean; icon: null }>
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url)
    const ct = res.headers.get('content-type') ?? ''
    if (!res.ok || ct.includes('html')) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function animsFromUrls(modId: string, urls: string[]) {
  const seen = new Set<string>()
  const out: LoadedCatalogs['anims'] = []
  for (const url of urls) {
    if (!url || seen.has(url)) continue
    seen.add(url)
    const id = url.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? url
    out.push({
      id: `${modId}.${id}`,
      caption: id,
      url,
      clip: 0,
      loop: looksLikeLoopAnim(`${id} ${url}`),
      icon: null,
    })
  }
  return out
}

function animsFromCatalogRows(
  modId: string,
  rows: Array<{ url: string; caption: string; loop?: boolean }>,
) {
  const seen = new Set<string>()
  const out: LoadedCatalogs['anims'] = []
  for (const row of rows) {
    if (!row.url || seen.has(row.url)) continue
    seen.add(row.url)
    const stem = row.url.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? row.url
    out.push({
      id: `${modId}.${stem}`,
      caption: row.caption || stem,
      url: row.url,
      clip: 0,
      loop: row.loop ?? looksLikeLoopAnim(`${stem} ${row.caption} ${row.url}`),
      icon: null,
    })
  }
  return out
}

/** Prefer tables.json (unpack contract). Fall back to files.json scan, then legacy catalog.json. */
export async function loadModCatalogs(modIds: string[]): Promise<LoadedCatalogs> {
  const clothes: ClothesRow[] = []
  const makeup: MakeupRow[] = []
  const anims: LoadedCatalogs['anims'] = []
  for (const mod of modIds) {
    if (isSamplePackId(mod)) continue
    const base = modelUrl(mod)
    const tables = await fetchJson<RawTableFile>(`${base}/tables.json`)
    const filesDoc = await fetchJson<{ files?: string[] }>(`${base}/files.json`)
    const files = filesDoc?.files ?? []
    let parsed = null
    if (tables && tables.length > 0) {
      parsed = catalogFromTables(mod, tables)
      parsed.animUrls.push(...files.filter(looksLikeAnim))
    } else if (files.length) {
      parsed = catalogFromFiles(mod, files)
    } else {
      const legacy = await fetchJson<LegacyCatalog>(`${base}/catalog.json`)
      if (legacy) parsed = catalogFromLegacy(mod, legacy)
    }
    if (!parsed) continue
    clothes.push(...parsed.clothes)
    makeup.push(...parsed.makeup)
    const fromTable = animsFromCatalogRows(mod, parsed.anims ?? [])
    const tableFamilies = new Set(fromTable.map((a) => animPoseFamily(a.url)))
    const extraUrls = parsed.animUrls.filter(
      (url) => !fromTable.some((a) => a.url === url) && !tableFamilies.has(animPoseFamily(url)),
    )
    anims.push(
      ...[...fromTable, ...animsFromUrls(mod, extraUrls)].filter(
        (a) => !isDevAnimLabel(a.id, a.caption, a.url),
      ),
    )
  }
  return { clothes, makeup, anims }
}

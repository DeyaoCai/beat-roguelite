/**
 * Industry shading configs for wardrobe items.
 *
 * Clothes / skin → UE DefaultLit / glTF PBR (BaseColor, Normal, packed ORM).
 * Hair → UE hair cards (Root / ID / Flow / Opacity / Depth), not Groom strands.
 */

import { tkaModelsUrl } from '../figures/pack'

export type ShadingModel = 'lit' | 'hairCard'

/** Packed ORM matches glTF: R=AO, G=Roughness, B=Metallic. */
export type LitMaps = {
  map?: string
  normalMap?: string
  ormMap?: string
  roughnessMap?: string
  metalnessMap?: string
  aoMap?: string
}

export type HairCardMaps = {
  rootMap?: string
  idMap?: string
  flowMap?: string
  opacityMap?: string
  depthMap?: string
}

export function isHairCard(typeName: string, shading?: ShadingModel): boolean {
  return shading === 'hairCard' || typeName === 'Hair'
}

function dirOf(rel: string): string {
  const i = rel.replace(/\\/g, '/').lastIndexOf('/')
  return i >= 0 ? rel.slice(0, i) : ''
}

function stemOf(rel: string): string {
  const base = rel.replace(/\\/g, '/').split('/').pop() ?? rel
  return base.replace(/\.[^.]+$/, '')
}

/** Sibling Material/ folder next to a glb, or the glb's own folder. */
function materialDir(mesh: string): string {
  const dir = dirOf(mesh)
  return dir ? `${dir}/Material` : 'Material'
}

export function guessHairMaps(mesh: string | null | undefined): HairCardMaps | undefined {
  if (!mesh) return undefined
  const mat = materialDir(mesh)
  const stem = stemOf(mesh).replace(/_scalp$/i, '')
  const maps: HairCardMaps = {
    rootMap: `${mat}/${stem}_root.png`,
    idMap: `${mat}/${stem}_id.png`,
    flowMap: `${mat}/${stem}_flow.png`,
    opacityMap: `${mat}/${stem}_opacity.png`,
    depthMap: `${mat}/${stem}_depth.png`,
  }
  return maps
}

export function guessOrmPath(map: string): string[] {
  const n = map.replace(/\\/g, '/')
  const alts = [
    n.replace(/_d(\.[^.]+)$/i, '_orm$1'),
    n.replace(/_d(\.[^.]+)$/i, '_ORM$1'),
    n.replace(/_d(\.[^.]+)$/i, '_o$1'),
    n.replace(/_mc(\.[^.]+)$/i, '_o$1'),
    n.replace(/_dm(\.[^.]+)$/i, '_o$1'),
    n.replace(/[^/]+$/, 'orm.png'),
  ]
  return [...new Set(alts.filter((p) => p !== n))]
}

export async function probePublicPng(rel: string): Promise<boolean> {
  try {
    const segs = rel.replace(/\\/g, '/').split('/').filter(Boolean)
    const url = tkaModelsUrl(...segs)
    const r = await fetch(url, { method: 'HEAD' })
    const ct = r.headers.get('content-type') ?? ''
    if (!r.ok || ct.includes('html')) return false
    return /\.png$/i.test(rel) || ct.includes('image') || ct.includes('octet')
  } catch {
    return false
  }
}

export async function enrichLitMaps(tex: LitMaps | undefined): Promise<LitMaps | undefined> {
  if (!tex?.map) return tex
  if (tex.ormMap || tex.roughnessMap) return tex
  for (const p of guessOrmPath(tex.map)) {
    if (await probePublicPng(p)) return { ...tex, ormMap: p }
  }
  return tex
}

export async function enrichHairMaps(
  mesh: string | null | undefined,
  hair: HairCardMaps | undefined,
): Promise<HairCardMaps | undefined> {
  const guessed = { ...guessHairMaps(mesh), ...hair }
  if (!guessed) return hair
  const out: HairCardMaps = {}
  const keys = ['rootMap', 'idMap', 'flowMap', 'opacityMap', 'depthMap'] as const
  await Promise.all(
    keys.map(async (k) => {
      const p = guessed[k]
      if (p && (await probePublicPng(p))) out[k] = p
    }),
  )
  return Object.keys(out).length ? out : hair
}

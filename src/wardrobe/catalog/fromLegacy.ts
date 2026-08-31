import { flattenRect } from './fields'
import {
  guessEyesMakeupKind,
  guessWebTypeName,
  isMakeupPath,
  isThumbAlbedo,
  looksLikeEyesAsset,
  looksLikeLoopAnim,
  mapOfficialSlot,
} from './guess'
import { isClothesType, isMakeupType, type ClothesRow, type MakeupRow, type ModCatalog } from './types'

/** Deprecated importer catalog.json — dual-read until packs are re-unpacked. */
export type LegacyCatalog = {
  modId?: string
  group?: string
  items?: Array<{
    id?: string
    typeName?: string
    source?: string
    group?: string
    caption?: string
    mesh?: string | null
    icon?: string | null
    shading?: ClothesRow['shading']
    textures?: ClothesRow['textures']
    hair?: ClothesRow['hair']
  }>
  makeup?: MakeupRow[]
  eyes?: MakeupRow[]
  anims?: Array<{ id?: string; url?: string; mesh?: string }>
}

export function catalogFromLegacy(modId: string, cat: LegacyCatalog): ModCatalog {
  const group = cat.group || modId
  const makeup: MakeupRow[] = []
  for (const look of [...(cat.makeup ?? []), ...(cat.eyes ?? [])]) {
    if (!look?.id || !isMakeupType(look.typeName)) continue
    makeup.push({
      id: look.id,
      group: look.group || group,
      typeName: look.typeName,
      caption: look.caption || look.id,
      mesh: null,
      icon: look.icon ?? null,
      textures: look.textures,
      color: look.color,
      screenRect: flattenRect(look.screenRect),
      cameraPosition: look.cameraPosition ?? null,
      source: look.source === 'eyes' ? 'eyes' : 'makeup',
    })
  }
  const clothes: ClothesRow[] = []
  for (const item of cat.items ?? []) {
    if (!item?.id) continue
    const map = item.textures?.map ?? item.icon ?? ''
    if (isThumbAlbedo(map) || isMakeupPath(`${item.id} ${item.caption} ${map} ${item.mesh}`)) continue
    if (item.typeName === 'Eyes' || looksLikeEyesAsset(item.mesh, item.id)) {
      const kind =
        guessEyesMakeupKind(item.mesh, item.id) ??
        (item.typeName === 'Eyes' ? 'Eye' : null)
      const tex = item.textures?.map ?? item.icon
      if (kind && tex) {
        makeup.push({
          id: item.id,
          group: item.group || group,
          typeName: kind,
          caption: item.caption || item.id,
          mesh: null,
          icon: item.icon ?? null,
          textures: { map: tex },
          source: 'eyes',
        })
      }
      continue
    }
    const typeName = resolveLegacySlot(item)
    if (!typeName) continue
    clothes.push({
      id: item.id,
      group: item.group || group,
      typeName,
      caption: item.caption || item.id,
      mesh: item.mesh ?? null,
      icon: item.icon ?? null,
      source:
        item.source === 'skin' || item.source === 'hair' || item.source === 'clothes' || item.source === 'scan'
          ? item.source
          : undefined,
      shading: item.shading,
      textures: item.textures,
      hair: item.hair,
    })
  }
  const anims = (cat.anims ?? [])
    .map((a) => {
      const url = a.url || a.mesh
      if (!url) return null
      return { url, caption: a.id || url, loop: looksLikeLoopAnim(`${a.id ?? ''} ${url}`) }
    })
    .filter((a): a is NonNullable<typeof a> => !!a)
  const animUrls = anims.map((a) => a.url)
  return { clothes, makeup, animUrls, anims }
}

function resolveLegacySlot(
  item: NonNullable<LegacyCatalog['items']>[number],
): ClothesRow['typeName'] | null {
  if (item.typeName === 'Eyes') return null
  const declared =
    item.typeName && isClothesType(item.typeName)
      ? item.typeName
      : mapOfficialSlot(item.typeName)
  if (item.source === 'skin') return 'Skin'
  if (item.source === 'hair') return 'Hair'
  if (item.source === 'clothes' && declared) return declared
  if (item.source === 'scan') return declared ?? guessWebTypeName(item.mesh, item.id ?? '')
  if (declared && declared !== 'Skin') return declared
  if (declared === 'Skin' && isBodyPreviewMesh(item.mesh)) return 'Skin'
  return guessWebTypeName(item.mesh, item.id ?? '')
}

function isBodyPreviewMesh(mesh: string | null | undefined): boolean {
  if (!mesh) return true
  const n = mesh.replace(/\\/g, '/').toLowerCase()
  const file = n.split('/').pop() ?? ''
  return n.includes('/user2/') || file === 'user.glb' || file === 'female.glb'
}

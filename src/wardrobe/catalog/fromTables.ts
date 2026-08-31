import { isHairCard } from '../../content/shading'
import {
  classifyTable,
  field,
  fieldString,
  flattenColor,
  flattenRect,
  mapUeAssetPath,
  normalizeFields,
  normalizeGroup,
} from './fields'
import { BODY_MESH, guessWebTypeName, looksLikeLoopAnim, mapEyesType, mapMakeupType, mapOfficialSlot } from './guess'
import type { CatalogAnim, ClothesRow, MakeupRow, ModCatalog } from './types'

export type RawTableFile = Array<{
  table?: string
  kind?: string
  rows?: Array<{ id?: string; fields?: Record<string, unknown> }>
}>

export function catalogFromTables(modId: string, raw: RawTableFile): ModCatalog {
  const clothes: ClothesRow[] = []
  const makeup: MakeupRow[] = []
  const animUrls: string[] = []
  const anims: CatalogAnim[] = []
  for (const block of raw) {
    const tableName = block.table ?? block.kind ?? ''
    const kind = classifyTable(tableName)
    if (kind === 'meta' || kind === 'other') continue
    for (const row of block.rows ?? []) {
      if (!row?.id) continue
      const fields = normalizeFields(row.fields)
      if (kind === 'makeup') {
        const look = makeupFromRow(modId, row.id, fields, 'makeup')
        if (look) makeup.push(look)
        continue
      }
      if (kind === 'eyes') {
        const look = eyesFromRow(modId, row.id, fields)
        if (look) makeup.push(look)
        continue
      }
      if (kind === 'anim') {
        const pose = poseFromRow(modId, row.id, fields)
        if (pose) {
          anims.push(pose)
          animUrls.push(pose.url)
        }
        continue
      }
      if (kind !== 'clothes' && kind !== 'skin' && kind !== 'hair') continue
      const item = clothesFromRow(modId, row.id, fields, kind)
      if (item) clothes.push(item)
    }
  }
  return { clothes, makeup, animUrls, anims }
}

function clothesFromRow(
  modId: string,
  rowId: string,
  fields: Record<string, unknown>,
  kind: 'clothes' | 'skin' | 'hair',
): ClothesRow | null {
  const meshRel = meshFromFields(fields, modId, kind)
  const iconRel = mapUeAssetPath(field(fields, 'Icon', 'icon'), '.png', modId)
  const texRel =
    mapUeAssetPath(field(fields, 'Texture', 'Diffuse', 'BaseColor', 'SkinTexture', 'MainTex', 'Texture_d'), '.png', modId)
  let typeName: ClothesRow['typeName']
  if (kind === 'skin') typeName = 'Skin'
  else if (kind === 'hair') typeName = 'Hair'
  else {
    const slot =
      mapOfficialSlot(fieldString(fields, 'TypeName')) ??
      (meshRel ? guessWebTypeName(meshRel, rowId) : null)
    if (!slot) return null
    typeName = slot
  }
  const group = normalizeGroup(fieldString(fields, 'Group'), modId)
  const shading = typeName === 'Hair' ? 'hairCard' : 'lit'
  return {
    id: `${modId}.${rowId}`,
    group,
    typeName,
    caption: rowId,
    mesh: meshRel ?? (typeName === 'Skin' ? BODY_MESH : null),
    icon: iconRel ?? texRel,
    source: kind,
    shading: isHairCard(typeName, shading) ? 'hairCard' : 'lit',
    textures: texRel ? { map: texRel } : undefined,
  }
}

/** Hairstyle table uses `meshes[]` (scalp + cards). Clothes use singular `Mesh`. */
function meshFromFields(
  fields: Record<string, unknown>,
  modId: string,
  kind: 'clothes' | 'skin' | 'hair',
): string | null {
  const raw = field(fields, 'Mesh', 'meshes', 'Meshes')
  const parts = Array.isArray(raw) ? raw : [raw]
  const mapped: string[] = []
  for (const part of parts) {
    if (part == null) continue
    const rel = mapUeAssetPath(part, '.glb', modId)
    if (rel) mapped.push(rel)
  }
  if (mapped.length === 0) return null
  if (kind === 'hair') {
    const cards = mapped.filter((p) => !/scalp/i.test(p))
    return cards[cards.length - 1] ?? mapped[0] ?? null
  }
  return mapped[0] ?? null
}

function poseFromRow(modId: string, rowId: string, fields: Record<string, unknown>): CatalogAnim | null {
  const raw = field(fields, 'Montage', 'Animation', 'AnimSequence', 'Sequence')
  const url = mapUeAssetPath(raw, '.glb', modId)
  if (!url) return null
  const stem = url.replace(/\\/g, '/').split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  if (!stem || stem === '0' || stem.toLowerCase() === 'none') return null
  const caption = fieldString(fields, 'Title', 'Caption') ?? rowId
  return {
    url,
    caption,
    loop: looksLikeLoopAnim(`${rowId} ${caption} ${url}`),
  }
}

function makeupFromRow(
  modId: string,
  rowId: string,
  fields: Record<string, unknown>,
  source: 'makeup' | 'eyes',
): MakeupRow | null {
  const typeName = mapMakeupType(fieldString(fields, 'Type', 'TypeName'))
  if (!typeName || typeName === 'Eye' || typeName === 'Eyelashes') return null
  const texRel = mapUeAssetPath(field(fields, 'Texture_d', 'Texture', 'MainTex', 'Diffuse'), '.png', modId)
  const iconRel = mapUeAssetPath(field(fields, 'Icon'), '.png', modId)
  const screenRect =
    flattenRect(field(fields, 'ScreenRect')) ?? flattenRect(field(fields, 'UVRect'))
  const cameraPosition = fieldString(fields, 'CameraPosition', 'Camera', 'Shot')
  return {
    id: `${modId}.${rowId}`,
    group: normalizeGroup(fieldString(fields, 'Group'), modId),
    typeName,
    caption: rowId,
    mesh: null,
    icon: iconRel ?? texRel,
    source,
    textures: texRel ? { map: texRel } : undefined,
    screenRect,
    cameraPosition,
  }
}

function eyesFromRow(modId: string, rowId: string, fields: Record<string, unknown>): MakeupRow | null {
  const typeName = mapEyesType(fieldString(fields, 'Type', 'TypeName') ?? rowId)
  if (!typeName) return null
  const texRel = mapUeAssetPath(field(fields, 'MainTex', 'Texture'), '.png', modId)
  const emisRel = mapUeAssetPath(field(fields, 'EmissiveTex'), '.png', modId)
  const iconRel = mapUeAssetPath(field(fields, 'Icon'), '.png', modId)
  const color = flattenColor(field(fields, 'Color', 'Tint'))
  const textures: { map?: string; emissiveMap?: string } = {}
  if (texRel) textures.map = texRel
  if (emisRel) textures.emissiveMap = emisRel
  return {
    id: `${modId}.${rowId}`,
    group: normalizeGroup(fieldString(fields, 'Group'), modId),
    typeName,
    caption: rowId,
    mesh: null,
    icon: iconRel ?? texRel,
    source: 'eyes',
    textures: Object.keys(textures).length ? textures : undefined,
    color: color ?? undefined,
  }
}

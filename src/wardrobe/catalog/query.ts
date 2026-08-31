/**
 * Official RoomGirl rows + merge imported workshop packs.
 * Workshop DataTable semantics live in `src/wardrobe/catalog` (not the C# unpacker).
 */

import {
  animsFromCatalog,
  replaceImportedAnims,
  allAnims,
} from '../../content/anims'
import {
  enrichHairMaps,
  enrichLitMaps,
  isHairCard,
  type ShadingModel,
} from '../../content/shading'
import { loadModCatalogs } from './load'
import { modelUrl } from '../assets'
import { isSamplePackId } from './guess'
import {
  BODY_MESH,
  type ClothesRow,
  type ClothesTypeName,
  type MakeupRow,
  type MakeupTypeName,
} from './types'

export type TkaModRow = {
  id: string
  caption: string
  version: string
  clothesGroup: string
}

export type ClothesGroupRow = {
  id: string
  groupName: string
  owningMod: string
}

/** TKA_Mod_Table */
export const TKA_MODS: readonly TkaModRow[] = [
  {
    id: 'TKA_RoomGirl',
    caption: 'SkimpyChipao',
    version: '1',
    clothesGroup: 'RoomGirl',
  },
]

/** Mod_ClothesGroup */
export const CLOTHES_GROUPS: readonly ClothesGroupRow[] = [
  { id: 'RoomGirl', groupName: 'RoomGirl', owningMod: 'TKA_RoomGirl' },
]

const RG = 'TKA_RoomGirl'

/**
 * Mod_ClothesTable rows for RoomGirl.
 * Mesh paths follow FModel glTF export: `<Set>/<asset>.glb`.
 */
export const CLOTHES_TABLE: readonly ClothesRow[] = [
  {
    id: 'jodi',
    group: 'RoomGirl',
    typeName: 'Skin',
    caption: 'Jodi',
    mesh: BODY_MESH,
    icon: null,
  },
  {
    id: 'brecross',
    group: 'RoomGirl',
    typeName: 'Neck',
    caption: '胸针交叉',
    mesh: `${RG}/BreCross/brecross.glb`,
    icon: `${RG}/BreCross/acs_neck_brochi_dm.png`,
    textures: {
      map: `${RG}/BreCross/acs_neck_brochi_dm.png`,
      normalMap: `${RG}/BreCross/acs_neck_brochi_n.png`,
    },
  },
  {
    id: 'staffcard',
    group: 'RoomGirl',
    typeName: 'Neck',
    caption: '工牌',
    mesh: `${RG}/StaffCard/staffcard.glb`,
    icon: `${RG}/StaffCard/card_d.png`,
    textures: {
      map: `${RG}/StaffCard/card_d.png`,
      normalMap: `${RG}/StaffCard/card_n.png`,
      ormMap: `${RG}/StaffCard/orm.png`,
    },
  },
  {
    id: 'dancer1',
    group: 'RoomGirl',
    typeName: 'Neck',
    caption: '舞者面纱',
    mesh: `${RG}/Dancer/dancer_veil.glb`,
    icon: `${RG}/Dancer/dancerveil_d1.png`,
    textures: {
      map: `${RG}/Dancer/dancerveil_d1.png`,
      normalMap: `${RG}/Dancer/dancerveil_n.png`,
    },
  },
  {
    id: 'butfly1',
    group: 'RoomGirl',
    typeName: 'Dress',
    caption: '蝴蝶上衣',
    mesh: `${RG}/Butterfly/butterfly_top.glb`,
    icon: `${RG}/Butterfly/but_top_d.png`,
    textures: {
      map: `${RG}/Butterfly/but_top_d.png`,
      normalMap: `${RG}/Butterfly/but_top_n.png`,
    },
  },
  {
    id: 'sailor1',
    group: 'RoomGirl',
    typeName: 'Dress',
    caption: '水手上衣',
    mesh: `${RG}/Sailor/top.glb`,
    icon: `${RG}/Sailor/material/cf_top_sailormini_mc.png`,
    textures: {
      map: `${RG}/Sailor/material/cf_top_sailormini_mc.png`,
      normalMap: `${RG}/Sailor/material/cf_top_sailormini_n.png`,
      ormMap: `${RG}/Sailor/material/cf_top_sailormini_o.png`,
    },
  },
  {
    id: 'chipao1',
    group: 'RoomGirl',
    typeName: 'Dress',
    caption: '旗袍',
    mesh: `${RG}/Chinese/china.glb`,
    icon: `${RG}/Chinese/material/chipao_d.png`,
    textures: {
      map: `${RG}/Chinese/material/chipao_d.png`,
      normalMap: `${RG}/Chinese/material/chipao_n.png`,
      ormMap: `${RG}/Chinese/material/chipao_orm.png`,
    },
  },
  {
    id: 'chipao2',
    group: 'RoomGirl',
    typeName: 'Dress',
    caption: '旗袍变体',
    mesh: `${RG}/Chinese/china1.glb`,
    icon: `${RG}/Chinese/material/chipao1_d.png`,
    textures: {
      map: `${RG}/Chinese/material/chipao1_d.png`,
      normalMap: `${RG}/Chinese/material/chipao_n.png`,
      ormMap: `${RG}/Chinese/material/chipao_orm.png`,
    },
  },
  {
    id: 'sister',
    group: 'RoomGirl',
    typeName: 'Dress',
    caption: '修女服',
    mesh: `${RG}/Sister/sister.glb`,
    icon: `${RG}/Sister/cf_top_sister_s_t111.png`,
    textures: {
      map: `${RG}/Sister/cf_top_sister_s_t111.png`,
      normalMap: `${RG}/Sister/cf_top_sister_s_n.png`,
    },
  },
  {
    id: 'butfly2',
    group: 'RoomGirl',
    typeName: 'Skirt',
    caption: '蝴蝶下装',
    mesh: `${RG}/Butterfly/butterfly_bot.glb`,
    icon: `${RG}/Butterfly/but_bot_d.png`,
    textures: {
      map: `${RG}/Butterfly/but_bot_d.png`,
      normalMap: `${RG}/Butterfly/but_bot_n.png`,
    },
  },
  {
    id: 'sailor2',
    group: 'RoomGirl',
    typeName: 'Skirt',
    caption: '水手裙',
    mesh: `${RG}/Sailor/skirt.glb`,
    icon: `${RG}/Sailor/material/cf_bot_sailormini_mc.png`,
    textures: {
      map: `${RG}/Sailor/material/cf_bot_sailormini_mc.png`,
      normalMap: `${RG}/Sailor/material/cf_bot_sailormini_n.png`,
      ormMap: `${RG}/Sailor/material/cf_bot_sailormini_o.png`,
    },
  },
  {
    id: 'chris_bot',
    group: 'RoomGirl',
    typeName: 'Skirt',
    caption: '圣诞裙',
    mesh: `${RG}/Chrismas/chris_bot.glb`,
    icon: `${RG}/Chrismas/material/chris_bot_d.png`,
    textures: {
      map: `${RG}/Chrismas/material/chris_bot_d.png`,
      normalMap: `${RG}/Chrismas/material/chris_bot_n.png`,
      ormMap: `${RG}/Chrismas/material/chris_bot_o.png`,
    },
  },
  {
    id: 'snownipple',
    group: 'RoomGirl',
    typeName: 'Bra',
    caption: '圣诞内衣',
    mesh: `${RG}/Chrismas/snownipple.glb`,
    icon: `${RG}/Chrismas/material/snow_nipple_d.png`,
    textures: {
      map: `${RG}/Chrismas/material/snow_nipple_d.png`,
      normalMap: `${RG}/Chrismas/material/snow_nipple_n.png`,
    },
  },
  {
    id: 'snownipple1',
    group: 'RoomGirl',
    typeName: 'Bra',
    caption: '圣诞内衣变体',
    mesh: `${RG}/Chrismas/snownipple1.glb`,
    icon: `${RG}/Chrismas/material/snow_nipple_d1.png`,
    textures: {
      map: `${RG}/Chrismas/material/snow_nipple_d1.png`,
      normalMap: `${RG}/Chrismas/material/snow_nipple_n.png`,
    },
  },
  {
    id: 'sister1',
    group: 'RoomGirl',
    typeName: 'Bra',
    caption: '修女内衣',
    mesh: `${RG}/Sister/sister_nipple.glb`,
    icon: `${RG}/Sister/acs_neck_healermune_mc.png`,
    textures: {
      map: `${RG}/Sister/acs_neck_healermune_mc.png`,
      normalMap: `${RG}/Sister/acs_neck_healermune_n.png`,
    },
  },
  {
    id: 'pod1',
    group: 'RoomGirl',
    typeName: 'Backpack',
    caption: '背包',
    mesh: `${RG}/Pod/pod.glb`,
    icon: `${RG}/Pod/o-a_base.png`,
    textures: {
      map: `${RG}/Pod/o-a_base.png`,
      normalMap: `${RG}/Pod/o-a_nrm.png`,
    },
  },
]

export const DEFAULT_LOADOUT: Partial<Record<ClothesTypeName, string>> = {
  Skin: 'jodi',
  Neck: 'brecross',
}

let importedClothes: ClothesRow[] = []

function lookKey(row: ClothesRow): string {
  return `${row.typeName}|${row.mesh ?? ''}|${row.textures?.map ?? ''}`
}

export function allClothes(): ClothesRow[] {
  if (importedClothes.length === 0) return [...CLOTHES_TABLE]
  const ids = new Set(CLOTHES_TABLE.map((r) => r.id))
  const looks = new Set(CLOTHES_TABLE.map(lookKey))
  const extra = importedClothes.filter((r) => !ids.has(r.id) && !looks.has(lookKey(r)))
  return [...CLOTHES_TABLE, ...extra]
}

export function clothesById(id: string): ClothesRow | undefined {
  return allClothes().find((r) => r.id === id)
}

export function clothesByType(typeName: ClothesTypeName): ClothesRow[] {
  return allClothes().filter((r) => r.typeName === typeName)
}

export function clothesByGroup(groupId: string): ClothesRow[] {
  return allClothes().filter((r) => r.group === groupId)
}

/** Workshop / catalog folder id → short label. */
export function clothesGroupLabel(group: string): string {
  const official = TKA_MODS.find((m) => m.clothesGroup === group || m.id === group)
  if (official) return official.caption
  const named = CLOTHES_GROUPS.find((g) => g.id === group)
  if (named) return named.groupName
  const stripped = group.replace(/-\d+(-\d+)+$/, '').replace(/_/g, ' ').trim()
  return stripped || group
}

export function allClothesGroups(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const add = (group: string) => {
    if (!group || seen.has(group)) return
    seen.add(group)
    out.push(group)
  }
  for (const row of [...allClothes(), ...allMakeup()]) add(row.group)
  for (const row of allAnims()) {
    const dot = row.id.indexOf('.')
    add(dot > 0 ? row.id.slice(0, dot) : row.url.replace(/\\/g, '/').split('/')[0] ?? row.id)
  }
  return out.sort((a, b) => clothesGroupLabel(a).localeCompare(clothesGroupLabel(b), 'en'))
}

let importedMakeup: MakeupRow[] = []

export function allMakeup(): MakeupRow[] {
  return importedMakeup
}

export function makeupById(id: string): MakeupRow | undefined {
  return importedMakeup.find((r) => r.id === id)
}

export function makeupByType(typeName: MakeupTypeName): MakeupRow[] {
  return importedMakeup.filter((r) => r.typeName === typeName)
}

export async function loadImportedClothes(): Promise<number> {
  try {
    const idxRes = await fetch(modelUrl('wardrobe-index.json'))
    const ct = idxRes.headers.get('content-type') ?? ''
    if (!idxRes.ok || ct.includes('html')) return 0
    const idx = (await idxRes.json()) as { mods?: string[] }
    const loaded = await loadModCatalogs(idx.mods ?? [])
    const rows: ClothesRow[] = []
    for (const item of loaded.clothes) {
      const shading: ShadingModel = isHairCard(item.typeName, item.shading) ? 'hairCard' : 'lit'
      const textures = shading === 'lit' ? await enrichLitMaps(item.textures) : item.textures
      const hair = shading === 'hairCard' ? await enrichHairMaps(item.mesh, item.hair) : item.hair
      rows.push({ ...item, shading, textures, hair })
    }
    importedClothes = rows.filter((r) => !isSamplePackId(r.group) && !isSamplePackId(r.id))
    importedMakeup = loaded.makeup.filter((r) => !isSamplePackId(r.group) && !isSamplePackId(r.id))
    replaceImportedAnims(animsFromCatalog(loaded.anims))
    return rows.length + loaded.makeup.length
  } catch {
    importedClothes = []
    importedMakeup = []
    replaceImportedAnims([])
    return 0
  }
}

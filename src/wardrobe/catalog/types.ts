import type { HairCardMaps, LitMaps, ShadingModel } from '../../content/shading'

export type { HairCardMaps, LitMaps, ShadingModel }

export const BODY_MESH = 'user2/user.glb'

export const CLOTHES_TYPE_NAMES = [
  'Skin',
  'Hair',
  'Face',
  'Ears',
  'Neck',
  'Dress',
  'Skirt',
  'Bra',
  'Briefs',
  'Socks',
  'Shoes',
  'Gloves',
  'Wrist',
  'Backpack',
  'Tail',
] as const

export type ClothesTypeName = (typeof CLOTHES_TYPE_NAMES)[number]

export const CLOTHES_TYPE_LABEL: Record<ClothesTypeName, string> = {
  Skin: '皮肤',
  Hair: '发型',
  Face: '面饰',
  Ears: '耳饰',
  Neck: '颈饰',
  Dress: '上装/连体',
  Skirt: '裙装',
  Bra: '内衣上',
  Briefs: '内衣下',
  Socks: '袜',
  Shoes: '鞋',
  Gloves: '手套',
  Wrist: '腕饰',
  Backpack: '背包',
  Tail: '尾',
}

export const MAKEUP_TYPE_NAMES = [
  'Eye',
  'Eyelashes',
  'Lips',
  'Eyebrow',
  'Eyeshadow',
  'Eyeliner',
  'Cheeks',
  'Nose',
  'Nails',
  'Tattoo',
] as const

export type MakeupTypeName = (typeof MAKEUP_TYPE_NAMES)[number]

export const MAKEUP_TYPE_LABEL: Record<MakeupTypeName, string> = {
  Eye: '美瞳',
  Eyelashes: '睫毛',
  Lips: '嘴唇',
  Eyebrow: '眉',
  Eyeshadow: '眼影',
  Eyeliner: '眼线',
  Cheeks: '腮红',
  Nose: '鼻',
  Nails: '甲',
  Tattoo: '纹身',
}

/** Mod_EyesTable Color: RGB multiply; A = emissive intensity (may be >1). */
export type MakeupColor = { r: number; g: number; b: number; a: number }

export type MakeupRow = {
  id: string
  group: string
  typeName: MakeupTypeName
  caption: string
  mesh: null
  icon: string | null
  textures?: { map?: string; emissiveMap?: string }
  /** Eyes table tint; ignored for UV makeup decals. */
  color?: MakeupColor
  screenRect?: number[] | Record<string, number> | null
  /** Mod_MakeupTable CameraPosition (RFHH) or legacy shot name. */
  cameraPosition?: string | null
  source: 'makeup' | 'eyes'
}

export type ClothesRow = {
  id: string
  group: string
  typeName: ClothesTypeName
  caption: string
  mesh: string | null
  icon: string | null
  shading?: ShadingModel
  textures?: LitMaps
  hair?: HairCardMaps
  source?: 'clothes' | 'skin' | 'hair' | 'scan'
}

export type CatalogAnim = {
  url: string
  caption: string
  loop?: boolean
}

export type ModCatalog = {
  clothes: ClothesRow[]
  makeup: MakeupRow[]
  animUrls: string[]
  anims: CatalogAnim[]
}

export function isClothesType(v: string): v is ClothesTypeName {
  return (CLOTHES_TYPE_NAMES as readonly string[]).includes(v)
}

export function isMakeupType(v: string): v is MakeupTypeName {
  return (MAKEUP_TYPE_NAMES as readonly string[]).includes(v)
}

import {
  SKYRIM_FOLGI_ID,
  HOLYSEE_IRU_ID,
  HOLYSEE_LITE_ID,
  HOLYSEE_VIE_ID,
  SKYRIM_FEMALE_ID,
} from '../pack'

export type HeroKitId =
  | typeof HOLYSEE_VIE_ID
  | typeof HOLYSEE_LITE_ID
  | typeof HOLYSEE_IRU_ID
  | typeof SKYRIM_FEMALE_ID
  | typeof SKYRIM_FOLGI_ID

export type HeroKit = {
  id: HeroKitId
  /** Plate / trim / skin / hair / accent (crest). */
  plate: number
  trim: number
  skin: number
  hair: number
  accent: number
  /** Ponytail length scale. */
  pony: number
  /** Shoulder pad extra bulk. */
  pauldron: number
}

const SKIN = 0xe8c4a8

export const HERO_KITS: Record<HeroKitId, HeroKit> = {
  [HOLYSEE_VIE_ID]: {
    id: HOLYSEE_VIE_ID,
    plate: 0xc4c8d0,
    trim: 0x9f1239,
    skin: SKIN,
    hair: 0xe8c07a,
    accent: 0x450a1a,
    pony: 1.15,
    pauldron: 1.05,
  },
  [HOLYSEE_LITE_ID]: {
    id: HOLYSEE_LITE_ID,
    plate: 0xd0d6e0,
    trim: 0x1d4ed8,
    skin: SKIN,
    hair: 0xb8c4d8,
    accent: 0x1e3a8a,
    pony: 1.0,
    pauldron: 1.0,
  },
  [HOLYSEE_IRU_ID]: {
    id: HOLYSEE_IRU_ID,
    plate: 0x3f3f46,
    trim: 0x18181b,
    skin: SKIN,
    hair: 0x1c1917,
    accent: 0x0a0a0a,
    pony: 1.05,
    pauldron: 1.1,
  },
  [SKYRIM_FEMALE_ID]: {
    id: SKYRIM_FEMALE_ID,
    plate: 0xd6d3d1,
    trim: 0x78716c,
    skin: SKIN,
    hair: 0xd6b27a,
    accent: 0xa8a29e,
    pony: 0.85,
    pauldron: 0.85,
  },
  [SKYRIM_FOLGI_ID]: {
    id: SKYRIM_FOLGI_ID,
    plate: 0xf5f5f4,
    trim: 0xd97706,
    skin: SKIN,
    hair: 0x78716c,
    accent: 0xb45309,
    pony: 0.75,
    pauldron: 1.15,
  },
}

export function isProceduralKitId(id: string): id is HeroKitId {
  return id in HERO_KITS
}

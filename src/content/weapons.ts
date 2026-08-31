/** 武：定向风息短锥。角度为全开角（度），sim 转成半角弧度。 */
export type MartialId = 'flame'

export type MartialDef = {
  id: MartialId
  name: string
  /** 锥长 */
  range: number
  /** 攻击全开角（度） */
  angleDeg: number
  damage: number
  interval: number
  life: number
  beatMul: number
}

export const MARTIALS: Record<MartialId, MartialDef> = {
  flame: {
    id: 'flame',
    name: '风息',
    range: 3.4,
    angleDeg: 50,
    damage: 1.15,
    interval: 0.12,
    life: 0.22,
    beatMul: 1.35,
  },
}

export const DEFAULT_MARTIAL: MartialId = 'flame'

/** 开局可选的一门；拍点只强化这一门。 */
export type StarterId = MartialId | MagicId

export const STARTERS: { id: StarterId; name: string; blurb: string }[] = [
  { id: 'flame', name: '风息', blurb: '朝前短锥 · 出门击退' },
  { id: 'spirit_orb', name: '火球', blurb: '点射分裂 · 拍点再射' },
  { id: 'ward_aura', name: '霜环', blurb: '贴身持续 · 出门减速' },
  { id: 'thunder_chain', name: '雷链', blurb: '弹跳群伤 · 出门三跳' },
  { id: 'starfall', name: '落岩', blurb: '落地溅射 · 拍点再砸' },
  { id: 'orbit', name: '环刃', blurb: '绕身飞刃 · 出门两把' },
]

export const DEFAULT_STARTER: StarterId = 'flame'

export function starterLabel(id: StarterId): string {
  return STARTERS.find((s) => s.id === id)?.name ?? id
}

/** 魔：霜环 / 连锁 / 火球 / 落岩 / 环刃。可叠多门。 */
export type MagicId = 'spirit_orb' | 'ward_aura' | 'thunder_chain' | 'starfall' | 'orbit'
export type MagicKind = 'orb' | 'aura' | 'chain' | 'star' | 'orbit'

export type MagicOrbDef = {
  id: MagicId
  name: string
  kind: 'orb'
  interval: number
  damage: number
  speed: number
  life: number
  radius: number
  count: number
  beatMul: number
}

export type MagicAuraDef = {
  id: MagicId
  name: string
  kind: 'aura'
  radius: number
  damage: number
  tickInterval: number
  beatMul: number
}

export type MagicChainDef = {
  id: MagicId
  name: string
  kind: 'chain'
  range: number
  jumps: number
  jumpRange: number
  damage: number
  interval: number
  beatMul: number
}

export type MagicStarDef = {
  id: MagicId
  name: string
  kind: 'star'
  interval: number
  damage: number
  craterR: number
  craterLife: number
  range: number
  beatMul: number
}

export type MagicOrbitDef = {
  id: MagicId
  name: string
  kind: 'orbit'
  radius: number
  blades: number
  spin: number
  damage: number
  bladeR: number
  hitCd: number
  beatMul: number
}

export type MagicDef = MagicOrbDef | MagicAuraDef | MagicChainDef | MagicStarDef | MagicOrbitDef

export const MAGICS: Record<MagicId, MagicDef> = {
  spirit_orb: {
    id: 'spirit_orb',
    name: '火球',
    kind: 'orb',
    interval: 0.38,
    damage: 1.85,
    speed: 10.5,
    life: 1.25,
    radius: 0.24,
    count: 1,
    beatMul: 1.15,
  },
  ward_aura: {
    id: 'ward_aura',
    name: '霜环',
    kind: 'aura',
    radius: 2.55,
    damage: 0.55,
    tickInterval: 0.5,
    beatMul: 1.55,
  },
  thunder_chain: {
    id: 'thunder_chain',
    name: '雷链',
    kind: 'chain',
    range: 7.2,
    jumps: 3,
    jumpRange: 4.2,
    damage: 2.1,
    interval: 0.85,
    beatMul: 1.2,
  },
  starfall: {
    id: 'starfall',
    name: '落岩',
    kind: 'star',
    interval: 0.65,
    damage: 1.75,
    craterR: 1.25,
    craterLife: 0.32,
    range: 6,
    beatMul: 1.45,
  },
  orbit: {
    id: 'orbit',
    name: '环刃',
    kind: 'orbit',
    radius: 2.05,
    blades: 2,
    spin: 2.55,
    damage: 0.62,
    bladeR: 0.42,
    hitCd: 0.28,
    beatMul: 1.4,
  },
}

export const DEFAULT_MAGICS: MagicId[] = ['spirit_orb', 'ward_aura', 'thunder_chain', 'starfall']

/** @deprecated use MartialId — kept for boot opts alias */
export type WeaponId = MartialId
export const DEFAULT_WEAPON: WeaponId = DEFAULT_MARTIAL
export const WEAPONS = MARTIALS

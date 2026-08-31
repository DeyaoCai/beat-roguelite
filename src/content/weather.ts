export type WeatherId =
  | 'clear'
  | 'heat'
  | 'rain'
  | 'gale'
  | 'frost'
  | 'dust'
  | 'magnet'

/** 六标签：金只挂环刃。 */
export type DmgTag = 'wind' | 'fire' | 'ice' | 'thunder' | 'earth' | 'metal'

export type TerrainKind = 'mud' | 'ice' | 'wind' | 'flame' | 'tide'

export type WeatherDef = {
  id: WeatherId
  name: string
  blurb: string
  tagMul: Partial<Record<DmgTag, number>>
  /** Global move (热浪). Terrain still stacks on top. */
  moveMul: number
  /** <1 = heat drops slower. */
  heatDecayMul: number
  terrains: { kind: TerrainKind; count: number }[]
}

export const WEATHERS: WeatherDef[] = [
  {
    id: 'clear',
    name: '晴',
    blurb: '无修正',
    tagMul: {},
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [],
  },
  {
    id: 'heat',
    name: '热浪',
    blurb: '移速略慢 · 热度掉得慢 · 火+ 冰− 金−',
    tagMul: { fire: 1.25, ice: 0.8, metal: 0.8 },
    moveMul: 0.88,
    heatDecayMul: 0.48,
    terrains: [{ kind: 'flame', count: 1 }],
  },
  {
    id: 'rain',
    name: '暴雨',
    blurb: '潮地 · 雷+ 火−',
    tagMul: { thunder: 1.25, fire: 0.8 },
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [{ kind: 'tide', count: 2 }],
  },
  {
    id: 'gale',
    name: '大风',
    blurb: '风带更密 · 风+ 土−',
    tagMul: { wind: 1.25, earth: 0.8 },
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [{ kind: 'wind', count: 3 }],
  },
  {
    id: 'frost',
    name: '霜',
    blurb: '冰面 · 冰+ 风−',
    tagMul: { ice: 1.25, wind: 0.8 },
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [{ kind: 'ice', count: 2 }],
  },
  {
    id: 'dust',
    name: '沙尘',
    blurb: '泥地 · 土+ 雷−',
    tagMul: { earth: 1.25, thunder: 0.8 },
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [{ kind: 'mud', count: 2 }],
  },
  {
    id: 'magnet',
    name: '磁暴',
    blurb: '风带 1 块 · 金+ 雷−',
    tagMul: { metal: 1.25, thunder: 0.8 },
    moveMul: 1,
    heatDecayMul: 1,
    terrains: [{ kind: 'wind', count: 1 }],
  },
]

const BY_ID = Object.fromEntries(WEATHERS.map((w) => [w.id, w])) as Record<
  WeatherId,
  WeatherDef
>

export function weatherById(id: WeatherId): WeatherDef {
  return BY_ID[id] ?? WEATHERS[0]!
}

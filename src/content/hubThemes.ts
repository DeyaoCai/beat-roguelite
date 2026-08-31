export type HubThemeId = 'studio' | 'grove' | 'frost' | 'ember' | 'star'

/** Canvas HUD tokens for a hub backdrop. */
export type HubThemeUi = {
  ink: string
  mute: string
  dim: string
  accent: string
  accentLine: string
  accentSoft: string
  gold: string
  goldLine: string
  ice: string
  iceLine: string
  card: string
  cardHi: string
  line: string
  veil0: string
  veilMid: string
  veil1: string
  edge0: string
  edge1: string
  edge2: string
}

export type HubThemeDef = {
  id: HubThemeId
  name: string
  blurb: string
  kickerEn: string
  ui: HubThemeUi
}

const GOLD = '#fbbf24'
const GOLD_LINE = 'rgba(251, 191, 36, 0.9)'

export const HUB_THEMES: HubThemeDef[] = [
  {
    id: 'studio',
    name: '镜厅',
    blurb: '工坊转台 · 暖光',
    kickerEn: 'STUDIO',
    ui: {
      ink: '#f3ead8',
      mute: '#b8a894',
      dim: '#7a6a58',
      accent: '#e8a04a',
      accentLine: 'rgba(232, 160, 74, 0.92)',
      accentSoft: '#fde8c8',
      gold: GOLD,
      goldLine: GOLD_LINE,
      ice: '#c9a882',
      iceLine: 'rgba(201, 168, 130, 0.85)',
      card: 'rgba(22, 14, 10, 0.72)',
      cardHi: 'rgba(48, 26, 12, 0.84)',
      line: 'rgba(180, 140, 90, 0.28)',
      veil0: 'rgba(18, 10, 6, 0.92)',
      veilMid: 'rgba(18, 10, 6, 0.58)',
      veil1: 'rgba(18, 10, 6, 0)',
      edge0: 'rgba(232, 160, 74, 0)',
      edge1: 'rgba(232, 160, 74, 0.75)',
      edge2: 'rgba(180, 70, 36, 0.5)',
    },
  },
  {
    id: 'grove',
    name: '魔法深林',
    blurb: '萤火 · 菌光 · 月下苔原',
    kickerEn: 'GROVE',
    ui: {
      ink: '#e8fff4',
      mute: '#8cb8a8',
      dim: '#4d7368',
      accent: '#7dffb3',
      accentLine: 'rgba(125, 255, 179, 0.9)',
      accentSoft: '#d4ffe8',
      gold: GOLD,
      goldLine: GOLD_LINE,
      ice: '#9ee7c8',
      iceLine: 'rgba(158, 231, 200, 0.85)',
      card: 'rgba(6, 22, 18, 0.72)',
      cardHi: 'rgba(10, 42, 34, 0.84)',
      line: 'rgba(90, 180, 140, 0.28)',
      veil0: 'rgba(4, 16, 14, 0.9)',
      veilMid: 'rgba(4, 16, 14, 0.52)',
      veil1: 'rgba(4, 16, 14, 0)',
      edge0: 'rgba(125, 255, 179, 0)',
      edge1: 'rgba(125, 255, 179, 0.7)',
      edge2: 'rgba(40, 160, 120, 0.45)',
    },
  },
  {
    id: 'frost',
    name: '霜月湖',
    blurb: '冰面 · 极光 · 落雪',
    kickerEn: 'FROST',
    ui: {
      ink: '#eef6ff',
      mute: '#9ab0c8',
      dim: '#5a6e84',
      accent: '#9fd4ff',
      accentLine: 'rgba(159, 212, 255, 0.92)',
      accentSoft: '#e0f2fe',
      gold: GOLD,
      goldLine: GOLD_LINE,
      ice: '#bae6fd',
      iceLine: 'rgba(186, 230, 253, 0.85)',
      card: 'rgba(8, 16, 28, 0.74)',
      cardHi: 'rgba(16, 32, 52, 0.86)',
      line: 'rgba(120, 170, 210, 0.28)',
      veil0: 'rgba(6, 12, 24, 0.9)',
      veilMid: 'rgba(6, 12, 24, 0.52)',
      veil1: 'rgba(6, 12, 24, 0)',
      edge0: 'rgba(159, 212, 255, 0)',
      edge1: 'rgba(159, 212, 255, 0.72)',
      edge2: 'rgba(80, 140, 200, 0.48)',
    },
  },
  {
    id: 'ember',
    name: '熔金圣堂',
    blurb: '残柱 · 余烬 · 金脉',
    kickerEn: 'EMBER',
    ui: {
      ink: '#fff1de',
      mute: '#c4a080',
      dim: '#7a5640',
      accent: '#ffb347',
      accentLine: 'rgba(255, 179, 71, 0.92)',
      accentSoft: '#ffe4c0',
      gold: GOLD,
      goldLine: GOLD_LINE,
      ice: '#e8b878',
      iceLine: 'rgba(232, 184, 120, 0.85)',
      card: 'rgba(24, 10, 6, 0.74)',
      cardHi: 'rgba(52, 22, 10, 0.86)',
      line: 'rgba(200, 120, 50, 0.3)',
      veil0: 'rgba(18, 6, 4, 0.9)',
      veilMid: 'rgba(18, 6, 4, 0.55)',
      veil1: 'rgba(18, 6, 4, 0)',
      edge0: 'rgba(255, 179, 71, 0)',
      edge1: 'rgba(255, 179, 71, 0.78)',
      edge2: 'rgba(200, 60, 20, 0.5)',
    },
  },
  {
    id: 'star',
    name: '星港残响',
    blurb: '环带 · 星尘 · 虚空台',
    kickerEn: 'STARFALL',
    ui: {
      ink: '#f3e8ff',
      mute: '#a898c4',
      dim: '#6a5a88',
      accent: '#c4b5fd',
      accentLine: 'rgba(196, 181, 253, 0.92)',
      accentSoft: '#ede9fe',
      gold: GOLD,
      goldLine: GOLD_LINE,
      ice: '#a5f3fc',
      iceLine: 'rgba(165, 243, 252, 0.85)',
      card: 'rgba(10, 8, 22, 0.74)',
      cardHi: 'rgba(24, 16, 48, 0.86)',
      line: 'rgba(160, 140, 220, 0.3)',
      veil0: 'rgba(8, 6, 18, 0.9)',
      veilMid: 'rgba(8, 6, 18, 0.52)',
      veil1: 'rgba(8, 6, 18, 0)',
      edge0: 'rgba(196, 181, 253, 0)',
      edge1: 'rgba(196, 181, 253, 0.72)',
      edge2: 'rgba(80, 200, 220, 0.42)',
    },
  },
]

export const DEFAULT_HUB_THEME: HubThemeId = 'grove'

const BY_ID = Object.fromEntries(HUB_THEMES.map((t) => [t.id, t])) as Record<
  HubThemeId,
  HubThemeDef
>

export function isHubThemeId(v: unknown): v is HubThemeId {
  return typeof v === 'string' && v in BY_ID
}

export function hubThemeById(id: HubThemeId): HubThemeDef {
  return BY_ID[id] ?? HUB_THEMES[1]!
}

export function cycleHubTheme(id: HubThemeId, dir: 1 | -1): HubThemeId {
  const i = HUB_THEMES.findIndex((t) => t.id === id)
  const from = i < 0 ? 0 : i
  return HUB_THEMES[(from + dir + HUB_THEMES.length) % HUB_THEMES.length]!.id
}

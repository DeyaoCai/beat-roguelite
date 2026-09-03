import {
  HOLYSEE_IRU_ID,
  HOLYSEE_LITE_ID,
  HOLYSEE_VIE_ID,
  SKYRIM_FEMALE_ID,
  SKYRIM_FOLGI_ID,
  TKA_JODI_ID,
} from './pack'

export type HubFigureDef = {
  id: string
  caption: string
  blurb: string
}

/** Hub 外形循环：三姐妹 + 已导入随从。Jodi 只走 `?figure=`。 */
export const HUB_FIGURES: HubFigureDef[] = [
  { id: HOLYSEE_VIE_ID, caption: 'Vie', blurb: 'Vilushina · 红' },
  { id: HOLYSEE_LITE_ID, caption: 'Lite', blurb: 'LittelynMaer · 蓝' },
  { id: HOLYSEE_IRU_ID, caption: 'Iru', blurb: 'Irunia · 黑' },
  { id: SKYRIM_FOLGI_ID, caption: 'Folgi', blurb: 'Lightbringer · 玛拉圣骑' },
  { id: SKYRIM_FEMALE_ID, caption: 'Sofia', blurb: '通讯员 · 也可出门' },
]

export const DEFAULT_FIGURE_ID = HOLYSEE_VIE_ID

const HUB_IDS = new Set(HUB_FIGURES.map((f) => f.id))

const KNOWN = new Set([TKA_JODI_ID, SKYRIM_FEMALE_ID, ...HUB_IDS])

export function isKnownFigureId(id: string): boolean {
  return KNOWN.has(id)
}

export function isSkyrimFigureId(id: string): boolean {
  return id === SKYRIM_FEMALE_ID || HUB_IDS.has(id)
}

export function isHubFigureId(id: string): boolean {
  return HUB_IDS.has(id)
}

export function hubFigureOf(id: string): HubFigureDef | undefined {
  return HUB_FIGURES.find((f) => f.id === id)
}

export function hubFigureCaption(id: string): string {
  return hubFigureOf(id)?.caption ?? id
}

export function cycleHubFigure(id: string, dir: 1 | -1): string {
  const ids = HUB_FIGURES.map((f) => f.id)
  const i = ids.indexOf(id)
  const from = i < 0 ? 0 : i
  return ids[(from + dir + ids.length) % ids.length]!
}

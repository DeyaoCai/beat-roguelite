export type HubDest = 'prep' | 'closet' | 'options' | 'shop' | 'figure' | 'codex'

export type HubItem = {
  scene: HubDest
  name: string
  blurb: string
}

export const HUB_ITEMS: HubItem[] = [
  { scene: 'prep', name: '出发', blurb: '主手 · 契约 · 模式' },
  { scene: 'figure', name: '外形', blurb: 'Vie · Lite · Iru · Folgi · Sofia' },
  { scene: 'codex', name: '图鉴', blurb: '人物 · 怪物' },
  { scene: 'closet', name: '衣橱', blurb: '换装 · 姿势' },
  { scene: 'options', name: '选项', blurb: '音乐 · 音效 · 主页' },
  { scene: 'shop', name: '商店', blurb: '永久属性 · 融合出门' },
]

export function hubItemsFor(caps: { wardrobe?: boolean }): HubItem[] {
  return HUB_ITEMS.filter((it) => it.scene !== 'closet' || caps.wardrobe)
}

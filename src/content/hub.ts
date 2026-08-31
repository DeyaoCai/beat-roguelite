export type HubDest = 'prep' | 'closet' | 'options' | 'shop'

export type HubItem = {
  scene: HubDest
  name: string
  blurb: string
}

export const HUB_ITEMS: HubItem[] = [
  { scene: 'prep', name: '出发', blurb: '选曲 · 主手 · 契约' },
  { scene: 'closet', name: '衣橱', blurb: '换装 · 姿势' },
  { scene: 'options', name: '选项', blurb: '音乐 · 音效 · 主页' },
  { scene: 'shop', name: '商店', blurb: '货架暂空 · 钱袋照收' },
]

export function hubItemsFor(caps: { wardrobe?: boolean }): HubItem[] {
  return HUB_ITEMS.filter((it) => it.scene !== 'closet' || caps.wardrobe)
}

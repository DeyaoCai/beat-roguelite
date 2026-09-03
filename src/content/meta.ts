export type BlessingId = 'fever' | 'glass' | 'goldfinger'

export type ContractId = 'horde' | 'iron' | 'mute' | 'glassworld' | 'still' | 'wild'

export type ContractDef = {
  id: ContractId
  name: string
  blurb: string
  /** 入袋乘数；多条相乘。 */
  bankMul: number
  key: string
}

/** 出发可勾；不花钱袋。入袋加成分条相加（可全勾，避免相乘爆炸）。 */
export const CONTRACTS: ContractDef[] = [
  { id: 'horde', name: '虫潮', blurb: '怪更多、场上更挤', bankMul: 1.25, key: '6' },
  { id: 'iron', name: '铁皮', blurb: '敌人血更厚', bankMul: 1.25, key: '7' },
  { id: 'mute', name: '哑火', blurb: '不能按 F 开 Fever', bankMul: 1.2, key: '8' },
  { id: 'glassworld', name: '绝境', blurb: '再少 1 点生命', bankMul: 1.4, key: '9' },
  { id: 'still', name: '素打', blurb: '关掉踩拍加伤，公路也不出', bankMul: 1.2, key: 't' },
  { id: 'wild', name: '盲抽', blurb: '三选改随机不能挑 · 开局再送一张属性 Ⅰ', bankMul: 1.15, key: 'y' },
]

export type ShopStackId =
  | 'hp'
  | 'luck'
  | 'speed'
  | 'heat'
  | 'radius'
  | 'damage'
  | 'haste'
  | 'armor'
  | 'dodge'
  | 'crit'
  | 'growth'
  | 'magnet'
  | 'reach'
  | 'area'
  | 'regen'

export type ShopGoodId = ShopStackId | 'autopick' | 'startfuse' | BlessingId

export type BlessingDef = {
  id: BlessingId
  name: string
  blurb: string
}

export const BLESSINGS: BlessingDef[] = [
  { id: 'fever', name: '热血', blurb: '热度涨得更快，仍要按 F 放 Fever' },
  { id: 'glass', name: '薄皮', blurb: '少 1 点生命，打出的伤害 +10%' },
  { id: 'goldfinger', name: '金手指', blurb: '结算进钱袋的金币 +50%' },
]

export type ShopGood = {
  id: ShopGoodId
  name: string
  blurb: string
  price: number
  kind: 'perm' | 'blessing'
}

export function isShopStackId(id: ShopGoodId): id is ShopStackId {
  return id !== 'autopick' && id !== 'startfuse' && !BLESSINGS.some((b) => b.id === id)
}

/** 永久人物属性（出门叠 Kit）。祝福解锁暂不进货架。 */
export const SHOP_GOODS: ShopGood[] = [
  { id: 'hp', name: '开局生命', blurb: '每局生命上限 +1 · 可叠至 +3', price: 25, kind: 'perm' },
  { id: 'regen', name: '开局回春', blurb: '每局持续回血 · 可叠 3 层', price: 33, kind: 'perm' },
  { id: 'armor', name: '开局护甲', blurb: '每局挨打少掉 4% · 可叠至 12%', price: 36, kind: 'perm' },
  { id: 'dodge', name: '开局闪避', blurb: '每局受击闪避 +4% · 可叠至 12%', price: 36, kind: 'perm' },
  { id: 'radius', name: '开局轻身', blurb: '受击判定更小 · 每层 −10% · 至 −30%', price: 35, kind: 'perm' },
  { id: 'damage', name: '开局强击', blurb: '每局全伤害 +8% · 可叠至 +24%', price: 38, kind: 'perm' },
  { id: 'haste', name: '开局迅捷', blurb: '武/魔冷却略快 · 可叠 3 层', price: 34, kind: 'perm' },
  { id: 'crit', name: '开局暴击', blurb: '每局暴击率 +4% · 可叠至 12%', price: 40, kind: 'perm' },
  { id: 'reach', name: '开局施法距离', blurb: '各门第一下更远 · 可叠 3 层', price: 32, kind: 'perm' },
  { id: 'area', name: '开局施法范围', blurb: '各门这一下铺更大 · 可叠 3 层', price: 34, kind: 'perm' },
  { id: 'luck', name: '开局幸运', blurb: '每局幸运 +1 · 提高三选高档概率 · 至 +3', price: 30, kind: 'perm' },
  { id: 'growth', name: '开局成长', blurb: '每局经验 +5% · 可叠至 +15%', price: 30, kind: 'perm' },
  { id: 'speed', name: '开局滑步', blurb: '每局移速 +10% · 可叠至 +30%', price: 28, kind: 'perm' },
  { id: 'heat', name: '开局蓄热', blurb: '热度掉得更慢 · 可叠买至 3 层', price: 32, kind: 'perm' },
  { id: 'magnet', name: '开局磁铁', blurb: '金币经验吸得更远 · 可叠 3 层', price: 28, kind: 'perm' },
  { id: 'autopick', name: '自动拾取', blurb: '金币、经验、遗物自己飞过来 · 不用跑去捡', price: 40, kind: 'perm' },
  { id: 'startfuse', name: '开局融合', blurb: '出发多融一门进主手 · 可叠买至 +4', price: 45, kind: 'perm' },
]

export function blessingLabel(id: BlessingId | null): string {
  if (!id) return '无'
  return BLESSINGS.find((b) => b.id === id)?.name ?? id
}

export function contractLabel(id: ContractId): string {
  return CONTRACTS.find((c) => c.id === id)?.name ?? id
}

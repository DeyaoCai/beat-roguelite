export type BlessingId = 'fever' | 'glass' | 'duo' | 'goldfinger'

export type ContractId = 'horde' | 'iron' | 'mute' | 'glassworld' | 'still'

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
]

export type ShopGoodId = 'hp' | 'luck' | 'speed' | 'heat' | 'radius' | BlessingId

export type BlessingDef = {
  id: BlessingId
  name: string
  blurb: string
}

export const BLESSINGS: BlessingDef[] = [
  { id: 'fever', name: '热血', blurb: '热度涨得更快，仍要按 F 放 Fever' },
  { id: 'glass', name: '薄皮', blurb: '少 1 点生命，打出的伤害 +10%' },
  { id: 'duo', name: '双修', blurb: '出门多一门自动打的副手；踩拍只加主手' },
  { id: 'goldfinger', name: '金手指', blurb: '结算进钱袋的金币 +50%' },
]

export type ShopGood = {
  id: ShopGoodId
  name: string
  blurb: string
  price: number
  kind: 'perm' | 'blessing'
}

/** 永久基础属性（出门底子叠 Kit）。祝福解锁暂不进货架。 */
export const SHOP_GOODS: ShopGood[] = [
  {
    id: 'hp',
    name: '开局生命',
    blurb: '每局生命上限 +1 · 可叠买至 +3',
    price: 25,
    kind: 'perm',
  },
  {
    id: 'luck',
    name: '开局幸运',
    blurb: '每局幸运 +1 · 提高三选一高档概率 · 至 +3',
    price: 30,
    kind: 'perm',
  },
  {
    id: 'speed',
    name: '开局滑步',
    blurb: '每局移速 +10% · 可叠买至 +30%',
    price: 28,
    kind: 'perm',
  },
  {
    id: 'heat',
    name: '开局蓄热',
    blurb: '热度掉得更慢 · 可叠买至 3 层',
    price: 32,
    kind: 'perm',
  },
  {
    id: 'radius',
    name: '开局轻身',
    blurb: '受击判定更小 · 每层 −10% · 至 −30%',
    price: 35,
    kind: 'perm',
  },
]

export function blessingLabel(id: BlessingId | null): string {
  if (!id) return '无'
  return BLESSINGS.find((b) => b.id === id)?.name ?? id
}

export function contractLabel(id: ContractId): string {
  return CONTRACTS.find((c) => c.id === id)?.name ?? id
}

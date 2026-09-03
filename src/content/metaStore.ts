import {
  BLESSINGS,
  SHOP_GOODS,
  type BlessingId,
  type ShopGoodId,
  type ShopStackId,
} from './meta'
import { SHOP_STACKS } from './rules'

const KEY = 'beat-roguelite.meta.v1'
const STACK_MAX = SHOP_STACKS.stackMax
export const START_FUSE_MAX = SHOP_STACKS.startFuseMax

const STACK_FIELD: Record<ShopStackId, keyof MetaPersist> = {
  hp: 'startHp',
  luck: 'startLuck',
  speed: 'startSpeed',
  heat: 'startHeat',
  radius: 'startRadius',
  damage: 'startDamage',
  haste: 'startHaste',
  armor: 'startArmor',
  dodge: 'startDodge',
  crit: 'startCrit',
  growth: 'startGrowth',
  magnet: 'startMagnet',
  reach: 'startReach',
  area: 'startArea',
  regen: 'startRegen',
}

export type MetaPersist = {
  v: 1
  purse: number
  startHp: number
  startLuck: number
  startSpeed: number
  startHeat: number
  startRadius: number
  startDamage: number
  startHaste: number
  startArmor: number
  startDodge: number
  startCrit: number
  startGrowth: number
  startMagnet: number
  startReach: number
  startArea: number
  startRegen: number
  autoPickup: boolean
  startFuse: number
  blessings: BlessingId[]
}

const DEFAULTS: MetaPersist = {
  v: 1,
  purse: 0,
  startHp: 0,
  startLuck: 0,
  startSpeed: 0,
  startHeat: 0,
  startRadius: 0,
  startDamage: 0,
  startHaste: 0,
  startArmor: 0,
  startDodge: 0,
  startCrit: 0,
  startGrowth: 0,
  startMagnet: 0,
  startReach: 0,
  startArea: 0,
  startRegen: 0,
  autoPickup: false,
  startFuse: 0,
  blessings: [],
}

const BLESSING_IDS = new Set<string>(BLESSINGS.map((b) => b.id))

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, Math.floor(n)))
}

function stackOf(p: Partial<MetaPersist>, key: keyof MetaPersist): number {
  const n = p[key]
  return clampInt(typeof n === 'number' ? n : 0, 0, STACK_MAX)
}

export function shopStackCount(meta: MetaPersist, id: ShopStackId): number {
  const key = STACK_FIELD[id]
  const n = meta[key]
  return typeof n === 'number' ? n : 0
}

export function loadMeta(): MetaPersist {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS, blessings: [] }
    const p = JSON.parse(raw) as Partial<MetaPersist>
    if (p.v !== 1) return { ...DEFAULTS, blessings: [] }
    const blessings = Array.isArray(p.blessings)
      ? p.blessings.filter((id): id is BlessingId => BLESSING_IDS.has(id))
      : []
    return {
      v: 1,
      purse: clampInt(typeof p.purse === 'number' ? p.purse : 0, 0, 99999),
      startHp: stackOf(p, 'startHp'),
      startLuck: stackOf(p, 'startLuck'),
      startSpeed: stackOf(p, 'startSpeed'),
      startHeat: stackOf(p, 'startHeat'),
      startRadius: stackOf(p, 'startRadius'),
      startDamage: stackOf(p, 'startDamage'),
      startHaste: stackOf(p, 'startHaste'),
      startArmor: stackOf(p, 'startArmor'),
      startDodge: stackOf(p, 'startDodge'),
      startCrit: stackOf(p, 'startCrit'),
      startGrowth: stackOf(p, 'startGrowth'),
      startMagnet: stackOf(p, 'startMagnet'),
      startReach: stackOf(p, 'startReach'),
      startArea: stackOf(p, 'startArea'),
      startRegen: stackOf(p, 'startRegen'),
      autoPickup: p.autoPickup === true,
      startFuse: clampInt(typeof p.startFuse === 'number' ? p.startFuse : 0, 0, START_FUSE_MAX),
      blessings,
    }
  } catch {
    return { ...DEFAULTS, blessings: [] }
  }
}

export function saveMeta(next: MetaPersist): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota */
  }
}

export function addPurse(amount: number): MetaPersist {
  const prev = loadMeta()
  const next: MetaPersist = {
    ...prev,
    blessings: [...prev.blessings],
    purse: prev.purse + Math.max(0, Math.floor(amount)),
  }
  saveMeta(next)
  return next
}

export type ShopStatus = 'ok' | 'poor' | 'owned' | 'max'

function isStackId(id: ShopGoodId): id is ShopStackId {
  return id in STACK_FIELD
}

export function shopStatus(meta: MetaPersist, id: ShopGoodId): ShopStatus {
  const good = SHOP_GOODS.find((g) => g.id === id)
  if (!good) return 'owned'
  if (isStackId(id)) {
    if (shopStackCount(meta, id) >= STACK_MAX) return 'max'
  } else if (id === 'autopick') {
    if (meta.autoPickup) return 'owned'
  } else if (id === 'startfuse') {
    if (meta.startFuse >= START_FUSE_MAX) return 'max'
  } else if (meta.blessings.includes(id)) {
    return 'owned'
  }
  if (meta.purse < good.price) return 'poor'
  return 'ok'
}

export function tryBuy(id: ShopGoodId): { ok: boolean; meta: MetaPersist } {
  const meta = loadMeta()
  const good = SHOP_GOODS.find((g) => g.id === id)
  if (!good) return { ok: false, meta }
  if (shopStatus(meta, id) !== 'ok') return { ok: false, meta }
  const next: MetaPersist = {
    ...meta,
    blessings: [...meta.blessings],
    purse: meta.purse - good.price,
  }
  if (isStackId(id)) {
    const key = STACK_FIELD[id]
    const cur = shopStackCount(next, id)
    Object.assign(next, { [key]: cur + 1 })
  } else if (id === 'autopick') next.autoPickup = true
  else if (id === 'startfuse') next.startFuse += 1
  else if (!next.blessings.includes(id)) next.blessings.push(id)
  saveMeta(next)
  return { ok: true, meta: next }
}

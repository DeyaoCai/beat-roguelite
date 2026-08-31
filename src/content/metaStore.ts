import {
  BLESSINGS,
  SHOP_GOODS,
  type BlessingId,
  type ShopGoodId,
} from './meta'

const KEY = 'beat-roguelite.meta.v1'
const HP_MAX = 3
const LUCK_MAX = 3
const SPEED_MAX = 3
const HEAT_MAX = 3
const RADIUS_MAX = 3

export type MetaPersist = {
  v: 1
  purse: number
  startHp: number
  startLuck: number
  startSpeed: number
  startHeat: number
  startRadius: number
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
  blessings: [],
}

const BLESSING_IDS = new Set<string>(BLESSINGS.map((b) => b.id))

function clampInt(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo
  return Math.max(lo, Math.min(hi, Math.floor(n)))
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
      startHp: clampInt(typeof p.startHp === 'number' ? p.startHp : 0, 0, HP_MAX),
      startLuck: clampInt(typeof p.startLuck === 'number' ? p.startLuck : 0, 0, LUCK_MAX),
      startSpeed: clampInt(typeof p.startSpeed === 'number' ? p.startSpeed : 0, 0, SPEED_MAX),
      startHeat: clampInt(typeof p.startHeat === 'number' ? p.startHeat : 0, 0, HEAT_MAX),
      startRadius: clampInt(typeof p.startRadius === 'number' ? p.startRadius : 0, 0, RADIUS_MAX),
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

export function shopStatus(meta: MetaPersist, id: ShopGoodId): ShopStatus {
  const good = SHOP_GOODS.find((g) => g.id === id)
  if (!good) return 'owned'
  if (id === 'hp') {
    if (meta.startHp >= HP_MAX) return 'max'
  } else if (id === 'luck') {
    if (meta.startLuck >= LUCK_MAX) return 'max'
  } else if (id === 'speed') {
    if (meta.startSpeed >= SPEED_MAX) return 'max'
  } else if (id === 'heat') {
    if (meta.startHeat >= HEAT_MAX) return 'max'
  } else if (id === 'radius') {
    if (meta.startRadius >= RADIUS_MAX) return 'max'
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
  if (id === 'hp') next.startHp += 1
  else if (id === 'luck') next.startLuck += 1
  else if (id === 'speed') next.startSpeed += 1
  else if (id === 'heat') next.startHeat += 1
  else if (id === 'radius') next.startRadius += 1
  else if (!next.blessings.includes(id)) next.blessings.push(id)
  saveMeta(next)
  return { ok: true, meta: next }
}

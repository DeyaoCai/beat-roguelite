import type { BlessingId, ContractId } from '../../content/meta'
import { CONTRACTS } from '../../content/meta'
import type { StarterId } from '../../content/weapons'
import { starterLabel } from '../../content/weapons'
import type { UpgradeId } from './upgrades'

/** Bank this much of run gold into the purse. 金手指相乘；契约加成分条相加。 */
export function settleRunGold(
  runGold: number,
  won: boolean,
  blessing: BlessingId | null = null,
  contracts: readonly ContractId[] = [],
): number {
  const g = Math.max(0, Math.floor(runGold))
  let bank = won ? g : Math.floor(g * 0.5)
  if (blessing === 'goldfinger') bank = Math.floor(bank * 1.5)
  bank = Math.floor(bank * contractBankMul(contracts))
  return bank
}

export function contractBankMul(ids: readonly ContractId[]): number {
  let extra = 0
  for (const id of ids) {
    const def = CONTRACTS.find((c) => c.id === id)
    if (def) extra += def.bankMul - 1
  }
  return 1 + extra
}

export function toggleContract(
  selected: readonly ContractId[],
  id: ContractId,
): { next: ContractId[]; ok: boolean } {
  if (selected.includes(id)) {
    return { next: selected.filter((x) => x !== id), ok: true }
  }
  return { next: [...selected, id], ok: true }
}

export function contractFromKey(key: string, code: string | null): ContractId | null {
  const k = key.length === 1 ? key.toLowerCase() : ''
  for (const c of CONTRACTS) {
    if (c.key === k) return c.id
    if (/^\d$/.test(c.key) && (code === `Digit${c.key}` || code === `Numpad${c.key}`)) {
      return c.id
    }
  }
  return null
}

const LEARN_BY_STARTER: Record<StarterId, UpgradeId> = {
  flame: 'learn_flame',
  spirit_orb: 'learn_orb',
  ward_aura: 'learn_aura',
  thunder_chain: 'learn_chain',
  starfall: 'learn_star',
  orbit: 'learn_orbit',
}

const STARTER_BY_LEARN: Record<string, StarterId> = {
  learn_flame: 'flame',
  learn_orb: 'spirit_orb',
  learn_aura: 'ward_aura',
  learn_chain: 'thunder_chain',
  learn_star: 'starfall',
  learn_orbit: 'orbit',
}

const ALL_LEARNS: UpgradeId[] = [
  'learn_flame',
  'learn_orb',
  'learn_aura',
  'learn_chain',
  'learn_star',
  'learn_orbit',
]

export function duoLearnPool(starter: StarterId): UpgradeId[] {
  const skip = LEARN_BY_STARTER[starter]
  return ALL_LEARNS.filter((id) => id !== skip)
}

export function duoLearnLabel(id: UpgradeId): string {
  const sid = STARTER_BY_LEARN[id]
  return sid ? starterLabel(sid) : id
}

export function starterForLearn(id: UpgradeId): StarterId | null {
  return STARTER_BY_LEARN[id] ?? null
}

export function cycleDuoLearn(
  starter: StarterId,
  current: UpgradeId | null,
  dir: 1 | -1,
): UpgradeId {
  const pool = duoLearnPool(starter)
  const i = current ? pool.indexOf(current) : -1
  const from = i < 0 ? 0 : (i + dir + pool.length) % pool.length
  return pool[from] ?? pool[0]!
}

export function ensureDuoLearn(starter: StarterId, current: UpgradeId | null): UpgradeId {
  const pool = duoLearnPool(starter)
  if (current && pool.includes(current)) return current
  return pool[0] ?? 'learn_orb'
}

/** Extra weapon to learn for 双修 (never the starter). */
export function pickDuoLearn(starter: StarterId, rng: () => number): UpgradeId {
  const pool = duoLearnPool(starter)
  return pool[Math.floor(rng() * pool.length)] ?? 'learn_orb'
}

/** Mods baked into loadout each run (permanent shop + this-run blessing + contracts). */
export type MetaLoadoutMods = {
  extraHp: number
  extraLuck: number
  /** 叠在 Kit 移速上；每层商店 +15%。 */
  moveSpeedMul: number
  /** 叠在热度衰减上；每层 ×0.75。 */
  heatDecayMul: number
  /** 叠在 Kit 受击半径上；每层 −12%。 */
  radiusMul: number
  glass: boolean
  feverGainMul: number
  contracts: ContractId[]
  hordeCapMul: number
  hordeRateMul: number
  ironHpMul: number
  muteFever: boolean
  /** 契约「素打」：拍点不加成、不画公路。 */
  muteBeat: boolean
  glassworld: boolean
}

const SPEED_PER_STACK = 0.1
const HEAT_DECAY_PER_STACK = 0.82
const RADIUS_SHRINK_PER_STACK = 0.1
const HP_PER_STACK = 1
const LUCK_PER_STACK = 1

export function metaLoadoutMods(
  startHp: number,
  startLuck: number,
  blessing: BlessingId | null,
  contracts: readonly ContractId[] = [],
  startSpeed = 0,
  startHeat = 0,
  startRadius = 0,
): MetaLoadoutMods {
  const ids = [...contracts]
  const speed = Math.max(0, startSpeed)
  const heat = Math.max(0, startHeat)
  const radius = Math.max(0, startRadius)
  return {
    extraHp: Math.max(0, startHp) * HP_PER_STACK,
    extraLuck: Math.max(0, startLuck) * LUCK_PER_STACK,
    moveSpeedMul: 1 + SPEED_PER_STACK * speed,
    heatDecayMul: heat > 0 ? HEAT_DECAY_PER_STACK ** heat : 1,
    radiusMul: Math.max(0.55, 1 - RADIUS_SHRINK_PER_STACK * radius),
    glass: blessing === 'glass',
    feverGainMul: blessing === 'fever' ? 1.22 : 1,
    contracts: ids,
    hordeCapMul: ids.includes('horde') ? 1.35 : 1,
    hordeRateMul: ids.includes('horde') ? 0.72 : 1,
    ironHpMul: ids.includes('iron') ? 1.28 : 1,
    muteFever: ids.includes('mute'),
    muteBeat: ids.includes('still'),
    glassworld: ids.includes('glassworld'),
  }
}

/** @deprecated 金手指改为入袋加成，开局不再带金。 */
export function blessingStartGold(_blessing: BlessingId | null): number {
  return 0
}

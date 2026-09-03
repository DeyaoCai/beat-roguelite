import type { BlessingId, ContractId } from '../../content/meta'
import { CONTRACTS } from '../../content/meta'
import {
  BLESSING_COMBAT,
  CONTRACT_COMBAT,
  SHOP_STACKS,
} from '../../content/rules'
import { fuseIdForOffhand, type FuseUpgradeId } from '../../content/fusions'
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
  let bank = won ? g : Math.floor(g * BLESSING_COMBAT.lossBankFrac)
  if (blessing === 'goldfinger') bank = Math.floor(bank * BLESSING_COMBAT.goldfingerBankMul)
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
}

const STARTER_BY_LEARN: Record<string, StarterId> = {
  learn_flame: 'flame',
  learn_orb: 'spirit_orb',
  learn_aura: 'ward_aura',
  learn_chain: 'thunder_chain',
  learn_star: 'starfall',
}

const ALL_LEARNS: UpgradeId[] = [
  'learn_flame',
  'learn_orb',
  'learn_aura',
  'learn_chain',
  'learn_star',
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

/** 商店开局融合层数。最多四门（除主手外全融）。 */
export function startFuseNeed(shopStacks: number): number {
  return Math.min(SHOP_STACKS.startFuseMax, Math.max(0, shopStacks))
}

export function ensureStartFuses(
  starter: StarterId,
  selected: readonly UpgradeId[],
  need: number,
): UpgradeId[] {
  if (need <= 0) return []
  const pool = duoLearnPool(starter)
  const out: UpgradeId[] = []
  for (const id of selected) {
    if (!pool.includes(id) || out.includes(id)) continue
    out.push(id)
    if (out.length >= need) return out
  }
  for (const id of pool) {
    if (out.includes(id)) continue
    out.push(id)
    if (out.length >= need) break
  }
  return out
}

export function cycleStartFuseCursor(
  starter: StarterId,
  cursor: UpgradeId | null,
  dir: 1 | -1,
): UpgradeId {
  return cycleDuoLearn(starter, cursor, dir)
}

/** 勾选 / 取消一门；超出 need 时挤掉最早那门。 */
export function toggleStartFuse(
  starter: StarterId,
  selected: readonly UpgradeId[],
  learnId: UpgradeId,
  need: number,
): UpgradeId[] {
  const pool = duoLearnPool(starter)
  if (need <= 0 || !pool.includes(learnId)) return ensureStartFuses(starter, selected, need)
  const kept = selected.filter((id) => pool.includes(id) && id !== learnId)
  if (selected.includes(learnId)) {
    if (kept.length === 0) return [learnId]
    return kept
  }
  const next = [...kept, learnId]
  return next.length > need ? next.slice(next.length - need) : next
}

/** Extra weapon to fuse at start (never the starter). */
export function pickDuoLearn(starter: StarterId, rng: () => number): UpgradeId {
  const pool = duoLearnPool(starter)
  return pool[Math.floor(rng() * pool.length)] ?? 'learn_orb'
}

/** 开局融进主手的那张融合卡。 */
export function duoFuseUpgradeId(starter: StarterId, learnId: UpgradeId): FuseUpgradeId {
  const off = starterForLearn(ensureDuoLearn(starter, learnId)) ?? 'spirit_orb'
  return fuseIdForOffhand(off)
}

/** Mods baked into loadout each run (permanent shop + this-run blessing + contracts). */
export type MetaLoadoutMods = {
  extraHp: number
  extraLuck: number
  /** 叠在 Kit 移速上；每层商店 +10%。 */
  moveSpeedMul: number
  /** 叠在热度衰减上。 */
  heatDecayMul: number
  /** 叠在 Kit 受击半径上；每层 −10%。 */
  radiusMul: number
  /** 商店：全场吸入金币 / 经验 / 遗物。 */
  autoPickup: boolean
  damageAdd: number
  hasteAdd: number
  armorDr: number
  dodgeChance: number
  critChance: number
  xpMulAdd: number
  magnetAdd: number
  castReachAdd: number
  castAreaAdd: number
  hpRegen: number
  glass: boolean
  feverGainMul: number
  contracts: ContractId[]
  hordeCapMul: number
  hordeRateMul: number
  ironHpMul: number
  muteFever: boolean
  /** 契约「素打」：拍点不加成、不画公路。 */
  muteBeat: boolean
  /** 契约「盲抽」：三选随机，不能挑。 */
  wildPick: boolean
  glassworld: boolean
}

const S = SHOP_STACKS

export type ShopRunStacks = {
  startHp: number
  startLuck: number
  startSpeed?: number
  startHeat?: number
  startRadius?: number
  autoPickup?: boolean
  startDamage?: number
  startHaste?: number
  startArmor?: number
  startDodge?: number
  startCrit?: number
  startGrowth?: number
  startMagnet?: number
  startReach?: number
  startArea?: number
  startRegen?: number
}

function n(v: number | undefined): number {
  return Math.max(0, v ?? 0)
}

export function metaLoadoutMods(
  shop: ShopRunStacks,
  blessing: BlessingId | null,
  contracts: readonly ContractId[] = [],
  opts?: { forceMuteBeat?: boolean },
): MetaLoadoutMods {
  const ids = [...contracts]
  const speed = n(shop.startSpeed)
  const heat = n(shop.startHeat)
  const radius = n(shop.startRadius)
  return {
    extraHp: n(shop.startHp) * S.hpPerStack,
    extraLuck: n(shop.startLuck) * S.luckPerStack,
    moveSpeedMul: 1 + S.speedPerStack * speed,
    heatDecayMul: heat > 0 ? S.heatDecayPerStack ** heat : 1,
    radiusMul: Math.max(S.radiusFloor, 1 - S.radiusShrinkPerStack * radius),
    autoPickup: !!shop.autoPickup,
    damageAdd: n(shop.startDamage) * S.damagePerStack,
    hasteAdd: n(shop.startHaste) * S.hastePerStack,
    armorDr: n(shop.startArmor) * S.armorPerStack,
    dodgeChance: n(shop.startDodge) * S.dodgePerStack,
    critChance: n(shop.startCrit) * S.critPerStack,
    xpMulAdd: n(shop.startGrowth) * S.growthPerStack,
    magnetAdd: n(shop.startMagnet) * S.magnetPerStack,
    castReachAdd: n(shop.startReach) * S.reachPerStack,
    castAreaAdd: n(shop.startArea) * S.areaPerStack,
    hpRegen: n(shop.startRegen) * S.regenPerStack,
    glass: blessing === 'glass',
    feverGainMul: blessing === 'fever' ? BLESSING_COMBAT.feverGainMul : 1,
    contracts: ids,
    hordeCapMul: ids.includes('horde') ? CONTRACT_COMBAT.hordeCapMul : 1,
    hordeRateMul: ids.includes('horde') ? CONTRACT_COMBAT.hordeRateMul : 1,
    ironHpMul: ids.includes('iron') ? CONTRACT_COMBAT.ironHpMul : 1,
    muteFever: ids.includes('mute'),
    muteBeat: ids.includes('still') || !!opts?.forceMuteBeat,
    wildPick: ids.includes('wild'),
    glassworld: ids.includes('glassworld'),
  }
}

/** @deprecated 金手指改为入袋加成，开局不再带金。 */
export function blessingStartGold(_blessing: BlessingId | null): number {
  return 0
}

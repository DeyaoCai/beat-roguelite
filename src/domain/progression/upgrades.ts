import type { StarterId } from '../../content/weapons'
import { DEFAULT_STARTER } from '../../content/weapons'
import {
  fusedOffhandsOf,
  isSkillDirId,
  learnIdForOffhand,
  type FuseUpgradeId,
} from '../../content/fusions'
import {
  CARD_TIERS,
  CONTRACT_COMBAT,
  GRADE_DETAILS,
  LUCK_GRADE,
  MAGIC_SLOTS,
  OFFER_COUNT,
  STACKABLE_IDS,
  START_TIER,
  UPGRADE_POOL_ROWS,
  cardMeta,
  ownedSkills,
  type CardTier,
  type PickCtx,
} from '../../content/rules'

export type UpgradeId =
  | 'fire_rate'
  | 'spread'
  | 'pierce'
  | 'heat_cap'
  | 'heat_decay'
  | 'move_speed'
  | 'max_hp'
  | 'hp_regen'
  | 'damage'
  | 'haste'
  | 'luck'
  | 'armor'
  | 'dodge'
  | 'crit'
  | 'growth'
  | 'magnet'
  | 'cast_reach'
  | 'cast_area'
  | 'beat_bonus'
  | 'melee_range'
  | 'melee_power'
  | 'aura_widen'
  | 'aura_slow'
  | 'orb_split'
  | 'chain_fork'
  | 'chain_reach'
  | 'star_rain'
  | 'star_crater'
  | 'star_volley'
  | 'elem_break'
  | 'elem_explode'
  | 'elem_freeze'
  | 'elem_amp'
  | 'elem_weak'
  | 'learn_flame'
  | 'learn_orb'
  | 'learn_aura'
  | 'learn_chain'
  | 'learn_star'
  | 'flame_dmg'
  | 'flame_cd'
  | 'orb_dmg'
  | 'aura_dmg'
  | 'aura_cd'
  | 'chain_dmg'
  | 'chain_cd'
  | 'star_dmg'
  | 'star_scale'
  | 'relic_ward'
  | 'relic_leech'
  | 'relic_carapace'
  | 'relic_greed'
  | 'relic_ember'
  | 'relic_spark'
  | 'rhythm_window'
  | 'rhythm_fever_gain'
  | 'rhythm_fever_hold'
  | 'rhythm_combo_soft'
  | 'rhythm_combo_cap'
  | 'fuse_flame'
  | 'fuse_orb'
  | 'fuse_aura'
  | 'fuse_chain'
  | 'fuse_star'

/** special = 关底优先；stat = 属性多档（受幸运影响） */
export type UpgradeKind = 'special' | 'stat'

export type UpgradeGrade = 1 | 2 | 3

export type UpgradeDef = {
  id: UpgradeId
  name: string
  desc: string
  kind: UpgradeKind
  tier: CardTier
  eligible: (ctx: PickCtx) => boolean
  title?: (ctx: PickCtx) => { name: string; desc: string }
}

export type OwnedUpgrade = {
  id: UpgradeId
  grade: UpgradeGrade
  /** 池表行指针；取文案 / kind 走 meta。 */
  meta: UpgradeDef
}

export type UpgradeOffer = UpgradeDef & {
  grade: UpgradeGrade
  /** Display line with grade baked in. */
  label: string
  detail: string
  /** 池表行指针（与 id/name/desc 同源）；取文案优先 meta。 */
  meta: UpgradeDef
}

export const UPGRADE_POOL: UpgradeDef[] = UPGRADE_POOL_ROWS.map((r) => {
  const m = cardMeta(r.id)
  return {
    id: r.id as UpgradeId,
    name: r.name,
    desc: r.desc,
    kind: r.kind,
    tier: m.tier,
    eligible: m.eligible,
    title: m.title,
  }
})

/** 实例化已拥有升级；缺表时用 stub，避免 fuse/learn 漏行炸局。 */
export function makeOwned(
  id: UpgradeId,
  grade: UpgradeGrade,
  meta?: UpgradeDef,
): OwnedUpgrade {
  const def =
    meta ??
    UPGRADE_POOL.find((u) => u.id === id) ??
    ({
      id,
      name: id,
      desc: '',
      kind: 'special',
      tier: 'stat',
      eligible: () => false,
    } satisfies UpgradeDef)
  return { id, grade, meta: def }
}

const STACKABLE: UpgradeId[] = [...STACKABLE_IDS] as UpgradeId[]

export function isStackableUpgrade(id: string): boolean {
  return STACKABLE.includes(id as UpgradeId)
}

const GRADE_MARK = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'] as const

export function totalLuck(owned: OwnedUpgrade[]): number {
  let n = 0
  for (const u of owned) {
    if (u.id === 'luck') n += u.grade
  }
  return n
}

/** Higher luck → more weight on grade 2/3. Weights from content/rules. */
export function rollGrade(luck: number, rng: () => number): UpgradeGrade {
  const g = LUCK_GRADE
  const t = Math.min(g.luckCap, Math.max(0, luck))
  let w1 = Math.max(g.w1Floor, g.baseW1 + t * g.w1PerLuck)
  let w2 = g.baseW2 + t * g.w2PerLuck
  let w3 = g.baseW3 + t * g.w3PerLuck
  const sum = w1 + w2 + w3
  w1 /= sum
  w2 /= sum
  const r = rng()
  if (r < w1) return 1
  if (r < w1 + w2) return 2
  return 3
}

export function gradeDetail(id: UpgradeId, grade: UpgradeGrade): string {
  const row = GRADE_DETAILS[id]
  if (row) return row[grade - 1]!
  return UPGRADE_POOL.find((u) => u.id === id)?.desc ?? ''
}

function makeOffer(def: UpgradeDef, grade: UpgradeGrade): UpgradeOffer {
  const g = def.kind === 'special' ? 1 : grade
  const mark = def.kind === 'stat' ? GRADE_MARK[g] : ''
  return {
    ...def,
    meta: def,
    grade: g,
    label: mark ? `${def.name} ${mark}` : def.name,
    detail: def.kind === 'stat' ? gradeDetail(def.id, g) : def.desc,
  }
}

/** 副手软顶见 magicSlotCap(level)；再出「习得」会淹没主手拍点。 */
const LEARN_IDS: UpgradeId[] = [
  'learn_flame',
  'learn_orb',
  'learn_aura',
  'learn_chain',
  'learn_star',
]

export function isLearnUpgradeId(id: UpgradeId): boolean {
  return LEARN_IDS.includes(id)
}

/** 本门单方向（伤 / 冷却 / 范围），可叠。 */
export function isSpellBoostId(id: UpgradeId): boolean {
  return isSkillDirId(id)
}

function starterOfLearn(id: UpgradeId): StarterId | null {
  switch (id) {
    case 'learn_flame':
      return 'flame'
    case 'learn_orb':
      return 'spirit_orb'
    case 'learn_aura':
      return 'ward_aura'
    case 'learn_chain':
      return 'thunder_chain'
    case 'learn_star':
      return 'starfall'
    default:
      return null
  }
}

/** 仍在自动开火的副手数（融合吃掉的不算）。 */
export function activeOffhandCount(starter: StarterId, owned: OwnedUpgrade[]): number {
  const fusedOff = fusedOffhandsOf(owned)
  let n = 0
  for (const id of LEARN_IDS) {
    if (!owned.some((o) => o.id === id)) continue
    const sid = starterOfLearn(id)
    if (!sid || sid === starter) continue
    if (fusedOff.includes(sid)) continue
    n += 1
  }
  return n
}

/**
 * 魔法槽（副手）数量：只装「习得」门，主手不占槽。
 * 阈值见 content/rules/magicSlots。已占用的槽不会因等级不够被踢掉。
 */
export const MAGIC_SLOT_MAX = MAGIC_SLOTS.max
/** 每隔多少级解锁一格魔法槽。 */
export const MAGIC_SLOT_EVERY_LEVELS = MAGIC_SLOTS.everyLevels

export function magicSlotCap(level: number): number {
  const lv = Math.max(1, level)
  return Math.min(MAGIC_SLOTS.max, Math.floor(lv / MAGIC_SLOTS.everyLevels))
}

/** @deprecated 用 magicSlotCap(level)；保留别名避免旧引用炸掉。 */
export const OFFHAND_CAP = MAGIC_SLOT_MAX

export function freeMagicSlots(
  starter: StarterId,
  owned: OwnedUpgrade[],
  level: number,
): number {
  const filled = activeOffhandCount(starter, owned)
  return Math.max(0, magicSlotCap(level) - filled)
}

export function atOffhandCap(
  starter: StarterId,
  owned: OwnedUpgrade[],
  level = 99,
): boolean {
  return activeOffhandCount(starter, owned) >= magicSlotCap(level)
}

/** 刚升到该级时新解锁一格魔法槽（10 / 20 / 30…）。 */
export function magicSlotUnlockedAt(level: number): boolean {
  const lv = Math.max(1, level)
  if (lv % MAGIC_SLOTS.everyLevels !== 0) return false
  const slots = lv / MAGIC_SLOTS.everyLevels
  return slots >= 1 && slots <= MAGIC_SLOTS.max
}

/** 还可被融合吃掉的副手（已融的不算）。 */
export function ownedFusableOffhands(
  starter: StarterId,
  owned: OwnedUpgrade[],
): StarterId[] {
  const fused = fusedOffhandsOf(owned)
  const outs: StarterId[] = []
  const tryAdd = (id: StarterId) => {
    if (id === starter) return
    if (fused.includes(id)) return
    if (owned.some((o) => o.id === learnIdForOffhand(id))) outs.push(id)
  }
  tryAdd('flame')
  tryAdd('spirit_orb')
  tryAdd('ward_aura')
  tryAdd('thunder_chain')
  tryAdd('starfall')
  return outs
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]!
    out[i] = out[j]!
    out[j] = tmp
  }
  return out
}

export type PickMode = 'level' | 'drop_minor' | 'drop_major' | 'wave' | 'chest'

export type PickOpts = {
  preferRhythm?: boolean
  level?: number
  muteBeat?: boolean
  autoPickup?: boolean
}

function pickCtx(
  owned: OwnedUpgrade[],
  mode: PickMode,
  starter: StarterId,
  opts?: PickOpts,
): PickCtx {
  const ownedIds = owned.map((o) => o.id)
  const fused = fusedOffhandsOf(owned)
  return {
    mode,
    starter,
    owned: ownedIds,
    fused,
    skills: ownedSkills(starter, fused, ownedIds),
    muteBeat: !!opts?.muteBeat,
    autoPickup: !!opts?.autoPickup,
  }
}

/**
 * 从这次能拿到的最高层开始：滤（meta.eligible）→ 打乱 → 舀；不够下一层。
 */
export function pickThree(
  rng: () => number,
  owned: OwnedUpgrade[],
  mode: PickMode = 'level',
  starter: StarterId = DEFAULT_STARTER,
  opts?: PickOpts,
): UpgradeOffer[] {
  const ctx = pickCtx(owned, mode, starter, opts)
  const luck = totalLuck(owned)
  const from = CARD_TIERS.indexOf(START_TIER[mode])
  const picked: UpgradeOffer[] = []
  const seen = new Set<string>()
  for (const tier of CARD_TIERS.slice(from < 0 ? CARD_TIERS.length : from)) {
    const pool = shuffle(
      UPGRADE_POOL.filter((c) => c.tier === tier && !seen.has(c.id) && c.eligible(ctx)),
      rng,
    )
    for (const c of pool) {
      if (picked.length >= OFFER_COUNT) return picked
      seen.add(c.id)
      const face = c.title?.(ctx)
      picked.push(
        makeOffer(face ? { ...c, name: face.name, desc: face.desc } : c, rollGrade(luck, rng)),
      )
    }
  }
  return picked
}

/** 契约盲抽：升级人物属性池随机一张 Ⅰ。 */
export function rollStartStat(
  rng: () => number,
  owned: OwnedUpgrade[],
  starter: StarterId = DEFAULT_STARTER,
  opts?: PickOpts,
): OwnedUpgrade | null {
  const ctx = pickCtx(owned, 'level', starter, opts)
  const pool = UPGRADE_POOL.filter((c) => c.tier === 'stat' && c.eligible(ctx))
  if (pool.length === 0) return null
  const def = pool[Math.floor(rng() * pool.length)]!
  return makeOwned(def.id, CONTRACT_COMBAT.wildGrade, def)
}

export type { FuseUpgradeId }

/** @deprecated use UpgradeOffer; kept for type aliases in UI */
export type UpgradeTier = UpgradeKind

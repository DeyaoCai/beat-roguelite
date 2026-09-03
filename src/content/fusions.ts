import { starterLabel, type StarterId } from './weapons'

/** 副手被融合后嫁接到主手击中链上的传打。 */
export type GraftTrait =
  | 'split'
  | 'bounce'
  | 'slow'
  | 'knockback'
  | 'volley'

export type FuseUpgradeId =
  | 'fuse_flame'
  | 'fuse_orb'
  | 'fuse_aura'
  | 'fuse_chain'
  | 'fuse_star'

export type LearnUpgradeId =
  | 'learn_flame'
  | 'learn_orb'
  | 'learn_aura'
  | 'learn_chain'
  | 'learn_star'

/** 本门单方向（伤 / 冷却 / 范围）。单技能后不再进三选；表仍给旧档位结算。 */
export const SKILL_DIRS: Record<StarterId, readonly string[]> = {
  flame: ['flame_dmg', 'flame_cd', 'melee_range'],
  spirit_orb: ['orb_dmg', 'fire_rate'],
  ward_aura: ['aura_dmg', 'aura_cd', 'aura_widen'],
  thunder_chain: ['chain_dmg', 'chain_cd', 'chain_reach'],
  starfall: ['star_dmg', 'star_rain', 'star_scale'],
}

export const SKILL_DIR_IDS: readonly string[] = [
  ...SKILL_DIRS.flame,
  ...SKILL_DIRS.spirit_orb,
  ...SKILL_DIRS.ward_aura,
  ...SKILL_DIRS.thunder_chain,
  ...SKILL_DIRS.starfall,
]

const FUSE_BY_OFFHAND: Record<StarterId, FuseUpgradeId> = {
  flame: 'fuse_flame',
  spirit_orb: 'fuse_orb',
  ward_aura: 'fuse_aura',
  thunder_chain: 'fuse_chain',
  starfall: 'fuse_star',
}

const OFFHAND_BY_FUSE: Record<FuseUpgradeId, StarterId> = {
  fuse_flame: 'flame',
  fuse_orb: 'spirit_orb',
  fuse_aura: 'ward_aura',
  fuse_chain: 'thunder_chain',
  fuse_star: 'starfall',
}

const LEARN_BY_OFFHAND: Record<StarterId, LearnUpgradeId> = {
  flame: 'learn_flame',
  spirit_orb: 'learn_orb',
  ward_aura: 'learn_aura',
  thunder_chain: 'learn_chain',
  starfall: 'learn_star',
}

const GRAFT_BY_OFFHAND: Record<StarterId, GraftTrait> = {
  flame: 'knockback',
  spirit_orb: 'split',
  ward_aura: 'slow',
  thunder_chain: 'bounce',
  starfall: 'volley',
}

const GRAFT_BLURB: Record<GraftTrait, string> = {
  split: '打中后分裂',
  bounce: '打中后再串一人',
  slow: '击中周围减速',
  knockback: '沿途击中',
  volley: 'CD 转好多出一手',
}

const GRAFT_SHORT: Record<GraftTrait, string> = {
  split: '分裂',
  bounce: '弹射',
  slow: '减速',
  knockback: '击退',
  volley: '多发',
}

export const FUSE_UPGRADE_IDS: FuseUpgradeId[] = [
  'fuse_flame',
  'fuse_orb',
  'fuse_aura',
  'fuse_chain',
  'fuse_star',
]

export function isFuseUpgradeId(id: string): id is FuseUpgradeId {
  return (FUSE_UPGRADE_IDS as string[]).includes(id)
}

export function fuseIdForOffhand(off: StarterId): FuseUpgradeId {
  return FUSE_BY_OFFHAND[off]
}

export function offhandForFuseId(id: FuseUpgradeId): StarterId {
  return OFFHAND_BY_FUSE[id]
}

export function learnIdForOffhand(off: StarterId): LearnUpgradeId {
  return LEARN_BY_OFFHAND[off]
}

export function isSkillDirId(id: string): boolean {
  return (SKILL_DIR_IDS as readonly string[]).includes(id)
}

export function graftTraitFrom(off: StarterId): GraftTrait {
  return GRAFT_BY_OFFHAND[off]
}

/** 主手自身特效在前，再按融合顺序。多发不是特效轮，不进表。 */
export function effectOrderOf(starter: StarterId, fused: readonly StarterId[]): GraftTrait[] {
  const order: GraftTrait[] = []
  const add = (t: GraftTrait) => {
    if (t === 'volley') return
    if (!order.includes(t)) order.push(t)
  }
  add(graftTraitFrom(starter))
  for (const off of fused) add(graftTraitFrom(off))
  return order
}

export function graftShortOf(off: StarterId): string {
  return GRAFT_SHORT[GRAFT_BY_OFFHAND[off]]
}

export function graftBlurbOf(off: StarterId): string {
  return GRAFT_BLURB[GRAFT_BY_OFFHAND[off]]
}

export function fuseOfferName(main: StarterId, off: StarterId): string {
  return `融合 · ${starterLabel(main)}×${starterLabel(off)}`
}

export function fuseOfferDesc(off: StarterId): string {
  const g = GRAFT_BY_OFFHAND[off]
  return `关末融进主手 · 主手${GRAFT_BLURB[g]}`
}

export function fusedOffhandsOf(owned: { id: string }[]): StarterId[] {
  const out: StarterId[] = []
  for (const o of owned) {
    if (isFuseUpgradeId(o.id)) out.push(offhandForFuseId(o.id))
  }
  return out
}

/**
 * 技能层级：持有为 1，该门单方向升级按档累加（Ⅰ=+1 Ⅱ=+2 Ⅲ=+3）。
 * 未持有 / 已融掉 → 0。
 */
export function spellLevel(
  starter: StarterId,
  owned: { id: string; grade: number }[],
  sid: StarterId,
): number {
  const fusedOff = fusedOffhandsOf(owned)
  const learn = learnIdForOffhand(sid)
  const held =
    starter === sid || (!fusedOff.includes(sid) && owned.some((o) => o.id === learn))
  if (!held) return 0
  const dirs = SKILL_DIRS[sid]
  let lv = 1
  for (const o of owned) {
    if (dirs.includes(o.id)) lv += o.grade
  }
  return lv
}

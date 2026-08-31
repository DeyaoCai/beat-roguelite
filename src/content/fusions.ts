import { starterLabel, type StarterId } from './weapons'

/** 副手被融合后嫁接到主手击中链上的传打。 */
export type GraftTrait =
  | 'split'
  | 'bounce'
  | 'slow'
  | 'knockback'
  | 'splash'
  | 'cleave'

export type FuseUpgradeId =
  | 'fuse_flame'
  | 'fuse_orb'
  | 'fuse_aura'
  | 'fuse_chain'
  | 'fuse_star'
  | 'fuse_orbit'

export type LearnUpgradeId =
  | 'learn_flame'
  | 'learn_orb'
  | 'learn_aura'
  | 'learn_chain'
  | 'learn_star'
  | 'learn_orbit'

export type SpellBoostId =
  | 'spell_flame'
  | 'spell_orb'
  | 'spell_aura'
  | 'spell_chain'
  | 'spell_star'
  | 'spell_orbit'

/** 主手灌注层级达到此值才可自动融合。 */
export const AUTO_FUSE_MAIN_LEVEL = 3
/** 副手灌注层级达到此值才可自动融合。 */
export const AUTO_FUSE_OFF_LEVEL = 3

const FUSE_BY_OFFHAND: Record<StarterId, FuseUpgradeId> = {
  flame: 'fuse_flame',
  spirit_orb: 'fuse_orb',
  ward_aura: 'fuse_aura',
  thunder_chain: 'fuse_chain',
  starfall: 'fuse_star',
  orbit: 'fuse_orbit',
}

const OFFHAND_BY_FUSE: Record<FuseUpgradeId, StarterId> = {
  fuse_flame: 'flame',
  fuse_orb: 'spirit_orb',
  fuse_aura: 'ward_aura',
  fuse_chain: 'thunder_chain',
  fuse_star: 'starfall',
  fuse_orbit: 'orbit',
}

const LEARN_BY_OFFHAND: Record<StarterId, LearnUpgradeId> = {
  flame: 'learn_flame',
  spirit_orb: 'learn_orb',
  ward_aura: 'learn_aura',
  thunder_chain: 'learn_chain',
  starfall: 'learn_star',
  orbit: 'learn_orbit',
}

const SPELL_BOOST_BY: Record<StarterId, SpellBoostId> = {
  flame: 'spell_flame',
  spirit_orb: 'spell_orb',
  ward_aura: 'spell_aura',
  thunder_chain: 'spell_chain',
  starfall: 'spell_star',
  orbit: 'spell_orbit',
}

const GRAFT_BY_OFFHAND: Record<StarterId, GraftTrait> = {
  flame: 'knockback',
  spirit_orb: 'split',
  ward_aura: 'slow',
  thunder_chain: 'bounce',
  starfall: 'splash',
  orbit: 'cleave',
}

const GRAFT_BLURB: Record<GraftTrait, string> = {
  split: '打中后分裂',
  bounce: '打中后再串一人',
  slow: '打中附带减速',
  knockback: '打中附带击退',
  splash: '打中溅射一下',
  cleave: '打中额外轻伤附近',
}

export const FUSE_UPGRADE_IDS: FuseUpgradeId[] = [
  'fuse_flame',
  'fuse_orb',
  'fuse_aura',
  'fuse_chain',
  'fuse_star',
  'fuse_orbit',
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

export function spellBoostIdFor(sid: StarterId): SpellBoostId {
  return SPELL_BOOST_BY[sid]
}

export function graftTraitFrom(off: StarterId): GraftTrait {
  return GRAFT_BY_OFFHAND[off]
}

export function fuseOfferName(main: StarterId, off: StarterId): string {
  return `融合 · ${starterLabel(main)}×${starterLabel(off)}`
}

export function fuseOfferDesc(off: StarterId): string {
  const g = GRAFT_BY_OFFHAND[off]
  return `主手×副手都灌注到阈值后自动融合 · 吃掉「${starterLabel(off)}」· 主手${GRAFT_BLURB[g]}`
}

/**
 * 技能灌注层级：持有为 1，每张「灌注」按档位累加（Ⅰ=+1 Ⅱ=+2 Ⅲ=+3）。
 * 未持有 / 已融掉 → 0。
 */
export function spellLevel(
  starter: StarterId,
  owned: { id: string; grade: number }[],
  sid: StarterId,
): number {
  const fused = owned.find((o) => isFuseUpgradeId(o.id))
  const fusedOff =
    fused && isFuseUpgradeId(fused.id) ? offhandForFuseId(fused.id) : null
  const learn = learnIdForOffhand(sid)
  const held =
    starter === sid || (fusedOff !== sid && owned.some((o) => o.id === learn))
  if (!held) return 0
  const boost = spellBoostIdFor(sid)
  let lv = 1
  for (const o of owned) {
    if (o.id === boost) lv += o.grade
  }
  return lv
}

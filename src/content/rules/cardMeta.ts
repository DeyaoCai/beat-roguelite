/**
 * 抽卡：卡自己的 meta.eligible(ctx) 决定出不出。
 * 引擎只按层从高到低舀满三张。
 */
import type { StarterId } from '../weapons'
import {
  FUSE_UPGRADE_IDS,
  fuseOfferDesc,
  fuseOfferName,
  isSkillDirId,
  learnIdForOffhand,
  offhandForFuseId,
} from '../fusions'
import { RELIC_IDS, RELIC_RULES } from './relics'
import { RHYTHM_IDS } from './rhythm'
import { UPGRADE_POOL_ROWS } from './upgradePool'
import { WAVE_STARTER_CARDS, type PickModeId } from './pickPolicies'

export type CardTier = 'learn' | 'specialist' | 'elem' | 'rhythm' | 'relic' | 'stat'

/** 高 → 低。一次三选从这次能拿到的最高层开始往下舀。 */
export const CARD_TIERS: readonly CardTier[] = [
  'learn',
  'specialist',
  'elem',
  'rhythm',
  'relic',
  'stat',
]

export const START_TIER: Record<PickModeId, CardTier> = {
  wave: 'learn',
  drop_minor: 'specialist',
  drop_major: 'specialist',
  level: 'stat',
  chest: 'relic',
}

export type PickCtx = {
  mode: PickModeId
  starter: StarterId
  /** 主手 + 已融 + 旧习得。专属 / 满层只认这个名单。 */
  skills: readonly StarterId[]
  owned: readonly string[]
  fused: readonly StarterId[]
  muteBeat: boolean
  /** 商店自动拾取：全场吸入，磁铁半径卡无效。 */
  autoPickup: boolean
}

export type CardMeta = {
  tier: CardTier
  eligible: (ctx: PickCtx) => boolean
  title?: (ctx: PickCtx) => { name: string; desc: string }
}

export function ownedSkills(
  starter: StarterId,
  fused: readonly StarterId[],
  owned: readonly string[],
): StarterId[] {
  const have = new Set<StarterId>([starter, ...fused])
  for (const sid of Object.keys(WAVE_STARTER_CARDS) as StarterId[]) {
    if (owned.includes(learnIdForOffhand(sid))) have.add(sid)
  }
  return [...have]
}

function hasSkill(sid: StarterId, ctx: PickCtx): boolean {
  return ctx.skills.includes(sid)
}

function notOwned(id: string, ctx: PickCtx): boolean {
  return !ctx.owned.includes(id)
}

function relicCount(ctx: PickCtx): number {
  return RELIC_IDS.filter((id) => ctx.owned.includes(id)).length
}

const META: Record<string, CardMeta> = {}

for (const sid of Object.keys(WAVE_STARTER_CARDS) as StarterId[]) {
  const row = WAVE_STARTER_CARDS[sid]
  if ('specialist' in row) {
    META[row.specialist] = {
      tier: 'specialist',
      eligible: (ctx) => hasSkill(sid, ctx),
    }
  }
  META[row.elem] = {
    tier: 'elem',
    eligible: (ctx) => hasSkill(sid, ctx) && notOwned(row.elem, ctx),
  }
}

for (const id of FUSE_UPGRADE_IDS) {
  const off = offhandForFuseId(id)
  META[id] = {
    tier: 'learn',
    eligible: (ctx) => ctx.starter !== off && !ctx.fused.includes(off),
    title: (ctx) => ({
      name: fuseOfferName(ctx.starter, off),
      desc: fuseOfferDesc(off),
    }),
  }
}

META.beat_bonus = {
  tier: 'rhythm',
  eligible: (ctx) => !ctx.muteBeat,
}

for (const id of RHYTHM_IDS) {
  META[id] = {
    tier: 'rhythm',
    eligible: (ctx) =>
      !ctx.muteBeat && ctx.mode === 'drop_major' && notOwned(id, ctx),
  }
}

for (const id of RELIC_IDS) {
  META[id] = {
    tier: 'relic',
    eligible: (ctx) =>
      ctx.mode === 'chest' &&
      notOwned(id, ctx) &&
      relicCount(ctx) < RELIC_RULES.cap,
  }
}

META.magnet = {
  tier: 'stat',
  eligible: (ctx) => !ctx.autoPickup,
}

for (const row of UPGRADE_POOL_ROWS) {
  if (row.kind !== 'stat' || isSkillDirId(row.id) || META[row.id]) continue
  META[row.id] = {
    tier: 'stat',
    eligible: () => true,
  }
}

export const CARD_META: Readonly<Record<string, CardMeta>> = META

export function cardMeta(id: string): CardMeta {
  return CARD_META[id] ?? { tier: 'stat', eligible: () => false }
}

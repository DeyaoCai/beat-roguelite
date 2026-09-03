import {
  ARMOR_BY_KIND,
  FODDER_KINDS,
  type BossRuleDef,
  type FodderKindRule,
  type SpawnFodderKind,
} from '../../content/rules'
import type { EnemyKind } from './types'

export type EnemyRole = 'trash' | 'tank' | 'elite' | 'boss' | 'chest'

/**
 * Runtime 挂的 meta 指针：实例看关联、取数走表。
 * 不把表字段抄进 Enemy（血量/位置等仍是实例态）。
 */
export type EnemyMeta = {
  kind: EnemyKind
  role: EnemyRole
  /** 表内基础护甲（波次加成在实例 armor 上）。 */
  armor: number
  fodder?: FodderKindRule
  boss?: BossRuleDef
}

const FODDER_KINDS_SET = new Set<string>(Object.keys(FODDER_KINDS))

export function makeEnemyMeta(kind: EnemyKind, boss?: BossRuleDef): EnemyMeta {
  const armor = ARMOR_BY_KIND[kind] ?? ARMOR_BY_KIND.chaser ?? 0.02
  if (kind === 'boss') {
    return { kind, role: 'boss', armor, boss }
  }
  if (kind === 'elite') return { kind, role: 'elite', armor }
  if (kind === 'chest') return { kind, role: 'chest', armor }
  if (FODDER_KINDS_SET.has(kind)) {
    const fodder = FODDER_KINDS[kind as SpawnFodderKind]
    return { kind, role: fodder.role, armor, fodder }
  }
  return { kind, role: 'trash', armor }
}

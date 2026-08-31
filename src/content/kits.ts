import type { StarterId } from './weapons'

export type KitId = 'vanguard_kit'

/** 出门底数。零网格、零槽位、零祝福。 */
export type KitDef = {
  id: KitId
  name: string
  moveSpeed: number
  maxHp: number
  radius: number
  /** <1 = 热度掉得更慢 */
  heatDecayMul: number
  /** 受伤时额外掉热 */
  hurtHeatMul: number
  /** 1 = 基础伤害 100% */
  damageMul: number
  critChance: number
  xpMul: number
  /** Prep 可覆盖，不写回这张表 */
  defaultStarter: StarterId
}

export const KITS: Record<KitId, KitDef> = {
  vanguard_kit: {
    id: 'vanguard_kit',
    name: '先锋底',
    moveSpeed: 7.8,
    maxHp: 7,
    radius: 0.58,
    heatDecayMul: 1,
    hurtHeatMul: 1,
    damageMul: 1,
    critChance: 0,
    xpMul: 1,
    defaultStarter: 'flame',
  },
}

export const DEFAULT_KIT: KitId = 'vanguard_kit'

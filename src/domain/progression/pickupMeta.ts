import { DROP_RULES } from '../../content/rules'

export type PickupKind = 'gold' | 'xp' | 'relic_minor' | 'relic_major'

/**
 * Runtime 掉落挂的 meta：寿命 / 磁铁倍率走表，位置与 amount 仍是实例态。
 */
export type PickupMeta = {
  kind: PickupKind
  life: number
  /** 相对 loadout.magnetR 的半径倍率。 */
  magnetMul: number
  /** 吸入速度倍率。 */
  pullMul: number
  isRelic: boolean
}

export function makePickupMeta(kind: PickupKind): PickupMeta {
  const isRelic = kind === 'relic_minor' || kind === 'relic_major'
  return {
    kind,
    life: kind === 'xp' ? DROP_RULES.lifeXp : DROP_RULES.lifeOther,
    magnetMul: isRelic ? DROP_RULES.relicMagnetMul : 1,
    pullMul: isRelic ? 0.75 : 1,
    isRelic,
  }
}

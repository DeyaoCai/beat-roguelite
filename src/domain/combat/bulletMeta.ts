import { MAGICS, type MagicOrbDef } from '../../content/weapons'

export type BulletSource = 'orb' | 'foe' | 'boss'

/**
 * Runtime 子弹挂的 meta：来源关联；伤害/速度仍是实例态（可被 loadout/波次改）。
 */
export type BulletMeta = {
  source: BulletSource
  friendly: boolean
  /** 火球底表；仅 source=orb。 */
  orb?: MagicOrbDef
}

export function makeOrbBulletMeta(): BulletMeta {
  const orb = MAGICS.spirit_orb as MagicOrbDef
  return { source: 'orb', friendly: true, orb }
}

export function makeFoeBulletMeta(source: 'foe' | 'boss' = 'foe'): BulletMeta {
  return { source, friendly: false }
}

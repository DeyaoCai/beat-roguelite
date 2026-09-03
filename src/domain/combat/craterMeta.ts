import { MAGICS, type MagicOrbDef, type MagicStarDef } from '../../content/weapons'

export type CraterSource = 'star' | 'orb_blast'

/**
 * Runtime 落点/爆炸圈挂的 meta：来源关联；半径/寿命可被 loadout 改。
 */
export type CraterMeta = {
  source: CraterSource
  style: 'earth' | 'fire'
  star?: MagicStarDef
  orb?: MagicOrbDef
}

export function makeStarCraterMeta(): CraterMeta {
  return {
    source: 'star',
    style: 'earth',
    star: MAGICS.starfall as MagicStarDef,
  }
}

export function makeOrbBlastCraterMeta(): CraterMeta {
  return {
    source: 'orb_blast',
    style: 'fire',
    orb: MAGICS.spirit_orb as MagicOrbDef,
  }
}

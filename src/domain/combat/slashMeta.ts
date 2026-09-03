import { MARTIALS, type MartialDef } from '../../content/weapons'

/**
 * Runtime 挥砍/风息锥挂的 meta：武表指针；半径/伤害仍是实例态。
 */
export type SlashMeta = {
  source: 'flame'
  martial: MartialDef
}

export function makeFlameSlashMeta(): SlashMeta {
  return { source: 'flame', martial: MARTIALS.flame }
}

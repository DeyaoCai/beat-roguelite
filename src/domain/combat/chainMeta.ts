import { MAGICS, type MagicChainDef } from '../../content/weapons'

export type ChainSource = 'chain' | 'graft_bounce' | 'split'

/**
 * Runtime 雷链闪电挂的 meta：魔表指针；线段端点是实例态。
 */
export type ChainMeta = {
  source: ChainSource
  chain: MagicChainDef
}

export function makeChainBoltMeta(source: ChainSource = 'chain'): ChainMeta {
  return { source, chain: MAGICS.thunder_chain as MagicChainDef }
}

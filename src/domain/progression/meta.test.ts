import { describe, expect, it } from 'vitest'
import { contractBankMul, metaLoadoutMods, toggleContract } from './meta'

describe('contracts', () => {
  it('lets you check every contract', () => {
    let ids: Parameters<typeof toggleContract>[0] = []
    for (const id of ['horde', 'iron', 'mute', 'wild'] as const) {
      const r = toggleContract(ids, id)
      expect(r.ok).toBe(true)
      ids = r.next
    }
    expect(ids).toEqual(['horde', 'iron', 'mute', 'wild'])
  })

  it('allows unchecking', () => {
    const r = toggleContract(['horde', 'iron'], 'horde')
    expect(r.ok).toBe(true)
    expect(r.next).toEqual(['iron'])
  })

  it('adds bank extras instead of multiplying them', () => {
    expect(contractBankMul(['horde', 'iron'])).toBeCloseTo(1.5)
  })

  it('sets wildPick on the run mods', () => {
    const mods = metaLoadoutMods({ startHp: 0, startLuck: 0 }, null, ['wild'])
    expect(mods.wildPick).toBe(true)
    expect(mods.muteBeat).toBe(false)
  })
})

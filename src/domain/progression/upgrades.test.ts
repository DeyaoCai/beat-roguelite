import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../combat/math'
import { pickThree, rollStartStat } from './upgrades'
import { RHYTHM_IDS } from '../../content/rules'

describe('pickThree / rollStartStat', () => {
  it('always deals three cards', () => {
    const offer = pickThree(mulberry32(11), [], 'level', 'flame')
    expect(offer).toHaveLength(3)
  })

  it('keeps level-ups on the stat tier', () => {
    const offer = pickThree(mulberry32(22), [], 'level', 'flame')
    expect(offer.every((c) => c.tier === 'stat')).toBe(true)
  })

  it('filters rhythm cards when the still contract is on', () => {
    const offer = pickThree(mulberry32(33), [], 'drop_major', 'flame', {
      muteBeat: true,
    })
    const rhythm = new Set<string>(RHYTHM_IDS)
    expect(offer.some((c) => rhythm.has(c.id) || c.id === 'beat_bonus')).toBe(false)
  })

  it('rolls a grade-1 stat for wild start', () => {
    const owned = rollStartStat(mulberry32(44), [], 'flame')
    expect(owned).not.toBeNull()
    expect(owned!.grade).toBe(1)
    expect(owned!.meta.tier).toBe('stat')
  })
})

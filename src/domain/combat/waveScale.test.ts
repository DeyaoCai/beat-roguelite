import { describe, expect, it } from 'vitest'
import { bossHpMul, fodderHp } from './waveScale'

describe('waveScale', () => {
  it('gives wave-1 fodder enough HP for about three wind hits', () => {
    expect(fodderHp(1)).toBe(6)
  })

  it('softens early bosses against the table mul', () => {
    expect(bossHpMul(1, 20)).toBeCloseTo(14.4)
    expect(bossHpMul(5, 20)).toBe(20)
  })
})

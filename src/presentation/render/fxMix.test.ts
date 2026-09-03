import { describe, expect, it } from 'vitest'
import { graftAccentHex, graftSparkHex } from './fxMix'

const none = { thunder: false, split: false, slow: false, knock: false, volley: false }

describe('graftAccentHex', () => {
  it('keeps the starter color when nothing is fused', () => {
    expect(graftAccentHex(none, 0xfb923c)).toBe(0xfb923c)
  })

  it('tints fireballs electric when chain is grafted', () => {
    expect(graftAccentHex({ ...none, thunder: true }, 0xfb923c)).toBe(0x7dd3fc)
  })

  it('tints the ring gold when orb is grafted', () => {
    expect(graftAccentHex({ ...none, split: true }, 0x38bdf8)).toBe(0xfbbf24)
  })
})

describe('graftSparkHex', () => {
  it('cycles fused colors', () => {
    const mix = { ...none, split: true, slow: true }
    expect(graftSparkHex(mix, 0, 0x111111)).toBe(0xfbbf24)
    expect(graftSparkHex(mix, 2, 0x111111)).toBe(0x67e8f9)
  })
})

import { describe, expect, it } from 'vitest'
import { FADE_IN_SEC, FADE_OUT_SEC } from './types'
import { beginFadeToResult, beginFadeToWave, tickFade, type FadeBag } from './fade'

function bag(): FadeBag {
  return { fadeTx: null, fadeBlack: 0 }
}

describe('scene fade', () => {
  it('ignores a second begin while fading', () => {
    const s = bag()
    beginFadeToWave(s, 2)
    beginFadeToResult(s, true)
    expect(s.fadeTx?.action).toBe('wave')
    expect(s.fadeTx?.nextWave).toBe(2)
  })

  it('calls startWave after fade-out then clears on fade-in', () => {
    const s = bag()
    beginFadeToWave(s, 3)
    let wave = 0
    let result = 0
    tickFade(s, FADE_OUT_SEC, {
      startWave: (n) => {
        wave = n
      },
      goResult: () => {
        result += 1
      },
    })
    expect(wave).toBe(3)
    expect(result).toBe(0)
    expect(s.fadeTx?.phase).toBe('in')
    expect(s.fadeBlack).toBe(1)
    tickFade(s, FADE_IN_SEC, {
      startWave: () => {
        wave = 0
      },
      goResult: () => {
        result += 1
      },
    })
    expect(s.fadeTx).toBeNull()
    expect(s.fadeBlack).toBe(0)
    expect(wave).toBe(3)
    expect(result).toBe(0)
  })

  it('calls goResult for a result fade', () => {
    const s = bag()
    beginFadeToResult(s, true)
    let won: boolean | null = null
    tickFade(s, FADE_OUT_SEC, {
      startWave: () => {},
      goResult: (w) => {
        won = w
      },
    })
    expect(won).toBe(true)
  })
})

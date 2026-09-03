import { describe, expect, it } from 'vitest'
import { canReplaceHint } from './hints'

describe('canReplaceHint', () => {
  it('takes the first hint', () => {
    expect(canReplaceHint(null, 0, 'weather')).toBe(true)
  })

  it('lets a higher priority hint steal immediately', () => {
    expect(canReplaceHint('weather', 1.5, 'boss')).toBe(true)
  })

  it('holds a boss telegraph against weather', () => {
    expect(canReplaceHint('boss', 1.2, 'weather')).toBe(false)
  })

  it('lets a lower hint through when the current one is almost gone', () => {
    expect(canReplaceHint('boss', 0.2, 'weather')).toBe(true)
  })
})

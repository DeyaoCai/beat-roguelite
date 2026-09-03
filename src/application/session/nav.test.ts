import { describe, expect, it } from 'vitest'
import { navDir, pickIndexFromInput } from './nav'

describe('navDir', () => {
  it('maps WASD and arrows', () => {
    expect(navDir('w')).toEqual({ row: -1, col: 0 })
    expect(navDir('ArrowDown')).toEqual({ row: 1, col: 0 })
    expect(navDir('a')).toEqual({ row: 0, col: -1 })
    expect(navDir('ArrowRight')).toEqual({ row: 0, col: 1 })
    expect(navDir('Enter')).toEqual({ row: 0, col: 0 })
  })
})

describe('pickIndexFromInput', () => {
  it('accepts digit, Digit, and Numpad codes', () => {
    expect(pickIndexFromInput('1', 'Digit1')).toBe(0)
    expect(pickIndexFromInput('', 'Numpad3')).toBe(2)
    expect(pickIndexFromInput('6', null)).toBe(5)
    expect(pickIndexFromInput('7', 'Digit7')).toBe(-1)
  })
})

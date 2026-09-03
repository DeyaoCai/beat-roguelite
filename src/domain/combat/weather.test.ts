import { describe, expect, it } from 'vitest'
import { mulberry32 } from './math'
import { rollWeatherCycle, weatherSlotAt, weatherSlotCount } from './weather'
import { WEATHER_CYCLE } from '../../content/rules'

describe('weather cycle', () => {
  it('slots a 4-minute song into the 3–6 band', () => {
    const n = weatherSlotCount(240)
    expect(n).toBeGreaterThanOrEqual(WEATHER_CYCLE.minSlots)
    expect(n).toBeLessThanOrEqual(WEATHER_CYCLE.maxSlots)
  })

  it('pins the last slot at song end', () => {
    expect(weatherSlotAt(0, 200, 4)).toBe(0)
    expect(weatherSlotAt(200, 200, 4)).toBe(3)
  })

  it('rolls unique weathers for a wave', () => {
    const cycle = rollWeatherCycle(7, 1, 240)
    expect(cycle.length).toBe(weatherSlotCount(240))
    expect(new Set(cycle).size).toBe(cycle.length)
  })

  it('is deterministic for the same seed', () => {
    expect(rollWeatherCycle(99, 2, 240)).toEqual(rollWeatherCycle(99, 2, 240))
    expect(mulberry32(1)()).not.toBe(mulberry32(2)())
  })
})

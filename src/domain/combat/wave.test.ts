import { describe, expect, it } from 'vitest'
import type { AudioClockPort } from '../shared/ports'
import { spawnPickup } from '../progression/drops'
import { createWorld } from './world'
import { progressionBusy, tickWaveClear } from './wave'

const clock: AudioClockPort = { songTime: 0, duration: 180, beep() {} }

describe('tickWaveClear', () => {
  it('vacuums ground relics at wave end so the wave can progress', () => {
    const w = createWorld({ wave: 1, upgrades: [], waveDuration: 180 })
    w.waveTime = w.waveDuration
    w.lootGraceT = 0
    spawnPickup(w, 8, 8, 'relic_minor')
    expect(progressionBusy(w)).toBe(true)

    tickWaveClear(w, 0, clock)

    expect(w.pickups.some((p) => p.kind === 'relic_minor' || p.kind === 'relic_major')).toBe(false)
    expect(w.offer?.length).toBeGreaterThan(0)
  })

  it('marks wave cleared once timers, enemies, and picks are done', () => {
    const w = createWorld({ wave: 1, upgrades: [], waveDuration: 180 })
    w.waveTime = w.waveDuration
    w.lootGraceT = 0

    tickWaveClear(w, 0, clock)

    expect(w.cleared).toBe(true)
    expect(w.offer?.length).toBeGreaterThan(0)
  })
})

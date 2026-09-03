import { describe, expect, it } from 'vitest'
import type { AudioClockPort } from '../shared/ports'
import { createWorld } from './world'
import {
  fireChain,
  firePlayerPattern,
  fireStarCast,
  pulseAura,
  pulseFlame,
  runMagicWave,
  tickAura,
  tickChain,
  tickFlame,
  tickStar,
} from './combat'
import { tickPlayerWeapons } from './player'
import { makeEnemyMeta } from './enemyMeta'
import { idleCombat } from './elemental'
import type { Enemy, World } from './types'

const clock: AudioClockPort = { songTime: 0, duration: 180, beep() {} }

function dummyEnemy(w: World, x: number, z: number, hp = 400): Enemy {
  const meta = makeEnemyMeta('chaser')
  return {
    x,
    z,
    hp,
    maxHp: hp,
    r: 0.4,
    speed: 0,
    shootCd: 99,
    kind: 'chaser',
    meta,
    ...idleCombat('chaser', 1, meta.armor),
    aiCd: 99,
    aiPhase: 0,
    windupT: 0,
    windupMax: 0,
    windupKind: null,
    dashT: 0,
    dashVx: 0,
    dashVz: 0,
    spin: 0,
  }
}

describe('graft trait visuals', () => {
  it('aims extra orb volleys at a second target', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'spirit_orb' })
    w.loadout.casts = 2
    w.enemies.push(dummyEnemy(w, 0, -2), dummyEnemy(w, 3, 0))
    firePlayerPattern(w, 0, -1, 1, 0, 10)
    expect(w.bullets).toHaveLength(2)
    const a = Math.atan2(w.bullets[0]!.vz, w.bullets[0]!.vx)
    const b = Math.atan2(w.bullets[1]!.vz, w.bullets[1]!.vx)
    expect(Math.abs(a - b)).toBeGreaterThan(0.2)
  })

  it('keeps extra orb volleys on the same foe instead of missing', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'spirit_orb' })
    w.loadout.casts = 2
    w.enemies.push(dummyEnemy(w, 0, -2))
    firePlayerPattern(w, 0, -1, 1, 0, 10)
    expect(w.bullets).toHaveLength(2)
    const u0 = Math.hypot(w.bullets[0]!.vx, w.bullets[0]!.vz) || 1
    const u1 = Math.hypot(w.bullets[1]!.vx, w.bullets[1]!.vz) || 1
    const dot =
      (w.bullets[0]!.vx / u0) * (w.bullets[1]!.vx / u1) +
      (w.bullets[0]!.vz / u0) * (w.bullets[1]!.vz / u1)
    expect(dot).toBeGreaterThan(0.98)
    expect(
      Math.hypot(w.bullets[0]!.x - w.bullets[1]!.x, w.bullets[0]!.z - w.bullets[1]!.z),
    ).toBeGreaterThan(0.2)
  })

  it('draws a split bolt even without bounce', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'spirit_orb' })
    const seed = dummyEnemy(w, 0, -2)
    const fork = dummyEnemy(w, 1.2, -2.1)
    w.enemies.push(seed, fork)
    runMagicWave(w, clock, [seed], { dmg: 8, originX: seed.x, originZ: seed.z })
    const splits = w.chains.filter((c) => c.meta.source === 'split')
    expect(splits.length).toBeGreaterThan(0)
    expect(w.fxPops.some((p) => p.kind === 'split')).toBe(true)
  })

  it('sends extra chain volleys to a different first target', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'thunder_chain' })
    w.loadout.casts = 2
    const a = dummyEnemy(w, 0, -2)
    const b = dummyEnemy(w, 2.4, -0.4)
    w.enemies.push(a, b)
    fireChain(w, clock, 0, 1)
    const firstHops = w.chains.filter((c) => c.hop === 0)
    expect(firstHops.length).toBe(2)
    const keys = new Set(firstHops.map((c) => `${c.bx.toFixed(1)},${c.bz.toFixed(1)}`))
    expect(keys.size).toBe(2)
    expect(w.fxPops.some((p) => p.kind === 'volley')).toBe(true)
  })
})

describe('skills do not empty-fire', () => {
  it('does not shoot an orb with nobody to hit', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'spirit_orb' })
    w.player.fireCd = 0
    tickPlayerWeapons(w, 0.016, clock)
    expect(w.bullets).toHaveLength(0)
    expect(w.player.fireCd).toBeLessThanOrEqual(0)
  })

  it('does not spray flame with nobody in range', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'flame' })
    w.player.meleeCd = 0
    tickFlame(w, 0.016, clock)
    expect(w.slashes).toHaveLength(0)
    expect(w.player.meleeCd).toBeLessThanOrEqual(0)
    pulseFlame(w, clock, 1)
    expect(w.slashes).toHaveLength(0)
  })

  it('does not pulse aura with nobody in the ring', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'ward_aura' })
    w.player.auraCd = 0
    tickAura(w, 0.016, clock)
    expect(w.auraPulseT).toBe(0)
    expect(w.player.auraCd).toBeLessThanOrEqual(0)
    pulseAura(w, clock, 1, 1)
    expect(w.auraPulseT).toBe(0)
  })

  it('does not chain when foes are out of range', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'thunder_chain' })
    w.enemies.push(dummyEnemy(w, 20, 20))
    w.player.chainCd = 0
    tickChain(w, 0.016, clock)
    expect(w.chains).toHaveLength(0)
    expect(w.player.chainCd).toBeLessThanOrEqual(0)
  })

  it('does not drop star when foes are out of range', () => {
    const w = createWorld({ wave: 1, upgrades: [], starterId: 'starfall' })
    w.enemies.push(dummyEnemy(w, 20, 20))
    w.player.starCd = 0
    tickStar(w, 0.016, clock)
    expect(w.craters).toHaveLength(0)
    expect(w.player.starCd).toBeLessThanOrEqual(0)
    fireStarCast(w, clock, 1)
    expect(w.craters).toHaveLength(0)
  })
})

import type { AudioClockPort } from '../shared/ports'
import { pushEvent } from '../shared/events'
import type { Enemy, GroundPickup, World } from '../combat/types'
import { greedGoldMul } from './relics'
import { xpForKill, xpToNextFor } from './xp'
import { pickThree, type PickMode } from './upgrades'

/** Walk-over radius beyond the player collider. */
export const PICKUP_REACH = 1.45
/** Gold / XP magnet pull speed (units/sec toward player). */
export const MAGNET_PULL = 11
/** Relics use a shorter magnet than gold. */
export const RELIC_MAGNET_MUL = 0.55

/** Add XP and queue level-ups (does not open UI). */
export function grantXp(w: World, amount: number): void {
  if (amount <= 0) return
  const scaled = Math.max(0, Math.floor(amount * (w.loadout.xpMul || 1)))
  if (scaled <= 0) return
  w.stats.xp += scaled
  let gained = 0
  while (w.stats.xp >= w.stats.xpToNext) {
    w.stats.xp -= w.stats.xpToNext
    w.stats.level += 1
    w.stats.pendingLevelUps += 1
    w.stats.xpToNext = xpToNextFor(w.stats.level)
    gained += 1
  }
  if (gained > 0) {
    w.stats.levelFlashT = 1.1
    pushEvent(w.domainEvents, {
      type: 'LevelUpPending',
      level: w.stats.level,
      pendingCount: w.stats.pendingLevelUps,
    })
  }
}

export function grantGold(w: World, amount: number): void {
  if (amount <= 0) return
  const scaled = Math.max(1, Math.floor(amount * greedGoldMul(w.upgrades)))
  w.stats.gold += scaled
  w.stats.score += scaled * 2
}

export function spawnPickup(
  w: World,
  x: number,
  z: number,
  kind: GroundPickup['kind'],
  amount = 0,
): void {
  w.pickups.push({
    id: w.nextPickupId++,
    x,
    z,
    kind,
    amount,
    life: kind === 'xp' ? 42 : 28,
  })
}

function xpAmountForKill(w: World, e: Enemy): number {
  const xpMul = e.kind === 'boss' ? 5 : e.kind === 'elite' ? 2.5 : 1
  return Math.max(1, Math.floor(xpForKill(w.stats.mult, w.stats.wave) * xpMul))
}

function spawnXpOrb(w: World, e: Enemy): void {
  const jx = (w.rng() - 0.5) * 0.35
  const jz = (w.rng() - 0.5) * 0.35
  spawnPickup(w, e.x + jx, e.z + jz, 'xp', xpAmountForKill(w, e))
}

function collectOne(w: World, p: GroundPickup, clock?: AudioClockPort): void {
  if (p.kind === 'xp') {
    grantXp(w, Math.max(1, p.amount))
    p.life = 0
    clock?.beep('pickup_gold')
    return
  }
  if (p.kind === 'gold') {
    grantGold(w, Math.max(1, p.amount))
    p.life = 0
    clock?.beep('pickup_gold')
    return
  }
  if (p.kind === 'relic_minor') {
    enqueueOrOpenRelic(w, 'drop_minor', clock)
    p.life = 0
  } else if (p.kind === 'relic_major') {
    enqueueOrOpenRelic(w, 'drop_major', clock)
    p.life = 0
  }
}

/** 全场吸入：先经验（可叠升级）、再金、最后遗物开三选。 */
export function vacuumPickups(w: World, clock?: AudioClockPort): void {
  const order: GroundPickup['kind'][] = ['xp', 'gold', 'relic_minor', 'relic_major']
  for (const kind of order) {
    for (const p of w.pickups) {
      if (p.life <= 0 || p.kind !== kind) continue
      collectOne(w, p, clock)
    }
  }
  w.pickups = w.pickups.filter((p) => p.life > 0)
}

/** Gold / XP / relic drops after a kill (Progression BC). */
export function applyEnemyDefeatedRewards(w: World, e: Enemy): void {
  pushEvent(w.domainEvents, {
    type: 'EnemyDefeated',
    kind: e.kind,
    x: e.x,
    z: e.z,
    wave: w.stats.wave,
  })

  if (e.kind === 'chest') {
    spawnPickup(w, e.x, e.z, 'gold', 3 + w.stats.wave)
    if (w.offer) {
      w.offerQueue.push({ mode: 'chest', reason: 'chest' })
    } else {
      openOffer(w, 'chest', 'chest')
    }
    w.lootGraceT = Math.max(w.lootGraceT, 2.5)
    return
  }

  spawnXpOrb(w, e)

  if (e.kind === 'boss') {
    spawnPickup(w, e.x, e.z, 'gold', 28 + w.stats.wave * 6)
    spawnPickup(w, e.x + 0.6, e.z - 0.3, 'relic_major')
    w.lootGraceT = Math.max(w.lootGraceT, 8)
    const relic = w.pickups[w.pickups.length - 1]
    if (relic) relic.life = Math.max(relic.life, 16)
    // 清场保留未开宝箱
    w.enemies = w.enemies.filter((x) => x.kind === 'chest' && x.hp > 0)
    w.bullets = w.bullets.filter((b) => b.friendly)
    // 杀完 Boss：全场经验 / 金 / 遗物收一次
    vacuumPickups(w)
    return
  }
  if (e.kind === 'elite') {
    spawnPickup(w, e.x - 0.45, e.z, 'gold', 10 + w.stats.wave * 2)
    spawnPickup(w, e.x + 0.45, e.z, 'relic_minor')
    w.lootGraceT = Math.max(w.lootGraceT, 5)
    return
  }
  const goldAmt = 1 + (w.rng() < 0.35 ? 1 : 0) + (e.kind === 'brute' ? 1 : 0)
  spawnPickup(w, e.x, e.z, 'gold', goldAmt)
}

export function openOffer(
  w: World,
  mode: PickMode,
  reason: World['pickReason'],
  opts?: { replace?: boolean },
): void {
  if (!reason) return
  if (w.offer && !opts?.replace) return
  w.offer = pickThree(w.rng, w.upgrades, mode, w.loadout.starterId, {
    preferRhythm: w.runMode === 'endless',
    level: w.stats.level,
  })
  w.pickReason = reason
}

/** After closing a pick: relic queue first, then leftover level-ups. */
export function drainOfferQueue(w: World): boolean {
  if (w.offer) return false
  const next = w.offerQueue.shift()
  if (next) {
    openOffer(w, next.mode, next.reason)
    return true
  }
  if (w.stats.pendingLevelUps > 0) {
    openOffer(w, 'level', 'level')
    return true
  }
  return false
}

function enqueueOrOpenRelic(
  w: World,
  mode: 'drop_minor' | 'drop_major',
  clock?: AudioClockPort,
): void {
  if (w.offer) {
    w.offerQueue.push({ mode, reason: mode })
  } else {
    openOffer(w, mode, mode)
  }
  clock?.beep('pickup_relic')
  clock?.beep('offer')
}

/** Magnet pull + walk-over gold / XP / relics. */
export function tickPickups(w: World, dt: number, clock?: AudioClockPort): void {
  const magnetR = w.loadout.magnetR
  const pr = w.player.r + PICKUP_REACH
  for (const p of w.pickups) {
    p.life -= dt
    const dx = w.player.x - p.x
    const dz = w.player.z - p.z
    const dist = Math.hypot(dx, dz)
    const reach =
      p.kind === 'gold' || p.kind === 'xp' ? magnetR : magnetR * RELIC_MAGNET_MUL
    if (dist > 0.05 && dist < reach) {
      const pull =
        MAGNET_PULL * (p.kind === 'gold' || p.kind === 'xp' ? 1 : 0.75) * dt
      const step = Math.min(pull, dist)
      p.x += (dx / dist) * step
      p.z += (dz / dist) * step
    }
    const d2 = Math.hypot(p.x - w.player.x, p.z - w.player.z)
    if (d2 > pr) continue
    collectOne(w, p, clock)
  }
  w.pickups = w.pickups.filter((p) => p.life > 0)
}

export { xpForKill, xpToNextFor, xpForHit } from './xp'

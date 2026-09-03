import { DROP_RULES, XP_CURVE } from '../../content/rules'
import type { AudioClockPort } from '../shared/ports'
import { pushEvent } from '../shared/events'
import type { Enemy, GroundPickup, World } from '../combat/types'
import { greedGoldMul } from './relics'
import { xpForKill, xpToNextFor } from './xp'
import { pickThree, type PickMode } from './upgrades'
import { makePickupMeta } from './pickupMeta'

const D = DROP_RULES

/** Walk-over radius beyond the player collider. */
export const PICKUP_REACH = D.pickupReach
/** Gold / XP magnet pull speed (units/sec toward player). */
export const MAGNET_PULL = D.magnetPull
/** Relics use a shorter magnet than gold. */
export const RELIC_MAGNET_MUL = D.relicMagnetMul

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
  const meta = makePickupMeta(kind)
  w.pickups.push({
    id: w.nextPickupId++,
    x,
    z,
    kind,
    meta,
    amount,
    life: meta.life,
  })
}

function xpAmountForKill(w: World, e: Enemy): number {
  const xpMul =
    e.kind === 'boss'
      ? XP_CURVE.bossXpMul
      : e.kind === 'elite'
        ? XP_CURVE.eliteXpMul
        : 1
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
    spawnPickup(w, e.x, e.z, 'gold', D.chestGoldBase + w.stats.wave * D.chestGoldPerWave)
    if (w.offer) {
      w.offerQueue.push({ mode: 'chest', reason: 'chest' })
    } else {
      openOffer(w, 'chest', 'chest')
    }
    w.lootGraceT = Math.max(w.lootGraceT, D.chestLootGrace)
    return
  }

  spawnXpOrb(w, e)

  if (e.kind === 'boss') {
    spawnPickup(w, e.x, e.z, 'gold', D.bossGoldBase + w.stats.wave * D.bossGoldPerWave)
    spawnPickup(w, e.x + 0.6, e.z - 0.3, 'relic_major')
    w.lootGraceT = Math.max(w.lootGraceT, D.bossLootGrace)
    const relic = w.pickups[w.pickups.length - 1]
    if (relic) relic.life = Math.max(relic.life, D.relicLifePad)
    // 清场保留未开宝箱
    w.enemies = w.enemies.filter((x) => x.kind === 'chest' && x.hp > 0)
    w.bullets = w.bullets.filter((b) => b.friendly)
    // 杀完 Boss：全场经验 / 金 / 遗物收一次
    vacuumPickups(w)
    return
  }
  if (e.kind === 'elite') {
    spawnPickup(w, e.x - 0.45, e.z, 'gold', D.eliteGoldBase + w.stats.wave * D.eliteGoldPerWave)
    if (w.offer) {
      w.offerQueue.push({ mode: 'drop_minor', reason: 'drop_minor' })
    } else {
      openOffer(w, 'drop_minor', 'drop_minor')
    }
    w.lootGraceT = Math.max(w.lootGraceT, D.eliteLootGrace)
    return
  }
  const goldAmt =
    D.trashGoldBase +
    (w.rng() < D.trashGoldBonusChance ? 1 : 0) +
    (e.kind === 'brute' ? D.trashBruteBonus : 0)
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
    muteBeat: w.loadout.muteBeat,
    autoPickup: w.loadout.autoPickup,
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
  const auto = w.loadout.autoPickup
  const magnetR = auto ? Math.max(w.arena.half * 3, w.loadout.magnetR) : w.loadout.magnetR
  const pr = w.player.r + PICKUP_REACH
  const pullMul = auto ? D.autoPullMul : 1
  for (const p of w.pickups) {
    p.life -= dt
    const dx = w.player.x - p.x
    const dz = w.player.z - p.z
    const dist = Math.hypot(dx, dz)
    const reach = auto ? magnetR : magnetR * p.meta.magnetMul
    if (dist > 0.05 && dist < reach) {
      const pull = MAGNET_PULL * (auto ? 1 : p.meta.pullMul) * pullMul * dt
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

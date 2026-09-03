import type { AudioClockPort } from '../shared/ports'
import { ARENA_RULES } from '../../content/rules'
import { applyEnemyDefeatedRewards, openOffer } from '../progression'
import { isLastStandardWave } from './arena'
import type { World } from './types'

/** Seconds to pick boss/elite relics before the wave can end. */
export const LOOT_GRACE_SEC = ARENA_RULES.lootGraceSec

function relicsOnGround(w: World): boolean {
  return w.pickups.some((p) => p.kind === 'relic_minor' || p.kind === 'relic_major')
}

/** Level-ups, open pick UI, or queued relic opens still pending. */
export function progressionBusy(w: World): boolean {
  return (
    w.stats.pendingLevelUps > 0 ||
    !!w.offer ||
    w.offerQueue.length > 0 ||
    relicsOnGround(w)
  )
}

export function tickWaveClear(w: World, dt: number, clock: AudioClockPort): void {
  if (w.lootGraceT > 0) {
    w.lootGraceT = Math.max(0, w.lootGraceT - dt)
  }

  if (w.waveTime >= w.waveDuration && !w.cleared && !w.dead) {
    // 曲终未开宝箱：自动击碎并入队三选
    let broke = false
    for (const e of w.enemies) {
      if (e.kind !== 'chest' || e.hp <= 0) continue
      e.hp = 0
      applyEnemyDefeatedRewards(w, e)
      broke = true
    }
    if (broke) {
      w.enemies = w.enemies.filter((e) => e.hp > 0)
      clock.beep('pickup_relic')
    }
  }

  if (
    w.waveTime >= w.waveDuration &&
    !w.enemies.some((e) => e.kind !== 'chest' && e.hp > 0) &&
    w.lootGraceT <= 0 &&
    !progressionBusy(w) &&
    !w.cleared &&
    !w.dead
  ) {
    w.cleared = true
    clock.beep('wave_clear')
    if (isLastStandardWave(w.runMode, w.stats.wave)) {
      w.offer = null
      w.pickReason = null
      w.offerQueue.length = 0
    } else {
      openOffer(w, 'wave', 'wave')
      clock.beep('offer')
    }
  }
}

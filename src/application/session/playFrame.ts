import {
  applyBeatResult,
  applyUpgradeToWorld,
  isFeverActive,
  isLastStandardWave,
  STANDARD_WAVES,
  tickWorld,
  type World,
} from '../../domain/combat'
import { drainOfferQueue } from '../../domain/progression'
import {
  chartTime,
  hitLane,
  tickFeverAutoHits,
  tickRhythmFlash,
  tickRhythmLoop,
  tickRhythmMisses,
} from '../../domain/rhythm'
import { drainEvents } from '../../domain/shared/events'
import { beginFadeToResult, beginFadeToWave } from './fade'
import { pickIndexFromInput } from './nav'
import type { SessionIO, SessionState } from './types'

function applySideChoice(s: SessionState, w: World, idx: number, io: SessionIO): void {
  if (!w.offer || idx < 0 || idx >= w.offer.length) return
  const reason = w.pickReason
  const picked = w.offer[idx]!
  const fromLevel = reason === 'level'
  applyUpgradeToWorld(w, picked, { consumeLevel: fromLevel })
  s.upgrades = [...w.upgrades]
  w.offer = null
  w.pickReason = null
  w.player.invuln = Math.max(w.player.invuln, 0.45)
  w.stats.levelFlashT = Math.max(w.stats.levelFlashT, 0.55)
  io.clock.beep('upgrade')
  drainOfferQueue(w)
}

function commitWaveOffer(s: SessionState, w: World, idx: number, io: SessionIO): void {
  if (!w.offer || idx < 0 || idx >= w.offer.length || w.pickReason !== 'wave') return
  const picked = w.offer[idx]!
  applyUpgradeToWorld(w, picked, {
    consumeLevel: false,
    announce: w.loadout.wildPick ? 'wild' : 'auto',
  })
  s.upgrades = [...w.upgrades]
  w.offer = null
  w.pickReason = null
  io.clock.beep('upgrade')
  const next = w.stats.wave + 1
  if (w.runMode === 'standard' && next > STANDARD_WAVES) beginFadeToResult(s, true)
  else beginFadeToWave(s, next)
}

function tryWildWavePick(s: SessionState, io: SessionIO): void {
  const w = s.world
  if (!w?.loadout.wildPick || w.pickReason !== 'wave' || !w.offer?.length) return
  commitWaveOffer(s, w, Math.floor(w.rng() * w.offer.length), io)
}

export function handlePlayOfferKey(
  s: SessionState,
  k: string,
  code: string | null,
  io: SessionIO,
): void {
  const w = s.world
  if (!w?.offer || w.loadout.wildPick) return
  const idx = pickIndexFromInput(k, code)
  if (idx < 0 || idx >= w.offer.length) return
  if (w.pickReason === 'wave') commitWaveOffer(s, w, idx, io)
  else applySideChoice(s, w, idx, io)
}

export function tickPlayFrame(s: SessionState, dt: number, io: SessionIO): void {
  if (s.scene !== 'play' || !s.world || s.paused) return
  const world = s.world
  tickWorld(world, dt, io.keys, io.clock)
  s.upgrades = [...world.upgrades]
  for (const ev of drainEvents(world.domainEvents)) {
    if (ev.type === 'LevelUpPending') io.clock.beep('level_up')
  }

  if (s.rhythm && !world.cleared && !world.loadout.muteBeat) {
    const period = io.clock.duration
    tickRhythmLoop(s.rhythm, io.clock.songTime, period)
    const t = chartTime(io.clock.songTime, period)
    const feverOn = isFeverActive(world)
    const judgeWin = {
      perfect: world.loadout.judgePerfectWin,
      good: world.loadout.judgeGoodWin,
    }
    if (feverOn) {
      for (const hit of tickFeverAutoHits(s.rhythm, t, judgeWin)) {
        applyBeatResult(world, io.clock, hit.result, hit.errorSec)
      }
    } else if (io.keys.lanePressed[0]) {
      const hit = hitLane(s.rhythm, 0, t, judgeWin)
      if (hit) applyBeatResult(world, io.clock, hit.result, hit.errorSec)
    }
    if (!feverOn) {
      const missEvents = tickRhythmMisses(s.rhythm, t, judgeWin)
      if (missEvents.length > 0) {
        applyBeatResult(world, io.clock, 'miss')
      }
    }
    if (feverOn && io.keys.lanePressed[0]) {
      const hit = hitLane(s.rhythm, 0, t, judgeWin)
      if (hit) applyBeatResult(world, io.clock, hit.result, hit.errorSec)
    }
    tickRhythmFlash(s.rhythm, dt)
    if (s.rhythm.flashT > 0) {
      world.stats.beatFlash = s.rhythm.lastFlash
      world.stats.beatFlashT = s.rhythm.flashT
    }
  }

  if (world.dead) {
    s.runScore += world.stats.score
    s.runKills += world.stats.kills
    io.goResult(false)
  } else if (
    !world.cleared &&
    !world.offer &&
    (world.stats.pendingLevelUps > 0 || world.offerQueue.length > 0)
  ) {
    if (drainOfferQueue(world)) io.clock.beep('offer')
  } else if (world.cleared) {
    if (!s.clearSettled) {
      s.clearSettled = true
      s.runScore += world.stats.score
      s.runKills += world.stats.kills
      world.stats.score = 0
      world.stats.kills = 0
      s.paused = false
      io.setTuneOpen(false)
      if (isLastStandardWave(world.runMode, world.stats.wave)) {
        beginFadeToResult(s, true)
      }
    }
  }
  if (!world.dead) tryWildWavePick(s, io)
}

import type { AudioClockPort } from '../shared/ports'
import type { JudgeResult } from '../rhythm/judge'
import { addHeat, heatToMult } from './heat'
import { norm } from './math'
import {
  damageEnemy,
  fireChain,
  firePlayerPattern,
  fireStarCast,
  nearestEnemy,
  pulseAura,
  pulseFlame,
  pulseOrbit,
} from './combat'
import type { World } from './types'
import { pushEvent } from '../shared/events'

/** Sustained auto-perfect window after the bar fills. */
export const FEVER_ACTIVE_SEC = 7
/** Hard lock on refill after the window ends. */
export const FEVER_COOLDOWN_SEC = 12
const COMBO_MILESTONES = [10, 25, 50, 100] as const

export function isFeverActive(w: World): boolean {
  return w.stats.feverActiveT > 0
}

/** Heat 即 Fever 槽。满条才能按 F。 */
export function heatReady(w: World): boolean {
  if (isFeverActive(w) || w.stats.feverCooldownT > 0) return false
  const max = w.loadout.heatCfg.max
  return max > 0 && w.stats.heat >= max * 0.98
}

export function comboDamageMul(combo: number, cap = 50): number {
  return 1 + Math.min(combo, cap) * 0.01
}

function noteComboMilestone(w: World, prev: number, next: number, clock: AudioClockPort): void {
  for (const m of COMBO_MILESTONES) {
    if (prev < m && next >= m) {
      w.stats.comboMilestone = m
      w.stats.comboMilestoneT = 0.9
      clock.beep('combo')
    }
  }
}

export function applyBeatResult(
  w: World,
  clock: AudioClockPort,
  result: JudgeResult,
  errorSec = 0,
): void {
  if (w.loadout.muteBeat) return
  const feverOn = isFeverActive(w)
  // Fever window: every note is Perfect (auto or pressed).
  if (feverOn && result !== 'perfect') {
    result = 'perfect'
    errorSec = 0
  }

  w.stats.beatFlash = result
  w.stats.beatFlashT = 0.35
  // Fever auto-hits every note — skip per-note beeps (enter/crash have their own).
  if (!feverOn) clock.beep(result)
  const L = w.loadout
  const cfg = L.heatCfg

  if (result === 'miss') {
    const prev = w.stats.combo
    w.stats.heat = addHeat(w.stats.heat, -cfg.missLoss, cfg)
    w.stats.combo = Math.floor(w.stats.combo * (L.comboBreakKeep || 0.5))
    if (prev > 0) {
      w.stats.comboBreakT = 0.5
      w.stats.comboFlashT = 0.18
    }
    w.stats.timingHint = null
    w.stats.timingHintT = 0
    pushEvent(w.domainEvents, {
      type: 'NoteJudged',
      result: 'miss',
      errorSec,
      combo: w.stats.combo,
    })
    return
  }

  const prevCombo = w.stats.combo
  w.stats.combo += 1
  w.stats.comboFlashT = 0.22
  if (w.stats.combo > w.stats.maxCombo) w.stats.maxCombo = w.stats.combo
  noteComboMilestone(w, prevCombo, w.stats.combo, clock)
  if (!feverOn && Math.abs(errorSec) >= 0.04) {
    w.stats.timingHint = errorSec > 0 ? 'late' : 'early'
    w.stats.timingHintT = 0.55
  } else {
    w.stats.timingHint = null
    w.stats.timingHintT = 0
  }

  pushEvent(w.domainEvents, {
    type: 'NoteJudged',
    result,
    errorSec,
    combo: w.stats.combo,
  })

  if (!feverOn) {
    const gain =
      (result === 'perfect' ? cfg.perfectGain : cfg.goodGain) * (L.feverGainMul || 1)
    w.stats.heat = addHeat(w.stats.heat, gain, cfg)
  }
  w.stats.score += result === 'perfect' ? 50 : 20

  const mult = heatToMult(w.stats.heat, cfg.max)
  const comboMul = comboDamageMul(w.stats.combo, L.comboDmgCap || 50)
  const target = nearestEnemy(w)
  let dx = 0
  let dz = -1
  if (target) {
    const d = norm(target.x - w.player.x, target.z - w.player.z)
    dx = d.x
    dz = d.z
  }
  const bonus = L.beatBonus
  const comboScale = comboMul * (1 + bonus * 0.12)
  const starter = L.starterId
  if (result !== 'perfect') {
    w.player.invuln = Math.max(w.player.invuln, feverOn ? 0.18 : 0.1)
    return
  }

  if (starter === 'flame' && L.hasFlame) {
    pulseFlame(w, clock, comboScale * L.beatMeleeMul)
  } else if (starter === 'spirit_orb' && L.orb) {
    firePlayerPattern(
      w,
      dx,
      dz,
      1,
      0,
      L.orb.damage * mult * comboScale * L.orb.beatMul,
      undefined,
      clock,
    )
  } else if (starter === 'ward_aura' && L.aura) {
    pulseAura(w, clock, 1, comboScale * L.aura.beatMul)
  } else if (starter === 'thunder_chain' && L.chain) {
    fireChain(w, clock, 0, comboScale * L.chain.beatMul)
  } else if (starter === 'starfall' && L.star) {
    fireStarCast(w, clock, comboScale * L.star.beatMul)
  } else if (starter === 'orbit' && L.orbit) {
    pulseOrbit(w, clock, comboScale)
  }
  w.player.invuln = Math.max(w.player.invuln, feverOn ? 0.18 : 0.1)
}

/** 槽满后按 Fever 键才放。满了不自动炸。契约「哑火」锁键。 */
export function tryManualFever(w: World, clock: AudioClockPort, pressed: boolean): void {
  if (!pressed || w.dead) return
  if (w.loadout.muteFever) {
    if (heatReady(w)) clock.beep('ui_back')
    return
  }
  if (isFeverActive(w) || w.stats.feverCooldownT > 0) return
  if (!heatReady(w)) return
  enterFever(w, clock)
}

/** Open Fever window: burst once, then auto-perfect for feverActiveSec. */
export function enterFever(w: World, clock: AudioClockPort): void {
  const dur = w.loadout.feverActiveSec || FEVER_ACTIVE_SEC
  w.stats.feverActiveT = dur
  w.stats.feverActiveMax = dur
  w.stats.feverFlashT = 0.85
  w.stats.heat = w.loadout.heatCfg.max
  pushEvent(w.domainEvents, { type: 'FeverBurst' })
  w.stats.score += 200
  w.player.invuln = Math.max(w.player.invuln, 0.85)
  w.bullets = w.bullets.filter((b) => b.friendly)
  const dmg = 7 * w.stats.mult * comboDamageMul(w.stats.combo, w.loadout.comboDmgCap || 50)
  for (const e of w.enemies) {
    if (e.hp > 0) damageEnemy(w, e, dmg, clock, 0.04, 'fever')
  }
  clock.beep('fever')
}

/** Strong comedown when the Fever window ends. */
export function endFeverCrash(w: World, clock: AudioClockPort): void {
  w.stats.feverActiveT = 0
  w.stats.feverActiveMax = 0
  w.stats.feverCooldownT = FEVER_COOLDOWN_SEC
  w.stats.feverFlashT = 0.55
  w.stats.heat = 0
  const hadCombo = w.stats.combo
  w.stats.combo = 0
  if (hadCombo > 0) {
    w.stats.comboBreakT = 0.55
    w.stats.comboFlashT = 0.2
  }
  w.stats.comboMilestone = null
  w.stats.comboMilestoneT = 0
  w.stats.timingHint = null
  w.stats.timingHintT = 0
  w.player.hurtFlash = Math.max(w.player.hurtFlash, 0.35)
  clock.beep('miss')
  clock.beep('hurt')
}

/** Drain active / cooldown timers; crash when the window ends. */
export function tickFever(w: World, dt: number, clock: AudioClockPort): void {
  if (w.stats.feverActiveT > 0) {
    w.stats.feverActiveT = Math.max(0, w.stats.feverActiveT - dt)
    w.stats.feverFlashT = Math.max(w.stats.feverFlashT, 0.2)
    // Mirror remaining window onto the bar for HUD.
    const max = w.stats.feverActiveMax || FEVER_ACTIVE_SEC
    w.stats.heat = (w.stats.feverActiveT / max) * w.loadout.heatCfg.max
    w.stats.mult = heatToMult(w.stats.heat, w.loadout.heatCfg.max)
    if (w.stats.feverActiveT <= 0) {
      endFeverCrash(w, clock)
    }
  }
  if (w.stats.feverCooldownT > 0) {
    w.stats.feverCooldownT = Math.max(0, w.stats.feverCooldownT - dt)
  }
}

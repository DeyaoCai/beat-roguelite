import type { AudioClockPort } from '../shared/ports'
import { addHeat } from './heat'
import type { EnemyKind, HitEffect, World } from './types'
import {
  carapaceDr,
  hasRelic,
  LEECH_BANK_CAP,
  LEECH_DRAIN_PER_SEC,
  SHIELD_REGEN_SEC,
} from '../progression/relics'

/** Status / hit payloads by fodder kind. */
export function hitEffectForKind(kind: EnemyKind, source: 'bullet' | 'contact'): HitEffect {
  switch (kind) {
    case 'spitter':
      return source === 'bullet'
        ? { poisonT: 3.2, poisonDps: 0.55 }
        : { poisonT: 2.2, poisonDps: 0.45 }
    case 'frost':
      return { slowT: 2.4, slowMul: 0.48 }
    case 'leech':
      return source === 'contact'
        ? { bleedT: 3.6, bleedDps: 0.7 }
        : { bleedT: 2.0, bleedDps: 0.45 }
    case 'elite':
      return source === 'bullet'
        ? { slowT: 1.2, slowMul: 0.62 }
        : { bleedT: 1.8, bleedDps: 0.4 }
    default:
      return {}
  }
}

export function applyHitEffect(w: World, fx: HitEffect | undefined): void {
  if (!fx) return
  if (fx.slowT && fx.slowT > 0) {
    w.player.slowT = Math.max(w.player.slowT, fx.slowT)
    w.player.slowMul = Math.min(w.player.slowMul, fx.slowMul ?? 0.5)
  }
  if (fx.poisonT && fx.poisonT > 0) {
    w.player.poisonT = Math.max(w.player.poisonT, fx.poisonT)
    w.player.poisonDps = Math.max(w.player.poisonDps, fx.poisonDps ?? 0.5)
  }
  if (fx.bleedT && fx.bleedT > 0) {
    w.player.bleedT = Math.max(w.player.bleedT, fx.bleedT)
    w.player.bleedDps = Math.max(w.player.bleedDps, fx.bleedDps ?? 0.5)
  }
}

/** Instant hit (bullet / contact). Optional status payload. */
export function hurtPlayer(
  w: World,
  clock: AudioClockPort,
  fx?: HitEffect,
  dmgMul = 1,
): void {
  if (w.player.invuln > 0 || w.dead) return
  if (w.loadout.dodgeChance > 0 && w.rng() < w.loadout.dodgeChance) {
    w.player.invuln = Math.max(w.player.invuln, 0.16)
    clock.beep('ui')
    return
  }
  if (w.player.shieldOn) {
    w.player.shieldOn = false
    w.player.shieldCd = SHIELD_REGEN_SEC
    w.player.invuln = Math.max(w.player.invuln, 0.18)
    clock.beep('ui')
    return
  }
  const incoming =
    dmgMul * (1 - Math.min(0.5, w.loadout.armorDr + carapaceDr(w.carapaceStacks)))
  w.player.hurtAcc += incoming
  let lost = 0
  while (w.player.hurtAcc >= 1 && !w.dead) {
    w.player.hurtAcc -= 1
    w.player.hp -= 1
    lost += 1
  }
  w.player.invuln = 0.52
  w.player.hurtFlash = lost > 0 ? 0.38 : 0.22
  applyHitEffect(w, fx)
  if (lost <= 0) return
  w.stats.heat = addHeat(
    w.stats.heat,
    -w.loadout.heatCfg.hurtLoss * w.loadout.hurtHeatMul,
    w.loadout.heatCfg,
  )
  clock.beep('hurt')
  if (w.player.hp <= 0) {
    w.dead = true
    clock.beep('death')
  }
}

function tickDot(
  w: World,
  dt: number,
  clock: AudioClockPort,
  fieldT: 'poisonT' | 'bleedT',
  fieldDps: 'poisonDps' | 'bleedDps',
  fieldAcc: 'poisonAcc' | 'bleedAcc',
): void {
  if (w.player[fieldT] <= 0) {
    w.player[fieldDps] = 0
    w.player[fieldAcc] = 0
    return
  }
  w.player[fieldT] = Math.max(0, w.player[fieldT] - dt)
  w.player[fieldAcc] += w.player[fieldDps] * dt
  // Accrue fractional HP; each full point hurts without long i-frames.
  while (w.player[fieldAcc] >= 1 && !w.dead) {
    w.player[fieldAcc] -= 1
    w.player.hp -= 1
    w.player.hurtFlash = Math.max(w.player.hurtFlash, 0.22)
    clock.beep('hurt')
    if (w.player.hp <= 0) {
      w.dead = true
      clock.beep('death')
      break
    }
  }
  if (w.player[fieldT] <= 0) {
    w.player[fieldDps] = 0
    w.player[fieldAcc] = 0
  }
}

export function tickPlayerStatuses(w: World, dt: number, clock: AudioClockPort): void {
  if (w.player.slowT > 0) {
    w.player.slowT = Math.max(0, w.player.slowT - dt)
    if (w.player.slowT <= 0) w.player.slowMul = 1
  } else {
    w.player.slowMul = 1
  }
  tickDot(w, dt, clock, 'poisonT', 'poisonDps', 'poisonAcc')
  tickDot(w, dt, clock, 'bleedT', 'bleedDps', 'bleedAcc')
}

export function playerMoveMul(w: World): number {
  return w.player.slowT > 0 ? w.player.slowMul : 1
}

export function tickRelics(w: World, dt: number): void {
  if (hasRelic(w.upgrades, 'relic_leech') && w.player.leechBank > 0 && w.player.hp < w.player.maxHp) {
    const drain = Math.min(w.player.leechBank, LEECH_DRAIN_PER_SEC * dt)
    w.player.leechBank -= drain
    w.player.hp = Math.min(w.player.maxHp, w.player.hp + drain)
  } else if (w.player.leechBank > LEECH_BANK_CAP) {
    w.player.leechBank = LEECH_BANK_CAP
  }
  if (!hasRelic(w.upgrades, 'relic_ward') || w.player.shieldOn || w.dead) return
  w.player.shieldCd = Math.max(0, w.player.shieldCd - dt)
  if (w.player.shieldCd <= 0) w.player.shieldOn = true
}

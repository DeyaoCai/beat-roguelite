import type { AudioClockPort, KeyState } from '../shared/ports'
import { addHeat } from './heat'
import { norm } from './math'
import { dashHeatCost } from '../progression/relics'
import {
  firePlayerPattern,
  nearestEnemy,
  tickAura,
  tickChain,
  tickFlame,
  tickStar,
} from './combat'
import { playerMoveMul, tickPlayerStatuses } from './status'
import {
  applyGroundDisplacement,
  dashDistMul,
  groundMoveMul,
  tickPlayerIce,
} from './weather'
import type { World } from './types'

const DASH_DIST = 2.7
const DASH_DUR = 0.13
const DASH_IFRAME = 0.2
const DASH_CD = 0.42
const DASH_HEAT = 16

export function tickPlayerMove(
  w: World,
  dt: number,
  keys: KeyState,
  clock?: AudioClockPort,
): void {
  w.player.dashCd = Math.max(0, w.player.dashCd - dt)

  let mx = 0
  let mz = 0
  if (keys.w) mz -= 1
  if (keys.s) mz += 1
  if (keys.a) mx -= 1
  if (keys.d) mx += 1
  w.player.moving = !!(mx || mz) || w.player.dashT > 0
  if (mx || mz) {
    const d = norm(mx, mz)
    w.player.lastMoveX = d.x
    w.player.lastMoveZ = d.z
  }

  if (clock && keys.dashPressed) tryDash(w, clock)

  const gMul = groundMoveMul(w, w.player.x, w.player.z)
  let inX = 0
  let inZ = 0
  if (mx || mz) {
    const d = norm(mx, mz)
    inX = d.x
    inZ = d.z
  }
  tickPlayerIce(w, dt, inX, inZ)

  if (w.player.dashT > 0) {
    w.player.dashT = Math.max(0, w.player.dashT - dt)
    const next = applyGroundDisplacement(
      w,
      w.player.x,
      w.player.z,
      w.player.r,
      dt,
      w.player.dashVx + w.player.iceVx,
      w.player.dashVz + w.player.iceVz,
    )
    w.player.x = next.x
    w.player.z = next.z
    w.player.invuln = Math.max(w.player.invuln, w.player.dashT > 0 ? 0.04 : 0)
  } else if (mx || mz) {
    const d = norm(mx, mz)
    const step = w.player.speed * playerMoveMul(w) * gMul
    const next = applyGroundDisplacement(
      w,
      w.player.x,
      w.player.z,
      w.player.r,
      dt,
      d.x * step + w.player.iceVx,
      d.z * step + w.player.iceVz,
    )
    w.player.x = next.x
    w.player.z = next.z
    w.player.facingX = d.x
    w.player.facingZ = d.z
  } else {
    const next = applyGroundDisplacement(
      w,
      w.player.x,
      w.player.z,
      w.player.r,
      dt,
      w.player.iceVx,
      w.player.iceVz,
    )
    w.player.x = next.x
    w.player.z = next.z
  }

  w.player.invuln = Math.max(0, w.player.invuln - dt)
  w.player.hurtFlash = Math.max(0, w.player.hurtFlash - dt)

  const regen = w.loadout.hpRegen
  if (regen > 0 && w.player.hp < w.player.maxHp) {
    w.player.hp = Math.min(w.player.maxHp, w.player.hp + regen * dt)
  }

  if (w.player.dashT <= 0) {
    const target = nearestEnemy(w)
    if (target) {
      const d = norm(target.x - w.player.x, target.z - w.player.z)
      w.player.facingX = d.x
      w.player.facingZ = d.z
    }
  }
}

function tryDash(w: World, clock: AudioClockPort): void {
  if (w.player.dashT > 0 || w.player.dashCd > 0 || w.dead) return
  const heatCost = dashHeatCost(w.upgrades, DASH_HEAT)
  if (w.stats.heat < heatCost) {
    clock.beep('ui_back')
    return
  }
  let dx = w.player.lastMoveX
  let dz = w.player.lastMoveZ
  if (Math.hypot(dx, dz) < 0.2) {
    dx = w.player.facingX
    dz = w.player.facingZ
  }
  const d = norm(dx, dz)
  const spd = (DASH_DIST * dashDistMul(w)) / DASH_DUR
  w.player.dashT = DASH_DUR
  w.player.dashCd = DASH_CD
  w.player.dashVx = d.x * spd
  w.player.dashVz = d.z * spd
  w.player.facingX = d.x
  w.player.facingZ = d.z
  w.player.invuln = Math.max(w.player.invuln, DASH_IFRAME)
  if (w.stats.feverActiveT > 0) {
    const win = w.stats.feverActiveMax || 7
    const maxH = w.loadout.heatCfg.max
    w.stats.feverActiveT = Math.max(
      0,
      w.stats.feverActiveT - (maxH > 0 ? (heatCost / maxH) * win : 0),
    )
  } else {
    w.stats.heat = addHeat(w.stats.heat, -heatCost, w.loadout.heatCfg)
  }
  clock.beep('ui')
}

export function tickPlayerWeapons(w: World, dt: number, clock: AudioClockPort): void {
  const L = w.loadout
  w.player.fireCd -= dt
  const target = nearestEnemy(w)

  const orb = L.orb
  if (orb && w.player.fireCd <= 0 && target) {
    const reach = orb.speed * orb.life
    const dist = Math.hypot(target.x - w.player.x, target.z - w.player.z)
    if (dist <= reach + target.r) {
      w.player.fireCd = orb.interval
      const d = norm(target.x - w.player.x, target.z - w.player.z)
      const count = Math.max(1, orb.count + (L.spreadExtra > 0 ? L.spreadExtra * 2 : 0))
      const spread = L.spreadExtra > 0 ? 0.35 + L.spreadExtra * 0.15 : 0
      firePlayerPattern(w, d.x, d.z, count, spread, orb.damage * w.stats.mult, undefined, clock)
    }
  }

  tickFlame(w, dt, clock)
  tickAura(w, dt, clock)
  tickChain(w, dt, clock)
  tickStar(w, dt, clock)
  tickPlayerStatuses(w, dt, clock)
}

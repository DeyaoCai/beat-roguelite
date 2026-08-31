import type { AudioClockPort } from '../shared/ports'
import { clamp, norm } from './math'
import { hitsObstacle, moveWithObstacles } from './map'
import { idleCombat, isFrozen, outgoingMul } from './elemental'
import { fodderHp, scaleEnemySpeed } from './waveScale'
import type { BossId, BossTeleKind, Enemy, World } from './types'

export type { BossId }

export type BossDef = {
  id: BossId
  name: string
  /** HP relative to fodderHp(wave). */
  hpMul: number
  r: number
  speed: number
  shootCd0: number
}

/** HP muls align with plans/beat-roguelite/wave-bosses.md */
const DEFS: Record<number, BossDef> = {
  1: {
    id: 'warden',
    name: '节拍监守',
    hpMul: 16,
    r: 0.68,
    speed: 1.75,
    shootCd0: 1.2,
  },
  2: {
    id: 'caller',
    name: '猎群号手',
    hpMul: 18,
    r: 0.7,
    speed: 2.1,
    shootCd0: 1.3,
  },
  3: {
    id: 'hex',
    name: '镜咒法师',
    hpMul: 17,
    r: 0.62,
    speed: 1.35,
    shootCd0: 1.0,
  },
  4: {
    id: 'choir',
    name: '铁律合唱',
    hpMul: 24,
    r: 0.78,
    speed: 1.65,
    shootCd0: 3.2,
  },
  5: {
    id: 'tyrant',
    name: '终曲暴君',
    hpMul: 28,
    r: 0.82,
    speed: 2.05,
    shootCd0: 0.95,
  },
}

export function bossDefForWave(wave: number): BossDef {
  const n = ((Math.max(1, wave) - 1) % 5) + 1
  return DEFS[n] ?? DEFS[1]!
}

export function bossName(id: BossId | undefined): string {
  if (!id) return 'BOSS'
  for (const d of Object.values(DEFS)) {
    if (d.id === id) return d.name
  }
  return 'BOSS'
}

function pushBullet(
  w: World,
  x: number,
  z: number,
  vx: number,
  vz: number,
  opts?: { life?: number; r?: number; damage?: number; dmgMul?: number },
): void {
  w.bullets.push({
    x,
    z,
    vx,
    vz,
    life: opts?.life ?? 2.8,
    damage: opts?.damage ?? 1,
    pierce: 0,
    friendly: false,
    r: opts?.r ?? 0.2,
    hit: new Set(),
    dmgMul: opts?.dmgMul,
  })
}

function fireFan(
  w: World,
  e: Enemy,
  towardX: number,
  towardZ: number,
  shots: number,
  spread: number,
  speed: number,
  r = 0.22,
): void {
  const d = norm(towardX, towardZ)
  for (let s = 0; s < shots; s++) {
    const t = shots === 1 ? 0 : (s / (shots - 1) - 0.5) * spread
    const c = Math.cos(t)
    const si = Math.sin(t)
    const dx = d.x * c - d.z * si
    const dz = d.x * si + d.z * c
    pushBullet(w, e.x, e.z, dx * speed, dz * speed, { r, dmgMul: outgoingMul(e) })
  }
}

function fireRing(
  w: World,
  x: number,
  z: number,
  count: number,
  speed: number,
  r = 0.2,
  phase = 0,
): void {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2
    pushBullet(w, x, z, Math.cos(a) * speed, Math.sin(a) * speed, { r, life: 3.2 })
  }
}

function fireCross(w: World, x: number, z: number, speed: number): void {
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [0.7, -0.7],
    [-0.7, 0.7],
    [-0.7, -0.7],
  ] as const
  for (const [dx, dz] of dirs) {
    const d = norm(dx, dz)
    pushBullet(w, x, z, d.x * speed, d.z * speed, { r: 0.21, life: 3 })
  }
}

function setBossHint(w: World, text: string, hold = 1.35): void {
  w.bossHint = text
  w.bossHintT = hold
}

function beginWindup(
  w: World,
  e: Enemy,
  sec: number,
  hint: string,
  kind: BossTeleKind,
): void {
  e.windupT = sec
  e.windupMax = sec
  e.windupKind = kind
  e.hurtFlash = Math.max(e.hurtFlash, sec)
  setBossHint(w, hint, sec + 0.45)
}

function spawnCallerAdds(w: World, boss: Enemy, n: number): void {
  const wave = w.stats.wave
  const hp = Math.max(2, Math.floor(fodderHp(wave) * 0.85))
  for (let i = 0; i < n; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = 1.4 + w.rng() * 1.2
    const x = clamp(boss.x + Math.cos(ang) * rad, -w.arena.half + 1, w.arena.half - 1)
    const z = clamp(boss.z + Math.sin(ang) * rad, -w.arena.half + 1, w.arena.half - 1)
    if (hitsObstacle(x, z, 0.32, w.obstacles)) continue
    w.enemies.push({
      x,
      z,
      hp,
      maxHp: hp,
      r: 0.3,
      speed: scaleEnemySpeed(3.9 + Math.max(0, wave - 1) * 0.18, wave, 'trash'),
      shootCd: 99,
      kind: 'chaser',
      ...idleCombat('chaser', wave),
      aiCd: 0,
      aiPhase: 0,
      windupT: 0,
      windupMax: 0,
      windupKind: null,
      dashT: 0,
      dashVx: 0,
      dashVz: 0,
      spin: 0,
      hurtFlash: 0.55,
    })
  }
}

function teleportBoss(w: World, e: Enemy): void {
  const half = w.arena.half - 2
  for (let i = 0; i < 12; i++) {
    const x = (w.rng() * 2 - 1) * half
    const z = (w.rng() * 2 - 1) * half
    if (Math.hypot(x - w.player.x, z - w.player.z) < 7) continue
    if (hitsObstacle(x, z, e.r, w.obstacles)) continue
    e.x = x
    e.z = z
    return
  }
}

function tickBossHint(w: World, dt: number): void {
  if (w.bossHintT <= 0) {
    w.bossHint = ''
    return
  }
  w.bossHintT = Math.max(0, w.bossHintT - dt)
  if (w.bossHintT <= 0) w.bossHint = ''
}

/** Movement + unique attacks for the wave boss. Returns true if this enemy was handled. */
export function tickBoss(
  w: World,
  e: Enemy,
  dt: number,
  clock: AudioClockPort,
): boolean {
  if (e.kind !== 'boss' || !e.bossId) return false
  tickBossHint(w, dt)
  if (isFrozen(e)) return true

  const wave = w.stats.wave
  const shotSpd = 6.2 + wave * 0.28
  const toP = { x: w.player.x - e.x, z: w.player.z - e.z }
  const lim = w.arena.half - e.r

  // Dash override (choir)
  if (e.dashT > 0) {
    e.dashT -= dt
    const next = moveWithObstacles(
      e.x,
      e.z,
      e.dashVx * dt,
      e.dashVz * dt,
      e.r,
      w.obstacles,
      lim,
    )
    e.x = next.x
    e.z = next.z
  } else if (e.windupT <= 0) {
    const chase =
      e.bossId === 'hex'
        ? 0.55
        : e.bossId === 'caller'
          ? 0.75
          : e.bossId === 'tyrant' && e.aiPhase >= 1
            ? 1.25
            : 1
    const d = norm(toP.x, toP.z)
    const step = e.speed * chase * dt
    const next = moveWithObstacles(e.x, e.z, d.x * step, d.z * step, e.r, w.obstacles, lim)
    e.x = next.x
    e.z = next.z
  }

  e.aiCd = Math.max(0, e.aiCd - dt)
  e.shootCd -= dt

  if (e.windupT > 0) {
    e.windupT = Math.max(0, e.windupT - dt)
    e.hurtFlash = Math.max(e.hurtFlash, 0.12)
    if (e.windupT > 0) return true
    // Windup just ended → fire the pending special (aiPhase encodes which).
    resolveWindup(w, e, clock, shotSpd, toP)
    return true
  }

  switch (e.bossId) {
    case 'warden': {
      if (e.shootCd <= 0) {
        fireFan(w, e, toP.x, toP.z, 3, 0.42, shotSpd, 0.22)
        e.shootCd = 1.0 + w.rng() * 0.25
      }
      if (e.aiCd <= 0) {
        beginWindup(w, e, 0.9, '脉冲环 · 走开', 'ring')
        e.aiPhase = 1
      }
      break
    }
    case 'caller': {
      if (e.shootCd <= 0) {
        fireFan(w, e, toP.x, toP.z, 2, 0.28, shotSpd * 1.05, 0.2)
        e.shootCd = 1.15 + w.rng() * 0.3
      }
      if (e.aiCd <= 0) {
        beginWindup(w, e, 0.75, '清增援优先', 'summon')
        e.aiPhase = 1
      }
      break
    }
    case 'hex': {
      if (e.shootCd <= 0) {
        fireCross(w, e.x, e.z, shotSpd * 0.95)
        e.shootCd = 1.35 + w.rng() * 0.25
      }
      if (e.aiCd <= 0) {
        beginWindup(w, e, 0.85, '闪现 · 预判落点', 'cross')
        e.aiPhase = 1
      }
      break
    }
    case 'choir': {
      if (e.shootCd <= 0) {
        if (e.aiPhase % 2 === 0) {
          beginWindup(w, e, 0.8, '全环弹幕', 'ring')
        } else {
          beginWindup(w, e, 0.7, '冲锋 · 侧闪', 'dash')
        }
      }
      break
    }
    case 'tyrant': {
      if (e.hp / e.maxHp <= 0.5 && e.aiPhase < 1) {
        e.aiPhase = 1
        e.speed *= 1.22
        beginWindup(w, e, 1.05, '半血狂暴', 'phase')
        clock.beep('kill_boss')
        e.shootCd = 0.9
        e.aiCd = 1.6
        break
      }
      if (e.aiPhase >= 1) {
        e.spin += dt * (2.4 + wave * 0.15)
        if (e.shootCd <= 0) {
          for (let i = 0; i < 3; i++) {
            const a = e.spin + (i / 3) * Math.PI * 2
            pushBullet(
              w,
              e.x,
              e.z,
              Math.cos(a) * shotSpd * 0.9,
              Math.sin(a) * shotSpd * 0.9,
              { r: 0.22, life: 3.4 },
            )
          }
          e.shootCd = 0.22
        }
        if (e.aiCd <= 0) {
          beginWindup(w, e, 0.65, '扇射', 'fan')
          e.aiPhase = 2
        }
      } else {
        if (e.shootCd <= 0) {
          fireFan(w, e, toP.x, toP.z, 5, 0.55, shotSpd * 0.92, 0.24)
          e.shootCd = 0.85 + w.rng() * 0.25
        }
        if (e.aiCd <= 0) {
          beginWindup(w, e, 0.85, '脉冲环 · 走开', 'ring')
          e.aiPhase = 0
        }
      }
      break
    }
  }
  return true
}

function resolveWindup(
  w: World,
  e: Enemy,
  clock: AudioClockPort,
  shotSpd: number,
  toP: { x: number; z: number },
): void {
  e.windupKind = null
  e.windupMax = 0
  const wave = w.stats.wave
  switch (e.bossId) {
    case 'warden': {
      fireRing(w, e.x, e.z, 12, shotSpd * 0.72, 0.2)
      clock.beep('boss_spawn')
      e.aiCd = 4.0
      break
    }
    case 'caller': {
      const room = Math.max(0, 14 + wave * 3 - w.enemies.length)
      spawnCallerAdds(w, e, Math.min(2 + (wave >= 2 ? 1 : 0), room))
      clock.beep('elite_spawn')
      e.aiCd = 5.0
      break
    }
    case 'hex': {
      teleportBoss(w, e)
      fireCross(w, e.x, e.z, shotSpd * 0.85)
      clock.beep('boss_spawn')
      e.aiCd = 5.5
      break
    }
    case 'choir': {
      if (e.aiPhase % 2 === 0) {
        fireRing(w, e.x, e.z, 16, shotSpd * 0.78, 0.22)
        clock.beep('boss_spawn')
      } else {
        const d = norm(toP.x, toP.z)
        e.dashVx = d.x * (9.5 + wave * 0.4)
        e.dashVz = d.z * (9.5 + wave * 0.4)
        e.dashT = 0.55
        fireFan(w, e, toP.x, toP.z, 3, 0.3, shotSpd, 0.2)
      }
      e.aiPhase += 1
      // Readable attack window between ring ↔ charge.
      e.shootCd = 3.4 + w.rng() * 0.35
      break
    }
    case 'tyrant': {
      if (e.aiPhase === 1 && e.hp / e.maxHp <= 0.5) {
        // Phase-enter burst after "半血狂暴" windup.
        fireRing(w, e.x, e.z, 22, shotSpd * 0.88, 0.26)
        fireFan(w, e, toP.x, toP.z, 5, 0.55, shotSpd, 0.24)
        e.shootCd = 0.45
        e.aiCd = 2.2
        break
      }
      if (e.aiPhase >= 2) {
        fireFan(w, e, toP.x, toP.z, 5, 0.55, shotSpd, 0.24)
        e.aiCd = 2.8
        e.aiPhase = 1
        break
      }
      fireRing(w, e.x, e.z, 14, shotSpd * 0.7, 0.22)
      e.aiCd = 4.5
      break
    }
  }
}

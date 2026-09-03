import type { AudioClockPort } from '../shared/ports'
import {
  BOSS_BY_WAVE,
  BOSS_CYCLE,
  BOSS_SHOT,
  bossSkillsFor,
  type BossRuleDef,
  type BossSkillDef,
} from '../../content/rules'
import { clamp, norm } from './math'
import { hitsObstacle, moveWithObstacles } from './map'
import { idleCombat, isFrozen, outgoingMul } from './elemental'
import { makeEnemyMeta } from './enemyMeta'
import { makeFoeBulletMeta } from './bulletMeta'
import { fodderHp, scaleEnemySpeed } from './waveScale'
import { pushHint } from './hints'
import type { BossId, BossTeleKind, Enemy, World } from './types'

export type { BossId }

export type BossDef = BossRuleDef

export function bossDefForWave(wave: number): BossDef {
  const n = ((Math.max(1, wave) - 1) % BOSS_CYCLE) + 1
  return BOSS_BY_WAVE[n] ?? BOSS_BY_WAVE[1]!
}

export function bossName(id: BossId | undefined): string {
  if (!id) return 'BOSS'
  for (const d of Object.values(BOSS_BY_WAVE)) {
    if (d.id === id) return d.name
  }
  return 'BOSS'
}

function skillsOf(e: Enemy): BossSkillDef {
  return e.meta.boss?.skills ?? bossSkillsFor(e.bossId!)
}

function shotSpeed(wave: number): number {
  return BOSS_SHOT.spdBase + wave * BOSS_SHOT.spdPerWave
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
    meta: makeFoeBulletMeta('boss'),
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
    pushBullet(w, x, z, Math.cos(a) * speed, Math.sin(a) * speed, {
      r,
      life: BOSS_SHOT.ringLife,
    })
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
    pushBullet(w, x, z, d.x * speed, d.z * speed, {
      r: BOSS_SHOT.crossR,
      life: BOSS_SHOT.crossLife,
    })
  }
}

function setBossHint(w: World, text: string, hold = 1.35): void {
  pushHint(w, 'boss', text, hold)
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

function spawnCallerAdds(w: World, boss: Enemy, n: number, S: BossSkillDef): void {
  const sm = S.special?.summon
  if (!sm) return
  const wave = w.stats.wave
  const hp = Math.max(2, Math.floor(fodderHp(wave) * sm.addHpMul))
  for (let i = 0; i < n; i++) {
    const ang = w.rng() * Math.PI * 2
    const rad = 1.4 + w.rng() * 1.2
    const x = clamp(boss.x + Math.cos(ang) * rad, -w.arena.half + 1, w.arena.half - 1)
    const z = clamp(boss.z + Math.sin(ang) * rad, -w.arena.half + 1, w.arena.half - 1)
    if (hitsObstacle(x, z, 0.32, w.obstacles)) continue
    const meta = makeEnemyMeta('chaser')
    w.enemies.push({
      x,
      z,
      hp,
      maxHp: hp,
      r: meta.fodder?.r ?? 0.3,
      speed: scaleEnemySpeed(
        sm.addSpeedBase + Math.max(0, wave - 1) * sm.addSpeedPerWave,
        wave,
        'trash',
      ),
      shootCd: 99,
      kind: 'chaser',
      meta,
      ...idleCombat('chaser', wave, meta.armor),
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

function chaseMul(e: Enemy, S: BossSkillDef): number {
  if (e.bossId === 'tyrant' && e.aiPhase >= 1) return S.chaseMulRage ?? S.chaseMul
  return S.chaseMul
}

/** Movement + unique attacks for the wave boss. Returns true if this enemy was handled. */
export function tickBoss(
  w: World,
  e: Enemy,
  dt: number,
  clock: AudioClockPort,
): boolean {
  if (e.kind !== 'boss' || !e.bossId) return false
  if (isFrozen(e)) return true

  const wave = w.stats.wave
  const S = skillsOf(e)
  const shotSpd = shotSpeed(wave)
  const toP = { x: w.player.x - e.x, z: w.player.z - e.z }
  const lim = w.arena.half - e.r

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
    const d = norm(toP.x, toP.z)
    const resist = e.knockT > 0 ? 0.45 : 1
    const step = e.speed * chaseMul(e, S) * dt * resist
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
    resolveWindup(w, e, clock, shotSpd, toP, S)
    return true
  }

  switch (e.bossId) {
    case 'warden':
    case 'caller': {
      const fan = S.basicFan
      const sp = S.special
      if (fan && e.shootCd <= 0) {
        fireFan(w, e, toP.x, toP.z, fan.shots, fan.spread, shotSpd * fan.spdMul, fan.r)
        e.shootCd = fan.cdBase + w.rng() * fan.cdJitter
      }
      if (sp && e.aiCd <= 0) {
        beginWindup(w, e, sp.windup, sp.hint, sp.tele)
        e.aiPhase = 1
      }
      break
    }
    case 'hex': {
      const cross = S.basicCross
      const sp = S.special
      if (cross && e.shootCd <= 0) {
        fireCross(w, e.x, e.z, shotSpd * cross.spdMul)
        e.shootCd = cross.cdBase + w.rng() * cross.cdJitter
      }
      if (sp && e.aiCd <= 0) {
        beginWindup(w, e, sp.windup, sp.hint, sp.tele)
        e.aiPhase = 1
      }
      break
    }
    case 'choir': {
      const ch = S.choir
      if (ch && e.shootCd <= 0) {
        if (e.aiPhase % 2 === 0) {
          beginWindup(w, e, ch.ringWindup, ch.ringHint, 'ring')
        } else {
          beginWindup(w, e, ch.dashWindup, ch.dashHint, 'dash')
        }
      }
      break
    }
    case 'tyrant': {
      const T = S.tyrant
      const fan = S.basicFan
      const sp = S.special
      if (T && e.hp / e.maxHp <= T.phaseHpFrac && e.aiPhase < 1) {
        e.aiPhase = 1
        e.speed *= T.phaseSpeedMul
        beginWindup(w, e, T.phaseWindup, T.phaseHint, 'phase')
        clock.beep('kill_boss')
        e.shootCd = T.phaseShootCd
        e.aiCd = T.phaseAiCd
        break
      }
      if (T && e.aiPhase >= 1) {
        e.spin += dt * (T.rageSpinBase + wave * T.rageSpinPerWave)
        if (e.shootCd <= 0) {
          for (let i = 0; i < T.rageSpiralShots; i++) {
            const a = e.spin + (i / T.rageSpiralShots) * Math.PI * 2
            pushBullet(
              w,
              e.x,
              e.z,
              Math.cos(a) * shotSpd * T.rageSpiralSpdMul,
              Math.sin(a) * shotSpd * T.rageSpiralSpdMul,
              { r: T.rageSpiralR, life: T.rageSpiralLife },
            )
          }
          e.shootCd = T.rageSpiralCd
        }
        if (e.aiCd <= 0) {
          beginWindup(w, e, T.rageFanWindup, T.rageFanHint, 'fan')
          e.aiPhase = 2
        }
      } else {
        if (fan && e.shootCd <= 0) {
          fireFan(w, e, toP.x, toP.z, fan.shots, fan.spread, shotSpd * fan.spdMul, fan.r)
          e.shootCd = fan.cdBase + w.rng() * fan.cdJitter
        }
        if (sp && e.aiCd <= 0) {
          beginWindup(w, e, sp.windup, sp.hint, sp.tele)
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
  S: BossSkillDef,
): void {
  e.windupKind = null
  e.windupMax = 0
  const wave = w.stats.wave
  switch (e.bossId) {
    case 'warden': {
      const ring = S.special?.ring
      if (ring) fireRing(w, e.x, e.z, ring.count, shotSpd * ring.spdMul, ring.r)
      clock.beep('boss_spawn')
      e.aiCd = S.special?.aiCd ?? 4
      break
    }
    case 'caller': {
      const sm = S.special?.summon
      if (sm) {
        const room = Math.max(0, sm.roomBase + wave * sm.roomPerWave - w.enemies.length)
        const n = Math.min(
          sm.addBase + (wave >= sm.addExtraFromWave ? 1 : 0),
          room,
        )
        spawnCallerAdds(w, e, n, S)
      }
      clock.beep('elite_spawn')
      e.aiCd = S.special?.aiCd ?? 5
      break
    }
    case 'hex': {
      teleportBoss(w, e)
      fireCross(w, e.x, e.z, shotSpd * (S.special?.crossSpdMul ?? 0.85))
      clock.beep('boss_spawn')
      e.aiCd = S.special?.aiCd ?? 5.5
      break
    }
    case 'choir': {
      const ch = S.choir
      if (!ch) break
      if (e.aiPhase % 2 === 0) {
        fireRing(w, e.x, e.z, ch.ring.count, shotSpd * ch.ring.spdMul, ch.ring.r)
        clock.beep('boss_spawn')
      } else {
        const d = norm(toP.x, toP.z)
        const spd = ch.dashSpeedBase + wave * ch.dashSpeedPerWave
        e.dashVx = d.x * spd
        e.dashVz = d.z * spd
        e.dashT = ch.dashDuration
        const f = ch.dashFan
        fireFan(w, e, toP.x, toP.z, f.shots, f.spread, shotSpd * f.spdMul, f.r)
      }
      e.aiPhase += 1
      e.shootCd = ch.recoverCdBase + w.rng() * ch.recoverCdJitter
      break
    }
    case 'tyrant': {
      const T = S.tyrant
      const sp = S.special
      if (T && e.aiPhase === 1 && e.hp / e.maxHp <= T.phaseHpFrac) {
        const br = T.phaseBurstRing
        const bf = T.phaseBurstFan
        fireRing(w, e.x, e.z, br.count, shotSpd * br.spdMul, br.r)
        fireFan(w, e, toP.x, toP.z, bf.shots, bf.spread, shotSpd * bf.spdMul, bf.r)
        e.shootCd = T.phaseBurstShootCd
        e.aiCd = T.phaseBurstAiCd
        break
      }
      if (T && e.aiPhase >= 2) {
        const f = T.rageFan
        fireFan(w, e, toP.x, toP.z, f.shots, f.spread, shotSpd * f.spdMul, f.r)
        e.aiCd = T.rageFanAiCd
        e.aiPhase = 1
        break
      }
      const ring = sp?.ring
      if (ring) fireRing(w, e.x, e.z, ring.count, shotSpd * ring.spdMul, ring.r)
      e.aiCd = sp?.aiCd ?? 4.5
      break
    }
  }
}

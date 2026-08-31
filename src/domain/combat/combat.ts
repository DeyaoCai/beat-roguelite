import type { AudioClockPort } from '../shared/ports'
import { addHeat } from './heat'
import { clamp, inCone, norm } from './math'
import type { Crater, DamageKind, ElemSource, Enemy, World } from './types'
import {
  applyEnemyDefeatedRewards,
} from '../progression'
import {
  hasRelic,
  LEECH_BANK_CAP,
  LEECH_HIT_CAP,
  LEECH_PER_HIT,
} from '../progression/relics'
import {
  applyAuraSlow,
  applyKnockback,
  incomingMul,
  noteElemHit,
} from './elemental'
import { weatherDamageMul } from './weather'
import { weaponHitMul, type WeaponHitCtx } from './weaponMods'

export type HitOpts = {
  canCrit?: boolean
  elem?: ElemSource
  skipElem?: boolean
  skipSplit?: boolean
  skipBounce?: boolean
  skipSplash?: boolean
  skipCleave?: boolean
  /** 武器情境修正：目标数 / 距离 / 主伤·分裂·溅射… */
  ctx?: WeaponHitCtx
}

export type { WeaponHitCtx } from './weaponMods'

export function nearestEnemy(w: World): Enemy | null {
  let best: Enemy | null = null
  let bestD = Infinity
  for (const e of w.enemies) {
    const d = Math.hypot(e.x - w.player.x, e.z - w.player.z)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

export function damageEnemy(
  w: World,
  e: Enemy,
  damage: number,
  clock: AudioClockPort,
  heatScale = 1,
  kind: DamageKind = 'hit',
  opts?: HitOpts | boolean,
): void {
  if (e.hp <= 0 || damage <= 0) return
  const o: HitOpts = typeof opts === 'boolean' ? { canCrit: opts } : opts ?? {}
  const canCrit = o.canCrit !== false
  let dmg =
    damage * incomingMul(e) * weatherDamageMul(w.weatherId, kind) * weaponHitMul(kind, o.ctx)
  let crit = false
  if (canCrit && w.loadout.critChance > 0) {
    let p = w.loadout.critChance
    if (kind === 'flame' || kind === 'aura' || kind === 'slash' || kind === 'orbit') {
      p *= 0.5
      if (w.player.tickCritLock > 0) p = 0
    }
    if (w.rng() < p) {
      crit = true
      dmg *= w.loadout.critDamage
      if (kind === 'flame' || kind === 'aura' || kind === 'slash' || kind === 'orbit') {
        w.player.tickCritLock = 0.2
      }
    }
  }
  const before = e.hp
  e.hp -= dmg
  e.hurtFlash = 0.18
  if (hasRelic(w.upgrades, 'relic_leech')) {
    const dealt = Math.max(0, before - Math.max(0, e.hp))
    if (dealt > 0) {
      w.player.leechBank = Math.min(
        LEECH_BANK_CAP,
        w.player.leechBank + Math.min(LEECH_HIT_CAP, dealt * LEECH_PER_HIT),
      )
    }
  }
  w.stats.heat = addHeat(
    w.stats.heat,
    w.loadout.heatCfg.hitGain * heatScale,
    w.loadout.heatCfg,
  )
  w.stats.score += Math.floor(5 * w.stats.mult)
  const dead = e.hp <= 0
  pushFloater(w, e.x, e.z, dmg, kind, dead, crit)
  if (dead) {
    if (e.kind === 'chest') {
      e.hurtFlash = 0.35
      clock.beep('pickup_relic')
      clock.beep('offer')
      applyEnemyDefeatedRewards(w, e)
      return
    }
    w.stats.kills += 1
    const scoreMul =
      e.kind === 'boss' ? 8 : e.kind === 'elite' ? 3 : 1
    w.stats.score += Math.floor(40 * w.stats.mult * scoreMul)
    w.stats.heat = addHeat(w.stats.heat, w.loadout.heatCfg.killGain, w.loadout.heatCfg)
    e.hurtFlash = 0.28
    clock.beep(
      e.kind === 'boss' ? 'kill_boss' : e.kind === 'elite' ? 'kill_elite' : 'kill',
    )
    applyEnemyDefeatedRewards(w, e)
    if (hasRelic(w.upgrades, 'relic_ward')) {
      w.player.shieldOn = true
      w.player.shieldCd = 0
    }
  }
  if (e.kind === 'chest') return
  afterHit(w, e, clock, dmg, o)
}

function afterHit(
  w: World,
  e: Enemy,
  clock: AudioClockPort,
  hitDmg: number,
  o: HitOpts,
): void {
  const src = o.elem
  const g = w.loadout.graft
  if (src === 'flame' || g.knockback) applyKnockback(w, e)
  if (src === 'aura' || g.slow) applyAuraSlow(w, e)
  if ((src === 'orb' || g.split) && !o.skipSplit) splitFrom(w, e, clock, hitDmg)
  if (g.splash && !o.skipSplash) graftSplash(w, e, clock, hitDmg)
  if (g.cleave && !o.skipCleave) graftCleave(w, e, clock, hitDmg)
  if (g.bounce && !o.skipBounce) graftBounce(w, e, clock, hitDmg)
  if (!src || o.skipElem) return
  const proc = noteElemHit(w, e, src, hitDmg)
  if (proc?.explode) explodeAt(w, clock, proc.explode)
}

function enemyHasSpecialStatus(e: Enemy): boolean {
  return (
    e.breakT > 0 ||
    e.ampT > 0 ||
    e.freezeT > 0 ||
    e.weakT > 0 ||
    e.bleedT > 0 ||
    e.slowT > 0
  )
}

function splitFrom(w: World, origin: Enemy, clock: AudioClockPort, hitDmg: number): void {
  const n = w.loadout.splitN
  if (n <= 0) return
  const R = w.loadout.splitR
  const candidates: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e === origin || e.hp <= 0) continue
    const d = Math.hypot(e.x - origin.x, e.z - origin.z)
    if (d <= R + e.r) candidates.push({ e, d })
  }
  candidates.sort((a, b) => a.d - b.d)
  const picked = candidates.slice(0, n)
  for (let i = 0; i < picked.length; i++) {
    const t = picked[i]!.e
    const d = picked[i]!.d
    damageEnemy(w, t, hitDmg, clock, 0.35, 'orb', {
      elem: oElem(w),
      skipSplit: true,
      skipBounce: true,
      ctx: {
        role: 'split',
        targets: picked.length,
        dist: d,
        range: R,
        special: enemyHasSpecialStatus(t),
      },
    })
    w.fxPops.push({ x: t.x, z: t.z, kind: 'split', life: 0.2, maxLife: 0.2 })
    if (w.fxPops.length > 16) w.fxPops.splice(0, w.fxPops.length - 16)
  }
}

function oElem(w: World): ElemSource {
  return w.loadout.starterId === 'spirit_orb'
    ? 'orb'
    : w.loadout.starterId === 'thunder_chain'
      ? 'chain'
      : w.loadout.starterId === 'flame'
        ? 'flame'
        : w.loadout.starterId === 'ward_aura'
          ? 'aura'
          : w.loadout.starterId === 'starfall'
            ? 'star'
            : w.loadout.starterId === 'orbit'
              ? 'orbit'
              : 'orb'
}

function graftBounce(w: World, origin: Enemy, clock: AudioClockPort, hitDmg: number): void {
  let best: Enemy | null = null
  let bestD = 4.8
  for (const e of w.enemies) {
    if (e === origin || e.hp <= 0) continue
    const d = Math.hypot(e.x - origin.x, e.z - origin.z)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  if (!best) return
  // 嫁接雷链：画出连锁闪电线（火球×雷等）
  w.chains.push({
    ax: origin.x,
    az: origin.z,
    bx: best.x,
    bz: best.z,
    life: 0.34,
    maxLife: 0.34,
  })
  if (w.chains.length > 24) w.chains.splice(0, w.chains.length - 24)
  clock.beep('chain')
  damageEnemy(w, best, hitDmg * 0.85, clock, 0.2, 'chain', {
    elem: oElem(w),
    skipBounce: true,
    skipSplit: true,
    ctx: {
      role: 'graft',
      hop: 1,
      targets: 1,
      dist: bestD,
      range: 4.8,
      special: true,
    },
  })
}

function graftSplash(w: World, origin: Enemy, clock: AudioClockPort, hitDmg: number): void {
  const r = 1.55
  clock.beep('aura')
  w.craters.push({
    x: origin.x,
    z: origin.z,
    r,
    life: 0.32,
    maxLife: 0.32,
    damage: 0,
    tickCd: 99,
    style: 'earth',
  })
  if (w.craters.length > 20) w.craters.splice(0, w.craters.length - 20)
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e === origin || e.hp <= 0) continue
    const d = Math.hypot(e.x - origin.x, e.z - origin.z)
    if (d > r + e.r) continue
    hits.push({ e, d })
  }
  for (const { e, d } of hits) {
    damageEnemy(w, e, hitDmg * 0.75, clock, 0.1, 'star', {
      elem: oElem(w),
      skipSplash: true,
      skipSplit: true,
      skipBounce: true,
      ctx: {
        role: 'splash',
        targets: hits.length,
        dist: d,
        range: r,
        special: true,
      },
    })
  }
}

function graftCleave(w: World, origin: Enemy, clock: AudioClockPort, hitDmg: number): void {
  const r = 1.7
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e === origin || e.hp <= 0) continue
    const d = Math.hypot(e.x - origin.x, e.z - origin.z)
    if (d > r + e.r) continue
    hits.push({ e, d })
  }
  for (const { e, d } of hits) {
    damageEnemy(w, e, hitDmg * 0.7, clock, 0.08, 'orbit', {
      elem: oElem(w),
      skipCleave: true,
      skipSplit: true,
      skipBounce: true,
      ctx: {
        role: 'graft',
        targets: hits.length,
        dist: d,
        range: r,
        special: true,
      },
    })
    w.fxPops.push({ x: e.x, z: e.z, kind: 'split', life: 0.16, maxLife: 0.16 })
  }
  if (w.fxPops.length > 16) w.fxPops.splice(0, w.fxPops.length - 16)
}

function explodeAt(
  w: World,
  clock: AudioClockPort,
  blast: { x: number; z: number; r: number; dmg: number },
): void {
  clock.beep('aura')
  w.craters.push({
    x: blast.x,
    z: blast.z,
    r: blast.r,
    life: 0.28,
    maxLife: 0.28,
    damage: 0,
    tickCd: 99,
    style: 'fire',
  })
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - blast.x, e.z - blast.z)
    if (d > blast.r + e.r) continue
    hits.push({ e, d })
  }
  for (const { e, d } of hits) {
    damageEnemy(w, e, blast.dmg, clock, 0.12, 'orb', {
      elem: 'orb',
      skipSplit: true,
      ctx: {
        role: 'splash',
        targets: hits.length,
        dist: d,
        range: blast.r,
        special: true,
      },
    })
  }
}

const FLOATER_CAP = 56

function pushFloater(
  w: World,
  x: number,
  z: number,
  amount: number,
  kind: DamageKind,
  kill: boolean,
  crit: boolean,
): void {
  const life = kind === 'aura' || kind === 'flame' ? 0.46 : kind === 'fever' ? 0.82 : 0.7
  w.floaters.push({
    x,
    z,
    amount,
    kind,
    kill,
    crit,
    life,
    maxLife: life,
    drift: w.rng() * 2 - 1,
  })
  if (w.floaters.length > FLOATER_CAP) {
    w.floaters.splice(0, w.floaters.length - FLOATER_CAP)
  }
}

export function tickFloaters(w: World, dt: number): void {
  for (const f of w.floaters) f.life -= dt
  w.floaters = w.floaters.filter((f) => f.life > 0)
  for (const p of w.fxPops) p.life -= dt
  w.fxPops = w.fxPops.filter((p) => p.life > 0)
}

export { hurtPlayer } from './status'

export function firePlayerPattern(
  w: World,
  dirX: number,
  dirZ: number,
  count: number,
  spread: number,
  damage: number,
  speed?: number,
  clock?: AudioClockPort,
): void {
  const orb = w.loadout.orb
  if (!orb) return
  w.player.castSeq += 1
  const n = Math.max(1, count)
  const spd = speed ?? orb.speed
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread
    const c = Math.cos(t)
    const s = Math.sin(t)
    const dx = dirX * c - dirZ * s
    const dz = dirX * s + dirZ * c
    const d = norm(dx, dz)
    w.bullets.push({
      x: w.player.x,
      z: w.player.z,
      vx: d.x * spd,
      vz: d.z * spd,
      life: orb.life,
      damage,
      pierce: w.loadout.pierce,
      friendly: true,
      r: orb.radius,
      hit: new Set(),
    })
  }
  clock?.beep('orb')
}

export function spawnSlash(
  w: World,
  dirX: number,
  dirZ: number,
  radius: number,
  halfAngle: number,
  damage: number,
  life = w.loadout.meleeLife,
  clock?: AudioClockPort,
): void {
  const d = norm(dirX, dirZ)
  w.slashes.push({
    x: w.player.x,
    z: w.player.z,
    dirX: d.x,
    dirZ: d.z,
    radius,
    halfAngle,
    life,
    maxLife: life,
    damage,
    hit: new Set(),
  })
  clock?.beep('slash')
}

export function tickSlashes(w: World, dt: number, clock: AudioClockPort): void {
  for (const s of w.slashes) {
    s.life -= dt
    s.x = w.player.x
    s.z = w.player.z
    // damage <= 0：纯表现（风息锥），伤害走 flameConeHit
    if (s.damage <= 0) continue
    for (const e of w.enemies) {
      if (e.hp <= 0 || s.hit.has(e)) continue
      const dx = e.x - s.x
      const dz = e.z - s.z
      const dist = Math.hypot(dx, dz)
      if (dist > s.radius + e.r) continue
      const d = norm(dx, dz)
      const dot = d.x * s.dirX + d.z * s.dirZ
      const ang = Math.acos(clamp(dot, -1, 1))
      if (ang <= s.halfAngle) {
        s.hit.add(e)
        damageEnemy(w, e, s.damage, clock, 0.55, 'slash', {
          elem: 'flame',
          ctx: {
            role: 'primary',
            targets: 1,
            dist: dist,
            range: s.radius,
          },
        })
      }
    }
  }
  w.slashes = w.slashes.filter((s) => s.life > 0)
}

export function pulseAura(w: World, clock: AudioClockPort, radiusMul = 1, dmgMul = 1): void {
  const A = w.loadout.aura
  if (!A) return
  const r = A.radius * radiusMul
  w.auraPulseT = 0.34
  clock.beep('aura')
  const dmg = A.damage * w.stats.mult * dmgMul
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - w.player.x, e.z - w.player.z)
    if (d <= r + e.r) hits.push({ e, d })
  }
  const pulse = radiusMul > 1.01 || dmgMul > 1.01
  for (const { e, d } of hits) {
    damageEnemy(w, e, dmg, clock, 0.08, 'aura', {
      elem: 'aura',
      ctx: {
        role: pulse ? 'pulse' : 'primary',
        targets: hits.length,
        dist: d,
        range: r,
        special: enemyHasSpecialStatus(e) || w.loadout.graft.slow,
      },
    })
  }
}

export function tickAura(w: World, dt: number, clock: AudioClockPort): void {
  const A = w.loadout.aura
  w.auraPulseT = Math.max(0, w.auraPulseT - dt)
  if (!A) return
  w.player.auraCd -= dt
  if (w.player.auraCd > 0) return
  w.player.auraCd = A.tickInterval
  pulseAura(w, clock, 1, 1)
}

export function fireChain(w: World, clock: AudioClockPort, extraJumps = 0, power = 1): void {
  const C = w.loadout.chain
  if (!C) return
  clock.beep('chain')
  const hops = Math.max(1, C.jumps + extraJumps)
  const hit = new Set<Enemy>()
  let cx = w.player.x
  let cz = w.player.z
  let reach = C.range
  const dmg = C.damage * w.stats.mult * power
  const pulse = power > 1.01
  for (let i = 0; i < hops; i++) {
    let best: Enemy | null = null
    let bestD = reach
    for (const e of w.enemies) {
      if (e.hp <= 0 || hit.has(e)) continue
      const d = Math.hypot(e.x - cx, e.z - cz)
      if (d <= bestD + e.r) {
        best = e
        bestD = d
      }
    }
    if (!best) break
    w.chains.push({
      ax: cx,
      az: cz,
      bx: best.x,
      bz: best.z,
      life: 0.28,
      maxLife: 0.28,
    })
    damageEnemy(w, best, dmg, clock, 0.22, 'chain', {
      elem: 'chain',
      ctx: {
        role: i === 0 ? (pulse ? 'pulse' : 'primary') : 'chainJump',
        hop: i,
        targets: 1,
        dist: bestD,
        range: reach,
        special: enemyHasSpecialStatus(best) || w.loadout.graft.bounce,
      },
    })
    hit.add(best)
    cx = best.x
    cz = best.z
    reach = C.jumpRange
  }
}

export function tickChain(w: World, dt: number, clock: AudioClockPort): void {
  const C = w.loadout.chain
  if (!C) return
  w.player.chainCd -= dt
  if (w.player.chainCd > 0) return
  if (!nearestEnemy(w)) return
  w.player.chainCd = C.interval
  fireChain(w, clock, 0, 0.82)
}

export function tickChains(w: World, dt: number): void {
  for (const c of w.chains) c.life -= dt
  w.chains = w.chains.filter((c) => c.life > 0)
}

function flameConeHit(
  w: World,
  clock: AudioClockPort,
  dmg: number,
  role: 'primary' | 'pulse' = 'primary',
): void {
  const range = w.loadout.meleeRange
  const half = w.loadout.meleeHalfAngle
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    if (
      !inCone(
        w.player.x,
        w.player.z,
        w.player.facingX,
        w.player.facingZ,
        range,
        half,
        e.x,
        e.z,
        e.r,
      )
    ) {
      continue
    }
    hits.push({ e, d: Math.hypot(e.x - w.player.x, e.z - w.player.z) })
  }
  for (const { e, d } of hits) {
    damageEnemy(w, e, dmg, clock, 0.12, 'flame', {
      elem: 'flame',
      ctx: {
        role,
        targets: hits.length,
        dist: d,
        range,
        special: enemyHasSpecialStatus(e) || w.loadout.graft.knockback,
      },
    })
  }
}

/** 表现用短锥（damage=0）；结算仍走 flameConeHit，避免与 tickSlashes 双算。 */
function spawnFlameConeFx(w: World, life = w.loadout.meleeLife): void {
  spawnSlash(
    w,
    w.player.facingX,
    w.player.facingZ,
    w.loadout.meleeRange,
    w.loadout.meleeHalfAngle,
    0,
    life,
  )
}

export function tickFlame(w: World, dt: number, clock: AudioClockPort): void {
  w.player.tickCritLock = Math.max(0, w.player.tickCritLock - dt)
  w.flameBoostT = Math.max(0, w.flameBoostT - dt)
  if (!w.loadout.hasFlame) return
  w.player.meleeCd -= dt
  if (w.player.meleeCd > 0) return
  w.player.meleeCd = w.loadout.meleeInterval
  flameConeHit(w, clock, w.loadout.meleeDamage * w.stats.mult)
  spawnFlameConeFx(w)
}

/** Perfect：再喷一次，不改锥、不走旧挥砍。 */
export function pulseFlame(w: World, clock: AudioClockPort, power = 1): void {
  if (!w.loadout.hasFlame) return
  w.flameBoostT = 0.32
  w.player.castSeq += 1
  clock.beep('slash')
  flameConeHit(w, clock, w.loadout.meleeDamage * w.stats.mult * power, 'pulse')
  spawnFlameConeFx(w, w.loadout.meleeLife * 1.75)
}

export function dropStar(w: World, clock: AudioClockPort, power = 1): void {
  const S = w.loadout.star
  if (!S) return
  const target = nearestEnemy(w)
  let x = w.player.x + w.player.facingX * 2.4
  let z = w.player.z + w.player.facingZ * 2.4
  if (target) {
    x = target.x + (w.rng() - 0.5) * 1.4
    z = target.z + (w.rng() - 0.5) * 1.4
  } else {
    const ang = w.rng() * Math.PI * 2
    const rad = 1.2 + w.rng() * S.range * 0.45
    x = w.player.x + Math.cos(ang) * rad
    z = w.player.z + Math.sin(ang) * rad
  }
  const landR = 0.62
  const splashR = S.craterR
  const dmg = S.damage * w.stats.mult * power
  const crater: Crater = {
    x,
    z,
    r: splashR,
    life: S.craterLife,
    maxLife: S.craterLife,
    damage: 0,
    tickCd: 99,
    style: 'earth',
  }
  w.craters.push(crater)
  while (w.craters.length > S.maxCraters) w.craters.shift()
  clock.beep('aura')
  const landHits: { e: Enemy; d: number }[] = []
  const splashHits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - x, e.z - z)
    if (d <= landR + e.r) landHits.push({ e, d })
    if (d <= splashR + e.r) splashHits.push({ e, d })
  }
  const pulse = power > 1.01
  for (const { e, d } of landHits) {
    damageEnemy(w, e, dmg, clock, 0.16, 'star', {
      elem: 'star',
      ctx: {
        role: pulse ? 'pulse' : 'primary',
        targets: landHits.length,
        dist: d,
        range: landR,
        special: enemyHasSpecialStatus(e) || w.loadout.graft.splash,
      },
    })
  }
  for (const { e, d } of splashHits) {
    if (landHits.some((h) => h.e === e)) continue
    damageEnemy(w, e, dmg, clock, 0.1, 'star', {
      elem: 'star',
      ctx: {
        role: 'splash',
        targets: splashHits.length,
        dist: d,
        range: splashR,
        special: enemyHasSpecialStatus(e),
      },
    })
  }
}

export function fireStarCast(w: World, clock: AudioClockPort, power = 0.85): void {
  const S = w.loadout.star
  if (!S) return
  const n = Math.max(1, S.casts)
  for (let i = 0; i < n; i++) dropStar(w, clock, power)
}

export function tickStar(w: World, dt: number, clock: AudioClockPort): void {
  const S = w.loadout.star
  if (!S) return
  w.player.starCd -= dt
  if (w.player.starCd <= 0) {
    w.player.starCd = S.interval
    if (nearestEnemy(w)) fireStarCast(w, clock, 0.85)
  }
}

function orbitBladePos(w: World, i: number, n: number, radius: number): { x: number; z: number } {
  const ang = w.orbitAng + (i * Math.PI * 2) / n
  return {
    x: w.player.x + Math.cos(ang) * radius,
    z: w.player.z + Math.sin(ang) * radius,
  }
}

export function pulseOrbit(w: World, clock: AudioClockPort, power = 1): void {
  const O = w.loadout.orbit
  if (!O) return
  w.orbitPulseT = 0.32
  const r = O.radius * 1.35
  const dmg = O.damage * w.stats.mult * power * O.beatMul
  clock.beep('aura')
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - w.player.x, e.z - w.player.z)
    if (d <= r + e.r + O.bladeR) hits.push({ e, d })
  }
  for (const { e, d } of hits) {
    damageEnemy(w, e, dmg, clock, 0.1, 'orbit', {
      elem: 'orbit',
      ctx: {
        role: 'pulse',
        targets: hits.length,
        dist: d,
        range: r,
        special: enemyHasSpecialStatus(e) || w.loadout.graft.cleave,
      },
    })
    e.orbitHitT = O.hitCd
  }
}

export function tickOrbit(w: World, dt: number, clock: AudioClockPort): void {
  const O = w.loadout.orbit
  w.orbitPulseT = Math.max(0, w.orbitPulseT - dt)
  if (!O) return
  w.orbitAng += dt * O.spin
  const n = Math.max(1, O.blades)
  const radius = O.radius * (w.orbitPulseT > 0 ? 1.28 : 1)
  const dmg = O.damage * w.stats.mult * (w.orbitPulseT > 0 ? 1.15 : 1)
  const wave: Enemy[] = []
  for (let i = 0; i < n; i++) {
    const b = orbitBladePos(w, i, n, radius)
    for (const e of w.enemies) {
      if (e.hp <= 0 || e.orbitHitT > 0) continue
      if (Math.hypot(e.x - b.x, e.z - b.z) <= e.r + O.bladeR) {
        if (!wave.includes(e)) wave.push(e)
      }
    }
  }
  for (const e of wave) {
    const d = Math.hypot(e.x - w.player.x, e.z - w.player.z)
    damageEnemy(w, e, dmg, clock, 0.06, 'orbit', {
      elem: 'orbit',
      ctx: {
        role: w.orbitPulseT > 0 ? 'pulse' : 'primary',
        targets: wave.length,
        dist: d,
        range: radius,
        special: enemyHasSpecialStatus(e),
      },
    })
    e.orbitHitT = O.hitCd
  }
}

export function tickCraters(w: World, dt: number): void {
  for (const c of w.craters) c.life -= dt
  w.craters = w.craters.filter((c) => c.life > 0)
}

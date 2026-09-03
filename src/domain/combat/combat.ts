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
  noteOwnedElemHits,
} from './elemental'
import { weatherDamageMul } from './weather'
import { weaponHitMul, type WeaponHitCtx } from './weaponMods'
import type { GraftTrait } from '../../content/fusions'
import { makeOrbBulletMeta } from './bulletMeta'
import { makeFlameSlashMeta } from './slashMeta'
import {
  makeOrbBlastCraterMeta,
  makeStarCraterMeta,
} from './craterMeta'
import { makeChainBoltMeta, type ChainSource } from './chainMeta'

export type HitOpts = {
  canCrit?: boolean
  elem?: ElemSource
  skipElem?: boolean
  skipSplit?: boolean
  skipBounce?: boolean
  skipKnock?: boolean
  /** 武器情境修正：目标数 / 距离 / 主伤·分裂·弹跳 / 特效 */
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
    if (kind === 'flame' || kind === 'aura' || kind === 'slash') {
      p *= 0.5
      if (w.player.tickCritLock > 0) p = 0
    }
    if (w.rng() < p) {
      crit = true
      dmg *= w.loadout.critDamage
      if (kind === 'flame' || kind === 'aura' || kind === 'slash') {
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
  if (o.skipElem) return
  const proc = noteOwnedElemHits(w, e, hitDmg)
  if (proc?.explode) explodeAt(w, clock, proc.explode)
}

function enemyHasSpecialStatus(e: Enemy): boolean {
  return (
    e.breakT > 0 ||
    e.ampT > 0 ||
    e.freezeT > 0 ||
    e.weakT > 0 ||
    e.slowT > 0
  )
}

/** Extra hits (split / bounce / explode) must not re-enter on-hit grafts. */
function noChain(o: HitOpts): HitOpts {
  return { ...o, skipSplit: true, skipBounce: true, skipKnock: true }
}

function volleyN(w: World): number {
  return Math.max(1, w.loadout.casts)
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
            : 'orb'
}

function yawDir(x: number, z: number, yaw: number): { x: number; z: number } {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  return { x: x * c - z * s, z: x * s + z * c }
}

function livingInReach(w: World, reach: number): Enemy[] {
  const p = w.player
  return w.enemies.filter(
    (e) => e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) <= reach + e.r,
  )
}

/** 多发平行错开出手点，不偏开枪口。 */
function volleySlot(v: number, times: number): number {
  if (times <= 1) return 0
  return v - (times - 1) / 2
}

function pushPop(
  w: World,
  x: number,
  z: number,
  kind: 'split' | 'knock' | 'emerge' | 'volley',
  extra?: { dirX?: number; dirZ?: number },
): void {
  w.fxPops.push({
    x,
    z,
    kind,
    dirX: extra?.dirX,
    dirZ: extra?.dirZ,
    life: kind === 'volley' ? 0.24 : 0.2,
    maxLife: kind === 'volley' ? 0.24 : 0.2,
  })
  if (w.fxPops.length > 24) w.fxPops.splice(0, w.fxPops.length - 24)
}

function noteHit(into: Set<Enemy> | undefined, avoid: Set<Enemy> | undefined, e: Enemy): void {
  avoid?.add(e)
  into?.add(e)
}

function splitFromPos(
  w: World,
  ox: number,
  oz: number,
  skip: Enemy | null,
  clock: AudioClockPort,
  hitDmg: number,
  into?: Set<Enemy>,
  avoid?: Set<Enemy>,
): void {
  const n = w.loadout.splitN
  if (n <= 0) return
  const R = w.loadout.splitR
  const candidates: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e === skip || e.hp <= 0 || avoid?.has(e)) continue
    const d = Math.hypot(e.x - ox, e.z - oz)
    if (d <= R + e.r) candidates.push({ e, d })
  }
  candidates.sort((a, b) => a.d - b.d)
  const picked = candidates.slice(0, n)
  for (let i = 0; i < picked.length; i++) {
    const t = picked[i]!.e
    const d = picked[i]!.d
    damageEnemy(
      w,
      t,
      hitDmg,
      clock,
      0.35,
      'orb',
      noChain({
        elem: oElem(w),
        ctx: {
          role: 'split',
          targets: picked.length,
          dist: d,
          range: R,
          special: enemyHasSpecialStatus(t),
        },
      }),
    )
    noteHit(into, avoid, t)
    pushChainBolt(w, ox, oz, t.x, t.z, 1, 'split')
    pushPop(w, t.x, t.z, 'split')
  }
}

function pushChainBolt(
  w: World,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  hop: number,
  kind: ChainSource,
): void {
  const life = hop === 0 ? 0.4 : 0.5
  w.chains.push({
    ax,
    az,
    bx,
    bz,
    life,
    maxLife: life,
    hop,
    meta: makeChainBoltMeta(kind),
  })
  if (w.chains.length > 48) w.chains.splice(0, w.chains.length - 48)
}
function hopBounce(
  w: World,
  ax: number,
  az: number,
  reach: number,
  clock: AudioClockPort,
  hitDmg: number,
  hop: number,
  pulse: boolean,
  visited: Set<Enemy>,
): Enemy | null {
  let best: Enemy | null = null
  let bestD = reach
  for (const e of w.enemies) {
    if (e.hp <= 0 || visited.has(e)) continue
    const d = Math.hypot(e.x - ax, e.z - az)
    if (d <= bestD + e.r) {
      best = e
      bestD = d
    }
  }
  if (!best) return null
  pushChainBolt(
    w,
    ax,
    az,
    best.x,
    best.z,
    hop,
    hop === 0 && w.loadout.chain ? 'chain' : 'graft_bounce',
  )
  clock.beep('chain')
  damageEnemy(w, best, hitDmg * (w.loadout.chain && hop === 0 ? 1 : 0.85), clock, 0.2, 'chain', {
    elem: 'chain',
    ctx: {
      role: hop === 0 ? (pulse ? 'pulse' : 'primary') : hop === 1 ? 'graft' : 'chainJump',
      hop,
      targets: 1,
      dist: bestD,
      range: reach,
      special: enemyHasSpecialStatus(best) || w.loadout.effectOrder.includes('bounce'),
    },
  })
  visited.add(best)
  return best
}

function bounceReach(w: World, fromPlayer: boolean): number {
  const C = w.loadout.chain
  if (C) return fromPlayer ? C.range : Math.max(C.jumpRange, C.range)
  return Math.max(4.8 * w.loadout.castAreaMul, (w.loadout.star?.range ?? 0) * 0.75)
}

function bounceCount(w: World, extra = 0): number {
  if (w.loadout.chain) return Math.max(0, w.loadout.chain.jumps + extra)
  if (w.loadout.effectOrder.includes('bounce')) return Math.max(0, 1 + extra)
  return 0
}

/** 特效轮。有弹射+分裂时是二叉树：弹射一条边、分裂另一叉；次数用完那层挨打但不再当发起者。 */
export function runMagicWave(
  w: World,
  clock: AudioClockPort,
  seeds: Enemy[],
  opts: {
    dmg: number
    fromPlayer?: boolean
    originX?: number
    originZ?: number
    bounceExtra?: number
    pulse?: boolean
  },
): void {
  const order = w.loadout.effectOrder
  if (order.length === 0) return
  const counts = new Map<GraftTrait, number>()
  for (const t of order) {
    counts.set(t, t === 'bounce' ? bounceCount(w, opts.bounceExtra ?? 0) : 1)
  }
  let carriers = seeds.slice()
  const fromPlayer = !!opts.fromPlayer
  if (carriers.length === 0 && !fromPlayer) return

  const bouncedVisited = new Set<Enemy>(carriers)
  const ox = opts.originX ?? w.player.x
  const oz = opts.originZ ?? w.player.z
  const pulse = !!opts.pulse
  const bounceIn = order.includes('bounce')
  const bounceLeft = () => counts.get('bounce') ?? 0
  const moreRounds = () =>
    bounceIn ? bounceLeft() > 0 : [...counts.values()].some((n) => n > 0)

  for (let hop = 0; hop < 8; hop++) {
    if (!moreRounds()) break
    const canBounceFromPlayer = fromPlayer && hop === 0 && carriers.length === 0
    if (carriers.length === 0 && !canBounceFromPlayer) break

    const newly = new Set<Enemy>()
    const ran = new Set<GraftTrait>()
    const bouncedThisRound: Enemy[] = []
    const hosts = () => (carriers.length > 0 ? carriers : bouncedThisRound)

    for (const trait of order) {
      const left = counts.get(trait) ?? 0
      if (trait === 'split' && bounceIn) {
        if (bounceLeft() <= 0 || hosts().length === 0) continue
      } else if (left <= 0) continue
      if (trait === 'knockback') {
        const from = hosts()
        if (from.length === 0) continue
        for (const e of from) {
          if (e.hp > 0) applyKnockback(w, e)
        }
        ran.add(trait)
        continue
      }
      if (trait === 'slow') {
        const from = hosts()
        if (from.length === 0) continue
        for (const e of from) {
          if (e.hp > 0) applyAuraSlow(w, e)
        }
        ran.add(trait)
        continue
      }
      if (trait === 'split') {
        for (const e of hosts()) {
          splitFromPos(w, e.x, e.z, e, clock, opts.dmg, newly, bouncedVisited)
        }
        ran.add(trait)
        continue
      }
      if (trait === 'bounce') {
        const reach = bounceReach(w, canBounceFromPlayer)
        const from = canBounceFromPlayer
          ? [{ x: ox, z: oz }]
          : carriers.map((e) => ({ x: e.x, z: e.z }))
        if (from.length === 0) continue
        for (const s of from) {
          const hit = hopBounce(
            w,
            s.x,
            s.z,
            reach,
            clock,
            opts.dmg,
            canBounceFromPlayer ? hop : hop + 1,
            pulse,
            bouncedVisited,
          )
          if (hit) {
            newly.add(hit)
            bouncedThisRound.push(hit)
          }
        }
        ran.add(trait)
      }
    }

    for (const t of ran) {
      if (t === 'split' && bounceIn) continue
      const n = counts.get(t) ?? 0
      if (n > 0) counts.set(t, n - 1)
    }
    if (!moreRounds() || newly.size === 0) break
    carriers = [...newly]
  }
}

function explodeAt(
  w: World,
  clock: AudioClockPort,
  blast: { x: number; z: number; r: number; dmg: number },
): void {
  clock.beep('aura')
  const blastMeta = makeOrbBlastCraterMeta()
  w.craters.push({
    x: blast.x,
    z: blast.z,
    r: blast.r,
    life: 0.28,
    maxLife: 0.28,
    damage: 0,
    tickCd: 99,
    meta: blastMeta,
    style: blastMeta.style,
  })
  const hits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - blast.x, e.z - blast.z)
    if (d > blast.r + e.r) continue
    hits.push({ e, d })
  }
  for (const { e, d } of hits) {
    damageEnemy(
      w,
      e,
      blast.dmg,
      clock,
      0.12,
      'orb',
      noChain({
        elem: 'orb',
        ctx: {
          role: 'splash',
          targets: hits.length,
          dist: d,
          range: blast.r,
          special: true,
        },
      }),
    )
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
  const reach = orb.speed * orb.life
  const cands = livingInReach(w, reach)
  if (cands.length === 0) return
  w.player.castSeq += 1
  const n = Math.max(1, count)
  const times = volleyN(w)
  const spd = speed ?? orb.speed
  const extras = pickSpreadTargets(cands, times, w.player)
  for (let v = 0; v < times; v++) {
    let ax = dirX
    let az = dirZ
    const mark = extras[v] ?? extras[0]
    if (v > 0 && mark) {
      const aimed = norm(mark.x - w.player.x, mark.z - w.player.z)
      ax = aimed.x
      az = aimed.z
    }
    const d0 = norm(ax, az)
    const slot = volleySlot(v, times)
    const ox = w.player.x + -d0.z * slot * 0.32
    const oz = w.player.z + d0.x * slot * 0.32
    if (v > 0) pushPop(w, ox, oz, 'volley')
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread
      const aimed = t === 0 ? d0 : yawDir(d0.x, d0.z, t)
      const d = norm(aimed.x, aimed.z)
      const meta = makeOrbBulletMeta()
      w.bullets.push({
        x: ox,
        z: oz,
        vx: d.x * spd,
        vz: d.z * spd,
        life: orb.life,
        damage,
        pierce: w.loadout.pierce,
        friendly: true,
        r: orb.radius,
        meta,
        hit: new Set(),
      })
    }
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
    meta: makeFlameSlashMeta(),
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
  if (livingInReach(w, r).length === 0) return
  w.auraPulseT = 0.34
  clock.beep('aura')
  const dmg = A.damage * w.stats.mult * dmgMul
  const pulse = radiusMul > 1.01 || dmgMul > 1.01
  const times = volleyN(w)
  for (let v = 0; v < times; v++) {
    const hits: { e: Enemy; d: number }[] = []
    for (const e of w.enemies) {
      if (e.hp <= 0) continue
      const d = Math.hypot(e.x - w.player.x, e.z - w.player.z)
      if (d <= r + e.r) hits.push({ e, d })
    }
    for (const { e, d } of hits) {
      damageEnemy(w, e, dmg, clock, 0.08, 'aura', {
        elem: 'aura',
        ctx: {
          role: pulse ? 'pulse' : 'primary',
          targets: hits.length,
          dist: d,
          range: r,
          special: enemyHasSpecialStatus(e) || w.loadout.effectOrder.includes('slow'),
        },
      })
    }
    runMagicWave(w, clock, hits.map((h) => h.e), { dmg })
    if (v > 0) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + v * 0.4
        pushPop(w, w.player.x + Math.cos(a) * r, w.player.z + Math.sin(a) * r, 'volley')
      }
    }
  }
}

export function tickAura(w: World, dt: number, clock: AudioClockPort): void {
  const A = w.loadout.aura
  w.auraPulseT = Math.max(0, w.auraPulseT - dt)
  if (!A) return
  w.player.auraCd -= dt
  if (w.player.auraCd > 0) return
  if (livingInReach(w, A.radius).length === 0) return
  w.player.auraCd = A.tickInterval
  pulseAura(w, clock, 1, 1)
}

export function fireChain(w: World, clock: AudioClockPort, extraJumps = 0, power = 1): void {
  const C = w.loadout.chain
  if (!C) return
  const dmg = C.damage * w.stats.mult * power
  const pulse = power > 1.01
  const times = volleyN(w)
  const firstVisited = new Set<Enemy>()
  for (let v = 0; v < times; v++) {
    const first = hopBounce(
      w,
      w.player.x,
      w.player.z,
      C.range,
      clock,
      dmg,
      0,
      pulse,
      firstVisited,
    )
    if (!first) continue
    if (v > 0) pushPop(w, first.x, first.z, 'volley')
    runMagicWave(w, clock, [first], { dmg, bounceExtra: extraJumps, pulse })
  }
}

export function tickChain(w: World, dt: number, clock: AudioClockPort): void {
  const C = w.loadout.chain
  if (!C) return
  w.player.chainCd -= dt
  if (w.player.chainCd > 0) return
  if (livingInReach(w, C.range).length === 0) return
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
  dirX = w.player.facingX,
  dirZ = w.player.facingZ,
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
        dirX,
        dirZ,
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
        special: enemyHasSpecialStatus(e) || w.loadout.effectOrder.includes('knockback'),
      },
    })
  }
  runMagicWave(w, clock, hits.map((h) => h.e), { dmg })
}

/** 表现用短锥（damage=0）；结算仍走 flameConeHit，避免与 tickSlashes 双算。 */
function spawnFlameConeFx(
  w: World,
  life = w.loadout.meleeLife,
  dirX = w.player.facingX,
  dirZ = w.player.facingZ,
): void {
  spawnSlash(w, dirX, dirZ, w.loadout.meleeRange, w.loadout.meleeHalfAngle, 0, life)
}

function flameVolleyDirs(w: World, times: number): { x: number; z: number }[] {
  const picked = pickSpreadTargets(livingInReach(w, w.loadout.meleeRange), times, w.player)
  if (picked.length === 0) return []
  const dirs: { x: number; z: number }[] = []
  for (let v = 0; v < times; v++) {
    const e = picked[v] ?? picked[0]!
    dirs.push(norm(e.x - w.player.x, e.z - w.player.z))
  }
  return dirs
}

export function tickFlame(w: World, dt: number, clock: AudioClockPort): void {
  w.player.tickCritLock = Math.max(0, w.player.tickCritLock - dt)
  w.flameBoostT = Math.max(0, w.flameBoostT - dt)
  if (!w.loadout.hasFlame) return
  w.player.meleeCd -= dt
  if (w.player.meleeCd > 0) return
  const times = volleyN(w)
  const dirs = flameVolleyDirs(w, times)
  if (dirs.length === 0) return
  w.player.meleeCd = w.loadout.meleeInterval
  const dmg = w.loadout.meleeDamage * w.stats.mult
  for (let v = 0; v < dirs.length; v++) {
    const d = dirs[v]!
    flameConeHit(w, clock, dmg, 'primary', d.x, d.z)
    spawnFlameConeFx(w, w.loadout.meleeLife, d.x, d.z)
    if (v > 0) {
      pushPop(
        w,
        w.player.x + d.x * w.loadout.meleeRange,
        w.player.z + d.z * w.loadout.meleeRange,
        'volley',
      )
    }
  }
}

/** Perfect：再喷一次，不改锥、不走旧挥砍。 */
export function pulseFlame(w: World, clock: AudioClockPort, power = 1): void {
  if (!w.loadout.hasFlame) return
  const times = volleyN(w)
  const dirs = flameVolleyDirs(w, times)
  if (dirs.length === 0) return
  w.flameBoostT = 0.32
  w.player.castSeq += 1
  clock.beep('slash')
  const dmg = w.loadout.meleeDamage * w.stats.mult * power
  for (let v = 0; v < dirs.length; v++) {
    const d = dirs[v]!
    flameConeHit(w, clock, dmg, 'pulse', d.x, d.z)
    spawnFlameConeFx(w, w.loadout.meleeLife * 1.75, d.x, d.z)
    if (v > 0) {
      pushPop(
        w,
        w.player.x + d.x * w.loadout.meleeRange,
        w.player.z + d.z * w.loadout.meleeRange,
        'volley',
      )
    }
  }
}

export function dropStar(w: World, clock: AudioClockPort, power = 1): void {
  fireStarCast(w, clock, power)
}

function livingByDist(w: World): Enemy[] {
  const maxR = w.loadout.star?.range ?? Infinity
  const p = w.player
  return livingInReach(w, maxR).sort(
    (a, b) =>
      Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
  )
}

/** 多发落点：第一下近，之后贪心挑离已选点最远的人。 */
function pickSpreadTargets(
  cands: Enemy[],
  n: number,
  from: { x: number; z: number },
): Enemy[] {
  if (n <= 0 || cands.length === 0) return []
  const remaining = cands.slice()
  const picked: Enemy[] = []
  const distTo = (e: Enemy, p: { x: number; z: number }) =>
    Math.hypot(e.x - p.x, e.z - p.z)
  let seedI = 0
  let seedScore = Infinity
  for (let i = 0; i < remaining.length; i++) {
    const d = distTo(remaining[i]!, from)
    if (d < seedScore) {
      seedScore = d
      seedI = i
    }
  }
  picked.push(remaining.splice(seedI, 1)[0]!)
  while (picked.length < n && remaining.length > 0) {
    let bestI = 0
    let bestMin = -1
    for (let i = 0; i < remaining.length; i++) {
      const e = remaining[i]!
      let minD = Infinity
      for (const p of picked) minD = Math.min(minD, distTo(e, p))
      if (minD > bestMin) {
        bestMin = minD
        bestI = i
      }
    }
    picked.push(remaining.splice(bestI, 1)[0]!)
  }
  return picked
}

function dropStarAt(
  w: World,
  clock: AudioClockPort,
  power: number,
  x: number,
  z: number,
): void {
  const S = w.loadout.star
  if (!S) return
  const landR = S.craterR
  const dmg = S.damage * w.stats.mult * power
  const starMeta = makeStarCraterMeta()
  const crater: Crater = {
    x,
    z,
    r: landR,
    life: S.craterLife,
    maxLife: S.craterLife,
    damage: 0,
    tickCd: 99,
    meta: starMeta,
    style: starMeta.style,
  }
  w.craters.push(crater)
  while (w.craters.length > S.maxCraters) w.craters.shift()
  clock.beep('aura')
  const landHits: { e: Enemy; d: number }[] = []
  for (const e of w.enemies) {
    if (e.hp <= 0) continue
    const d = Math.hypot(e.x - x, e.z - z)
    if (d <= landR + e.r) landHits.push({ e, d })
  }
  const pulse = power > 1.01
  const seeds: Enemy[] = []
  for (const { e, d } of landHits) {
    damageEnemy(w, e, dmg, clock, 0.16, 'star', {
      elem: 'star',
      ctx: {
        role: pulse ? 'pulse' : 'primary',
        targets: landHits.length,
        dist: d,
        range: landR,
        special: enemyHasSpecialStatus(e),
      },
    })
    seeds.push(e)
  }
  runMagicWave(w, clock, seeds, { dmg, pulse })
}

export function fireStarCast(w: World, clock: AudioClockPort, power = 0.85): void {
  const S = w.loadout.star
  if (!S) return
  const n = volleyN(w)
  const unique = pickSpreadTargets(livingByDist(w), n, w.player)
  if (unique.length === 0) return
  w.player.castSeq += 1
  for (let i = 0; i < n; i++) {
    const t = unique[i % unique.length]!
    dropStarAt(w, clock, power, t.x, t.z)
  }
}

export function tickStar(w: World, dt: number, clock: AudioClockPort): void {
  const S = w.loadout.star
  if (!S) return
  w.player.starCd -= dt
  if (w.player.starCd > 0) return
  if (livingByDist(w).length === 0) return
  w.player.starCd = S.interval
  fireStarCast(w, clock, 0.85)
}

export function tickCraters(w: World, dt: number): void {
  for (const c of w.craters) c.life -= dt
  w.craters = w.craters.filter((c) => c.life > 0)
}

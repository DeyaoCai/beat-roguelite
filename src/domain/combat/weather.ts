import {
  weatherById,
  type DmgTag,
  type WeatherId,
} from '../../content/weather'
import type { AudioClockPort } from '../shared/ports'
import { mulberry32 } from './math'
import { moveWithObstacles } from './map'
import type { DamageKind, Enemy, EnemyKind, TerrainPatch, World } from './types'

export type GroundFlags = {
  mud: boolean
  ice: boolean
  wind: boolean
  flame: boolean
  tide: boolean
}

const TAG_OF: Partial<Record<DamageKind, DmgTag>> = {
  flame: 'wind',
  slash: 'wind',
  orb: 'fire',
  aura: 'ice',
  chain: 'thunder',
  star: 'earth',
  orbit: 'metal',
}

const WIND_SPD = 2.35
const ICE_ACC = 16
const ICE_FRICTION = 0.22
const BURN_DPS = 0.42

/** Floor tiles. Arena ~84 across → ~20 cells. */
const TERRAIN_CELL = 4
const BLOB_CELLS_MIN = 10
const BLOB_CELLS_MAX = 20
const SPAWN_CLEAR_R = 4.6
const BLOB_PLACE_TRIES = 28

type GridCell = { c: number; r: number }

function gridKey(c: number, r: number, n: number): number {
  return r * n + c
}

function cellWorld(
  c: number,
  r: number,
  cell: number,
  origin: number,
): { x: number; z: number } {
  return {
    x: origin + (c + 0.5) * cell,
    z: origin + (r + 0.5) * cell,
  }
}

function inSpawnClear(c: number, r: number, cell: number, origin: number): boolean {
  const p = cellWorld(c, r, cell, origin)
  return Math.hypot(p.x, p.z) < SPAWN_CLEAR_R
}

function orthoNeighbors(c: number, r: number, n: number): GridCell[] {
  const out: GridCell[] = []
  if (c > 0) out.push({ c: c - 1, r })
  if (c + 1 < n) out.push({ c: c + 1, r })
  if (r > 0) out.push({ c, r: r - 1 })
  if (r + 1 < n) out.push({ c, r: r + 1 })
  return out
}

function spansTwoByTwo(cells: GridCell[]): boolean {
  let minC = Infinity
  let maxC = -Infinity
  let minR = Infinity
  let maxR = -Infinity
  for (const cell of cells) {
    if (cell.c < minC) minC = cell.c
    if (cell.c > maxC) maxC = cell.c
    if (cell.r < minR) minR = cell.r
    if (cell.r > maxR) maxR = cell.r
  }
  return maxC - minC >= 1 && maxR - minR >= 1
}

function pickFreeIndex(
  rng: () => number,
  n: number,
  occupied: Uint8Array,
  cell: number,
  origin: number,
): number | null {
  const free: number[] = []
  for (let i = 0; i < occupied.length; i++) {
    if (occupied[i]) continue
    const c = i % n
    const r = (i / n) | 0
    if (inSpawnClear(c, r, cell, origin)) continue
    free.push(i)
  }
  if (!free.length) return null
  return free[(rng() * free.length) | 0]!
}

function trySeedL(
  rng: () => number,
  n: number,
  occupied: Uint8Array,
  cell: number,
  origin: number,
  start: GridCell,
): GridCell[] | null {
  const open = (c: number, r: number) => {
    if (c < 0 || r < 0 || c >= n || r >= n) return false
    if (occupied[gridKey(c, r, n)]) return false
    if (inSpawnClear(c, r, cell, origin)) return false
    return true
  }
  const cols = orthoNeighbors(start.c, start.r, n).filter((nb) => nb.r === start.r && open(nb.c, nb.r))
  const rows = orthoNeighbors(start.c, start.r, n).filter((nb) => nb.c === start.c && open(nb.c, nb.r))
  if (!cols.length || !rows.length) return null
  const across = cols[(rng() * cols.length) | 0]!
  const down = rows[(rng() * rows.length) | 0]!
  return [start, across, down]
}

/** 4-connected blob, 10–20 cells, bbox at least 2×2. */
function growBlob(
  rng: () => number,
  n: number,
  occupied: Uint8Array,
  cell: number,
  origin: number,
  want: number,
): GridCell[] | null {
  const startI = pickFreeIndex(rng, n, occupied, cell, origin)
  if (startI === null) return null
  const start: GridCell = { c: startI % n, r: (startI / n) | 0 }
  const seed = trySeedL(rng, n, occupied, cell, origin, start)
  if (!seed) return null

  const taken = new Set<number>()
  const cells: GridCell[] = []
  const mark = (g: GridCell) => {
    cells.push(g)
    taken.add(gridKey(g.c, g.r, n))
  }
  for (const g of seed) mark(g)

  const frontier: GridCell[] = []
  const onFrontier = new Set<number>()
  const pushFrontier = (g: GridCell) => {
    const k = gridKey(g.c, g.r, n)
    if (taken.has(k) || onFrontier.has(k)) return
    if (occupied[k]) return
    if (inSpawnClear(g.c, g.r, cell, origin)) return
    onFrontier.add(k)
    frontier.push(g)
  }
  for (const g of cells) {
    for (const nb of orthoNeighbors(g.c, g.r, n)) pushFrontier(nb)
  }

  while (cells.length < want && frontier.length) {
    const i = (rng() * frontier.length) | 0
    const next = frontier[i]!
    frontier[i] = frontier[frontier.length - 1]!
    frontier.pop()
    onFrontier.delete(gridKey(next.c, next.r, n))
    if (taken.has(gridKey(next.c, next.r, n)) || occupied[gridKey(next.c, next.r, n)]) continue
    mark(next)
    for (const nb of orthoNeighbors(next.c, next.r, n)) pushFrontier(nb)
  }

  if (cells.length < BLOB_CELLS_MIN || !spansTwoByTwo(cells)) return null
  return cells
}

export function pickWeather(seed: number, wave: number): WeatherId {
  const rng = mulberry32((seed + wave * 7919 + 13) >>> 0)
  const ids: WeatherId[] = [
    'clear',
    'heat',
    'rain',
    'gale',
    'frost',
    'dust',
    'magnet',
  ]
  return ids[Math.floor(rng() * ids.length)] ?? 'clear'
}

export function weatherDamageMul(id: WeatherId, kind: DamageKind): number {
  const tag = TAG_OF[kind]
  if (!tag) return 1
  return weatherById(id).tagMul[tag] ?? 1
}

export function generateField(
  seed: number,
  wave: number,
  arenaHalf: number,
): { weatherId: WeatherId; windX: number; windZ: number; terrain: TerrainPatch[] } {
  const weatherId = pickWeather(seed, wave)
  const rng = mulberry32((seed + wave * 7919 + 97) >>> 0)
  const ang = rng() * Math.PI * 2
  const def = weatherById(weatherId)
  const cell = TERRAIN_CELL
  const n = Math.max(8, Math.floor((2 * arenaHalf - 2) / cell))
  const origin = -(n * cell) / 2
  const occupied = new Uint8Array(n * n)
  const terrain: TerrainPatch[] = []
  const tile = cell * 1.04
  for (const spec of def.terrains) {
    for (let i = 0; i < spec.count; i++) {
      const want =
        BLOB_CELLS_MIN + ((rng() * (BLOB_CELLS_MAX - BLOB_CELLS_MIN + 1)) | 0)
      let blob: GridCell[] | null = null
      for (let attempt = 0; attempt < BLOB_PLACE_TRIES && !blob; attempt++) {
        blob = growBlob(rng, n, occupied, cell, origin, want)
      }
      if (!blob) continue
      for (const g of blob) {
        occupied[gridKey(g.c, g.r, n)] = 1
        const p = cellWorld(g.c, g.r, cell, origin)
        terrain.push({ x: p.x, z: p.z, w: tile, d: tile, kind: spec.kind })
      }
    }
  }
  return {
    weatherId,
    windX: Math.cos(ang),
    windZ: Math.sin(ang),
    terrain,
  }
}

export function sampleGround(w: World, x: number, z: number): GroundFlags {
  const g: GroundFlags = { mud: false, ice: false, wind: false, flame: false, tide: false }
  for (const t of w.terrain) {
    if (Math.abs(x - t.x) * 2 >= t.w || Math.abs(z - t.z) * 2 >= t.d) continue
    g[t.kind] = true
  }
  return g
}

export function groundMoveMul(w: World, x: number, z: number): number {
  const g = sampleGround(w, x, z)
  let m = weatherById(w.weatherId).moveMul
  if (g.mud) m *= 0.7
  if (g.tide) m *= 0.78
  return m
}

export function dashDistMul(w: World): number {
  return sampleGround(w, w.player.x, w.player.z).tide ? 0.7 : 1
}

function forceResist(kind: EnemyKind): number {
  if (kind === 'boss') return 0.28
  if (kind === 'elite') return 0.45
  return 1
}

export function groundForce(
  w: World,
  x: number,
  z: number,
  who: 'player' | EnemyKind,
): { dx: number; dz: number } {
  const g = sampleGround(w, x, z)
  if (!g.wind) return { dx: 0, dz: 0 }
  const resist = who === 'player' ? 1 : forceResist(who)
  return { dx: w.windX * WIND_SPD * resist, dz: w.windZ * WIND_SPD * resist }
}

export function tickPlayerIce(
  w: World,
  dt: number,
  inputX: number,
  inputZ: number,
): void {
  const onIce = sampleGround(w, w.player.x, w.player.z).ice
  if (onIce) {
    w.player.iceVx += inputX * ICE_ACC * dt
    w.player.iceVz += inputZ * ICE_ACC * dt
    const max = w.player.speed * 1.85
    const sp = Math.hypot(w.player.iceVx, w.player.iceVz)
    if (sp > max) {
      w.player.iceVx = (w.player.iceVx / sp) * max
      w.player.iceVz = (w.player.iceVz / sp) * max
    }
    const keep = Math.pow(ICE_FRICTION, dt)
    w.player.iceVx *= keep
    w.player.iceVz *= keep
  } else {
    const keep = Math.pow(0.04, dt)
    w.player.iceVx *= keep
    w.player.iceVz *= keep
    if (Math.hypot(w.player.iceVx, w.player.iceVz) < 0.05) {
      w.player.iceVx = 0
      w.player.iceVz = 0
    }
  }
}

export function applyGroundDisplacement(
  w: World,
  x: number,
  z: number,
  r: number,
  dt: number,
  extraX: number,
  extraZ: number,
): { x: number; z: number } {
  const lim = w.arena.half - r
  const force = groundForce(w, x, z, 'player')
  return moveWithObstacles(
    x,
    z,
    (extraX + force.dx) * dt,
    (extraZ + force.dz) * dt,
    r,
    w.obstacles,
    lim,
  )
}

export function displaceEnemyGround(w: World, e: Enemy, dt: number): void {
  if (e.freezeT > 0) return
  const g = sampleGround(w, e.x, e.z)
  const force = groundForce(w, e.x, e.z, e.kind)
  let dx = force.dx
  let dz = force.dz
  if (g.ice) {
    const slip = 1.1 * forceResist(e.kind)
    dx += w.player.x - e.x > 0 ? slip : -slip
    dz += w.player.z - e.z > 0 ? slip : -slip
  }
  if (dx === 0 && dz === 0) return
  const lim = w.arena.half - e.r
  const next = moveWithObstacles(e.x, e.z, dx * dt, dz * dt, e.r, w.obstacles, lim)
  e.x = next.x
  e.z = next.z
}

export function tickGroundBurn(w: World, dt: number, clock: AudioClockPort): void {
  if (w.dead) return
  const on = sampleGround(w, w.player.x, w.player.z).flame
  if (!on) {
    w.player.burnAcc = Math.max(0, w.player.burnAcc - dt)
    return
  }
  w.player.burnAcc += BURN_DPS * dt
  while (w.player.burnAcc >= 1 && !w.dead) {
    w.player.burnAcc -= 1
    w.player.hp -= 1
    w.player.hurtFlash = Math.max(w.player.hurtFlash, 0.22)
    clock.beep('hurt')
    if (w.player.hp <= 0) {
      w.dead = true
      clock.beep('death')
    }
  }
}

export function heatDecayMul(id: WeatherId): number {
  return weatherById(id).heatDecayMul
}

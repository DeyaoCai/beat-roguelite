import { aabbOverlap, clamp, entityBox, type Aabb } from './math'

export type Obstacle = {
  x: number
  z: number
  /** Full width on X. */
  w: number
  /** Full depth on Z. */
  d: number
  /** Visual height only (render). */
  h: number
  kind: 'block' | 'pillar'
}

export function obstacleBox(o: Obstacle): Aabb {
  return { x: o.x, z: o.z, w: o.w, h: o.d }
}

export function hitsObstacle(x: number, z: number, r: number, obstacles: Obstacle[]): boolean {
  const box = entityBox(x, z, r)
  for (const o of obstacles) {
    if (aabbOverlap(box, obstacleBox(o))) return true
  }
  return false
}

/** Axis-separated move; slides along walls. Returns new position. */
export function moveWithObstacles(
  x: number,
  z: number,
  dx: number,
  dz: number,
  r: number,
  obstacles: Obstacle[],
  lim: number,
): { x: number; z: number } {
  let nx = clamp(x + dx, -lim, lim)
  let nz = z
  if (hitsObstacle(nx, nz, r, obstacles)) nx = x

  nz = clamp(z + dz, -lim, lim)
  if (hitsObstacle(nx, nz, r, obstacles)) nz = z

  // Corner catch: if still overlapping (rare), stay put.
  if (hitsObstacle(nx, nz, r, obstacles)) return { x, z }
  return { x: nx, z: nz }
}

/**
 * Procedural props for a wave. Keeps a clear disk around origin for the player.
 */
export function generateMap(
  rng: () => number,
  arenaHalf: number,
  wave: number,
): Obstacle[] {
  const out: Obstacle[] = []
  const clearR = 5.2
  const count = 16 + wave * 6 + Math.floor(rng() * 6)

  for (let i = 0; i < count; i++) {
    const pillar = rng() < 0.45
    const w = pillar ? 1.1 + rng() * 0.6 : 2.2 + rng() * 2.8
    const d = pillar ? 1.1 + rng() * 0.6 : 1.4 + rng() * 2.2
    const h = pillar ? 2.2 + rng() * 2.5 : 1.0 + rng() * 1.2

    let placed = false
    for (let attempt = 0; attempt < 36 && !placed; attempt++) {
      const x = (rng() * 2 - 1) * (arenaHalf - w * 0.5 - 1.2)
      const z = (rng() * 2 - 1) * (arenaHalf - d * 0.5 - 1.2)
      if (Math.hypot(x, z) < clearR + Math.max(w, d) * 0.5) continue

      const cand: Obstacle = { x, z, w, d, h, kind: pillar ? 'pillar' : 'block' }
      const box = obstacleBox(cand)
      let overlap = false
      for (const o of out) {
        // Slight padding between props.
        const pad = 0.8
        if (
          aabbOverlap(box, {
            x: o.x,
            z: o.z,
            w: o.w + pad,
            h: o.d + pad,
          })
        ) {
          overlap = true
          break
        }
      }
      if (overlap) continue
      out.push(cand)
      placed = true
    }
  }

  // Occasional ring of corner blocks on later waves.
  if (wave >= 2 && rng() < 0.7) {
    const s = arenaHalf * 0.55
    const bw = 3.5 + rng()
    const bd = 1.6 + rng() * 0.6
    for (const [sx, sz, rot] of [
      [s, s, false],
      [-s, s, true],
      [s, -s, true],
      [-s, -s, false],
    ] as const) {
      if (rng() < 0.55) {
        out.push({
          x: sx,
          z: sz,
          w: rot ? bd : bw,
          d: rot ? bw : bd,
          h: 1.4,
          kind: 'block',
        })
      }
    }
  }

  return out
}

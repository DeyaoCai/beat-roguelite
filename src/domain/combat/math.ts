export type Vec2 = { x: number; z: number }

export type Aabb = {
  x: number
  z: number
  w: number
  h: number
}

export function aabbOverlap(a: Aabb, b: Aabb): boolean {
  return (
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.z - b.z) * 2 < a.h + b.h
  )
}

export function entityBox(x: number, z: number, r: number): Aabb {
  const s = r * 2
  return { x, z, w: s, h: s }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function len(x: number, z: number): number {
  return Math.hypot(x, z)
}

export function norm(x: number, z: number): Vec2 {
  const l = len(x, z) || 1
  return { x: x / l, z: z / l }
}

/** Point-in-horizontal cone (XZ). `halfAngle` radians. */
export function inCone(
  ox: number,
  oz: number,
  dirX: number,
  dirZ: number,
  range: number,
  halfAngle: number,
  px: number,
  pz: number,
  pr = 0,
): boolean {
  const dx = px - ox
  const dz = pz - oz
  if (len(dx, dz) > range + pr) return false
  const facing = norm(dirX, dirZ)
  const d = norm(dx, dz)
  const ang = Math.acos(clamp(d.x * facing.x + d.z * facing.z, -1, 1))
  return ang <= halfAngle
}

export function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

import * as THREE from 'three'

export type PickupVisualKind = 'gold' | 'xp' | 'relic_minor' | 'relic_major'

function solid(
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    roughness: opts?.roughness ?? 0.4,
    metalness: opts?.metalness ?? 0.2,
  })
}

function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  m.rotation.set(rx, ry, rz)
  m.castShadow = true
  parent.add(m)
  return m
}

/** Stack of coins — unit ~1 tall, origin at center. */
function buildGold(): THREE.Group {
  const g = new THREE.Group()
  const coin = solid(0xfde047, {
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.55,
  })
  const rim = solid(0xfbbf24, { metalness: 0.6, roughness: 0.3 })
  part(g, new THREE.CylinderGeometry(0.45, 0.45, 0.1, 16), coin, 0, -0.12, 0)
  part(g, new THREE.CylinderGeometry(0.42, 0.42, 0.1, 16), coin, 0.06, 0, 0.04)
  part(g, new THREE.CylinderGeometry(0.38, 0.38, 0.1, 16), rim, -0.05, 0.12, -0.03)
  return g
}

/** XP gem — cyan shard. */
function buildXp(): THREE.Group {
  const g = new THREE.Group()
  const gem = solid(0x67e8f9, {
    emissive: 0x06b6d4,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.25,
  })
  const tip = solid(0xecfeff, {
    emissive: 0xa5f3fc,
    emissiveIntensity: 0.4,
    roughness: 0.22,
  })
  part(g, new THREE.OctahedronGeometry(0.36, 0), gem, 0, 0, 0)
  part(g, new THREE.OctahedronGeometry(0.14, 0), tip, 0, 0.34, 0)
  return g
}

/** Small violet relic shard. */
function buildRelicMinor(): THREE.Group {
  const g = new THREE.Group()
  const gem = solid(0xa78bfa, {
    emissive: 0x7c3aed,
    emissiveIntensity: 0.55,
    roughness: 0.28,
    metalness: 0.35,
  })
  const tip = solid(0xddd6fe, {
    emissive: 0xc4b5fd,
    emissiveIntensity: 0.5,
    roughness: 0.25,
  })
  part(g, new THREE.OctahedronGeometry(0.42, 0), gem, 0, 0, 0)
  part(g, new THREE.OctahedronGeometry(0.18, 0), tip, 0, 0.38, 0)
  return g
}

/** Major relic — floating pink crystal cluster. */
function buildRelicMajor(): THREE.Group {
  const g = new THREE.Group()
  const core = solid(0xf472b6, {
    emissive: 0xdb2777,
    emissiveIntensity: 0.65,
    roughness: 0.25,
    metalness: 0.3,
  })
  const shard = solid(0xfbcfe8, {
    emissive: 0xf9a8d4,
    emissiveIntensity: 0.45,
    roughness: 0.28,
  })
  part(g, new THREE.OctahedronGeometry(0.4, 0), core, 0, 0.05, 0)
  part(g, new THREE.OctahedronGeometry(0.22, 0), shard, 0.32, 0.2, 0.1)
  part(g, new THREE.OctahedronGeometry(0.2, 0), shard, -0.28, 0.15, -0.12)
  part(g, new THREE.OctahedronGeometry(0.16, 0), shard, 0.05, 0.42, -0.08)
  part(g, new THREE.TorusGeometry(0.48, 0.04, 6, 18), shard, 0, 0, 0, 1, 1, 1, Math.PI / 2, 0, 0)
  return g
}

const BUILDERS: Record<PickupVisualKind, () => THREE.Group> = {
  gold: buildGold,
  xp: buildXp,
  relic_minor: buildRelicMinor,
  relic_major: buildRelicMajor,
}

export type PickupModelSlot = {
  root: THREE.Group
  variants: Record<PickupVisualKind, THREE.Object3D>
  kind: PickupVisualKind | null
}

export function createPickupModelSlot(): PickupModelSlot {
  const root = new THREE.Group()
  root.visible = false
  const variants = {} as Record<PickupVisualKind, THREE.Object3D>
  for (const k of ['gold', 'xp', 'relic_minor', 'relic_major'] as PickupVisualKind[]) {
    const v = BUILDERS[k]()
    v.visible = false
    variants[k] = v
    root.add(v)
  }
  return { root, variants, kind: null }
}

export function setPickupModelKind(slot: PickupModelSlot, kind: PickupVisualKind): void {
  if (slot.kind === kind) return
  if (slot.kind) slot.variants[slot.kind].visible = false
  slot.variants[kind].visible = true
  slot.kind = kind
}

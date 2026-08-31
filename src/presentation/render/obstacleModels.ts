import * as THREE from 'three'

export type ObstacleVisualKind = 'block' | 'pillar'

function solid(
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    roughness: opts?.roughness ?? 0.75,
    metalness: opts?.metalness ?? 0.1,
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
  m.receiveShadow = true
  parent.add(m)
  return m
}

/**
 * Unit crate / rubble pile in a 1×1×1 box (origin at center).
 * Outer silhouette stays close to the collision AABB.
 */
function buildBlock(): THREE.Group {
  const g = new THREE.Group()
  const stone = solid(0x2a3f5c, { roughness: 0.88, metalness: 0.06 })
  const edge = solid(0x1e2d42, { roughness: 0.7, metalness: 0.15 })
  const moss = solid(0x3d5a4a, { roughness: 0.9 })

  part(g, new THREE.BoxGeometry(0.92, 0.72, 0.88), stone, 0, -0.05, 0)
  part(g, new THREE.BoxGeometry(0.7, 0.35, 0.65), stone, 0.08, 0.28, -0.05)
  part(g, new THREE.BoxGeometry(0.4, 0.22, 0.38), edge, -0.22, 0.38, 0.15)
  part(g, new THREE.BoxGeometry(1.02, 0.08, 1.0), edge, 0, -0.46, 0)
  part(g, new THREE.BoxGeometry(0.35, 0.12, 0.5), moss, 0.25, 0.42, 0.1, 1, 1, 1, 0.1, 0.3, 0)
  return g
}

/** Unit column / ruined pillar — tall silhouette inside 1×1×1. */
function buildPillar(): THREE.Group {
  const g = new THREE.Group()
  const shaft = solid(0x3d5a7a, { roughness: 0.68, metalness: 0.14 })
  const band = solid(0x5b7a9a, { roughness: 0.45, metalness: 0.28 })
  const base = solid(0x243448, { roughness: 0.8 })
  const crack = solid(0x1a2533, { roughness: 0.85 })

  part(g, new THREE.CylinderGeometry(0.42, 0.48, 0.18, 8), base, 0, -0.41, 0)
  part(g, new THREE.CylinderGeometry(0.32, 0.36, 0.72, 8), shaft, 0, 0.02, 0)
  part(g, new THREE.CylinderGeometry(0.38, 0.38, 0.1, 8), band, 0, -0.12, 0)
  part(g, new THREE.CylinderGeometry(0.36, 0.36, 0.08, 8), band, 0, 0.28, 0)
  part(g, new THREE.CylinderGeometry(0.4, 0.34, 0.16, 8), base, 0, 0.42, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.55, 0.08), crack, 0.28, 0.05, 0.05, 1, 1, 1, 0, 0, 0.15)
  return g
}

const BUILDERS: Record<ObstacleVisualKind, () => THREE.Group> = {
  block: buildBlock,
  pillar: buildPillar,
}

export type ObstacleModelSlot = {
  root: THREE.Group
  variants: Record<ObstacleVisualKind, THREE.Object3D>
  kind: ObstacleVisualKind | null
}

export function createObstacleModelSlot(): ObstacleModelSlot {
  const root = new THREE.Group()
  root.visible = false
  const variants = {} as Record<ObstacleVisualKind, THREE.Object3D>
  for (const k of ['block', 'pillar'] as ObstacleVisualKind[]) {
    const v = BUILDERS[k]()
    v.visible = false
    variants[k] = v
    root.add(v)
  }
  return { root, variants, kind: null }
}

export function setObstacleModelKind(slot: ObstacleModelSlot, kind: ObstacleVisualKind): void {
  if (slot.kind === kind) return
  if (slot.kind) slot.variants[slot.kind].visible = false
  slot.variants[kind].visible = true
  slot.kind = kind
}

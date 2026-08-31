import * as THREE from 'three'

function solid(
  color: number,
  opts?: { emissive?: number; emissiveIntensity?: number; roughness?: number; metalness?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
    roughness: opts?.roughness ?? 0.55,
    metalness: opts?.metalness ?? 0.12,
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
  m.userData.homeMat = mat
  parent.add(m)
  return m
}

/** Lean orange runner — wedge torso + blade arms. */
function buildChaser(): THREE.Group {
  const g = new THREE.Group()
  const body = solid(0xf97316, { roughness: 0.5 })
  const dark = solid(0x9a3412, { roughness: 0.65 })
  const eye = solid(0xfff7ed, { emissive: 0xfdba74, emissiveIntensity: 0.7, roughness: 0.3 })

  part(g, new THREE.CapsuleGeometry(0.28, 0.45, 4, 8), body, 0, 0.55, 0, 1, 1, 0.85)
  part(g, new THREE.ConeGeometry(0.32, 0.42, 5), body, 0, 1.05, 0.05, 1, 1, 1, Math.PI, 0, 0)
  part(g, new THREE.BoxGeometry(0.55, 0.12, 0.18), dark, 0.38, 0.62, 0.05, 1, 1, 1, 0, 0, 0.45)
  part(g, new THREE.BoxGeometry(0.55, 0.12, 0.18), dark, -0.38, 0.62, 0.05, 1, 1, 1, 0, 0, -0.45)
  part(g, new THREE.SphereGeometry(0.07, 8, 8), eye, 0.12, 0.98, 0.22)
  part(g, new THREE.SphereGeometry(0.07, 8, 8), eye, -0.12, 0.98, 0.22)
  part(g, new THREE.CylinderGeometry(0.08, 0.1, 0.28, 6), dark, 0.14, 0.14, 0)
  part(g, new THREE.CylinderGeometry(0.08, 0.1, 0.28, 6), dark, -0.14, 0.14, 0)
  return g
}

/** Purple floating caster — core + halo + cannon. */
function buildShooter(): THREE.Group {
  const g = new THREE.Group()
  const core = solid(0xc084fc, { emissive: 0x7c3aed, emissiveIntensity: 0.35, roughness: 0.35 })
  const rim = solid(0x5b21b6, { metalness: 0.35, roughness: 0.4 })
  const tip = solid(0xf5d0fe, { emissive: 0xe879f9, emissiveIntensity: 0.8, roughness: 0.25 })

  part(g, new THREE.IcosahedronGeometry(0.38, 0), core, 0, 0.55, 0)
  part(g, new THREE.TorusGeometry(0.48, 0.06, 6, 16), rim, 0, 0.55, 0, 1, 1, 1, Math.PI / 2, 0, 0)
  part(g, new THREE.ConeGeometry(0.14, 0.5, 6), tip, 0, 0.55, 0.55, 1, 1, 1, Math.PI / 2, 0, 0)
  part(g, new THREE.SphereGeometry(0.1, 8, 8), tip, 0, 0.9, 0)
  return g
}

/** Wide crimson tank — blocky shoulders. */
function buildBrute(): THREE.Group {
  const g = new THREE.Group()
  const body = solid(0x9f1239, { emissive: 0x4c0519, emissiveIntensity: 0.25, roughness: 0.55 })
  const plate = solid(0x450a1a, { metalness: 0.3, roughness: 0.45 })
  const eye = solid(0xfda4af, { emissive: 0xfb7185, emissiveIntensity: 0.55, roughness: 0.35 })

  part(g, new THREE.BoxGeometry(0.85, 0.7, 0.55), body, 0, 0.5, 0)
  part(g, new THREE.BoxGeometry(0.45, 0.35, 0.4), body, 0, 0.95, 0.05)
  part(g, new THREE.BoxGeometry(0.4, 0.35, 0.35), plate, 0.55, 0.75, 0)
  part(g, new THREE.BoxGeometry(0.4, 0.35, 0.35), plate, -0.55, 0.75, 0)
  part(g, new THREE.BoxGeometry(0.22, 0.55, 0.22), plate, 0.28, 0.28, 0.05)
  part(g, new THREE.BoxGeometry(0.22, 0.55, 0.22), plate, -0.28, 0.28, 0.05)
  part(g, new THREE.SphereGeometry(0.08, 8, 8), eye, 0.12, 1.0, 0.22)
  part(g, new THREE.SphereGeometry(0.08, 8, 8), eye, -0.12, 1.0, 0.22)
  return g
}

/** Gold elite — horned carapace + side fins. */
function buildElite(): THREE.Group {
  const g = new THREE.Group()
  const shell = solid(0xfbbf24, { emissive: 0xb45309, emissiveIntensity: 0.4, roughness: 0.4, metalness: 0.35 })
  const dark = solid(0x78350f, { metalness: 0.25, roughness: 0.5 })
  const core = solid(0xfef3c7, { emissive: 0xf59e0b, emissiveIntensity: 0.75, roughness: 0.3 })

  part(g, new THREE.SphereGeometry(0.42, 10, 10), shell, 0, 0.55, 0, 1.1, 0.95, 1)
  part(g, new THREE.ConeGeometry(0.12, 0.45, 5), shell, 0.18, 1.15, 0, 1, 1, 1, 0.35, 0, 0.2)
  part(g, new THREE.ConeGeometry(0.12, 0.45, 5), shell, -0.18, 1.15, 0, 1, 1, 1, 0.35, 0, -0.2)
  part(g, new THREE.ConeGeometry(0.16, 0.55, 5), shell, 0, 1.25, -0.05, 1, 1, 1, 0.15, 0, 0)
  part(g, new THREE.BoxGeometry(0.15, 0.35, 0.7), dark, 0.55, 0.55, 0, 1, 1, 1, 0, 0, 0.5)
  part(g, new THREE.BoxGeometry(0.15, 0.35, 0.7), dark, -0.55, 0.55, 0, 1, 1, 1, 0, 0, -0.5)
  part(g, new THREE.SphereGeometry(0.14, 8, 8), core, 0, 0.55, 0.35)
  return g
}

/** Boss — multi-horn demon with shoulder plates + gut glow (tyrant default). */
function buildBossTyrant(): THREE.Group {
  const g = new THREE.Group()
  const flesh = solid(0xef4444, { emissive: 0x7f1d1d, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.2 })
  const plate = solid(0x450a0a, { metalness: 0.4, roughness: 0.35 })
  const glow = solid(0xfca5a5, { emissive: 0xf43f5e, emissiveIntensity: 0.9, roughness: 0.25 })
  const horn = solid(0x1c1917, { metalness: 0.5, roughness: 0.35 })

  part(g, new THREE.CapsuleGeometry(0.55, 0.55, 4, 10), flesh, 0, 0.75, 0, 1.15, 1, 0.95)
  part(g, new THREE.SphereGeometry(0.38, 10, 10), flesh, 0, 1.45, 0.05)
  part(g, new THREE.ConeGeometry(0.14, 0.7, 5), horn, 0.28, 1.95, -0.05, 1, 1, 1, 0.4, 0, 0.25)
  part(g, new THREE.ConeGeometry(0.14, 0.7, 5), horn, -0.28, 1.95, -0.05, 1, 1, 1, 0.4, 0, -0.25)
  part(g, new THREE.ConeGeometry(0.18, 0.85, 5), horn, 0, 2.1, -0.1, 1, 1, 1, 0.2, 0, 0)
  part(g, new THREE.BoxGeometry(0.55, 0.35, 0.4), plate, 0.75, 1.05, 0)
  part(g, new THREE.BoxGeometry(0.55, 0.35, 0.4), plate, -0.75, 1.05, 0)
  part(g, new THREE.SphereGeometry(0.22, 10, 10), glow, 0, 0.7, 0.4)
  part(g, new THREE.SphereGeometry(0.09, 8, 8), glow, 0.14, 1.5, 0.32)
  part(g, new THREE.SphereGeometry(0.09, 8, 8), glow, -0.14, 1.5, 0.32)
  part(g, new THREE.CylinderGeometry(0.12, 0.16, 0.4, 6), plate, 0.22, 0.2, 0.05)
  part(g, new THREE.CylinderGeometry(0.12, 0.16, 0.4, 6), plate, -0.22, 0.2, 0.05)
  return g
}

/** Warden — metronome tower with pulse ring. */
function buildBossWarden(): THREE.Group {
  const g = new THREE.Group()
  const body = solid(0x38bdf8, { emissive: 0x0369a1, emissiveIntensity: 0.4, roughness: 0.4 })
  const band = solid(0xe0f2fe, { emissive: 0x7dd3fc, emissiveIntensity: 0.55, roughness: 0.3 })
  const dark = solid(0x0c4a6e, { metalness: 0.35, roughness: 0.45 })
  part(g, new THREE.CylinderGeometry(0.42, 0.5, 1.1, 10), body, 0, 0.55, 0)
  part(g, new THREE.TorusGeometry(0.55, 0.07, 6, 20), band, 0, 0.7, 0, 1, 1, 1, Math.PI / 2, 0, 0)
  part(g, new THREE.BoxGeometry(0.7, 0.14, 0.14), dark, 0, 1.15, 0)
  part(g, new THREE.SphereGeometry(0.16, 8, 8), band, 0, 1.35, 0)
  return g
}

/** Caller — horned herald with pack banners. */
function buildBossCaller(): THREE.Group {
  const g = new THREE.Group()
  const hide = solid(0x84cc16, { emissive: 0x3f6212, emissiveIntensity: 0.35, roughness: 0.5 })
  const bone = solid(0xfef9c3, { roughness: 0.45 })
  const eye = solid(0xfacc15, { emissive: 0xeab308, emissiveIntensity: 0.7, roughness: 0.3 })
  part(g, new THREE.CapsuleGeometry(0.4, 0.5, 4, 8), hide, 0, 0.65, 0)
  part(g, new THREE.ConeGeometry(0.18, 0.55, 5), bone, 0.35, 1.25, 0, 1, 1, 1, 0.5, 0, 0.4)
  part(g, new THREE.ConeGeometry(0.18, 0.55, 5), bone, -0.35, 1.25, 0, 1, 1, 1, 0.5, 0, -0.4)
  part(g, new THREE.BoxGeometry(0.12, 0.7, 0.35), hide, 0.55, 0.8, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.7, 0.35), hide, -0.55, 0.8, 0)
  part(g, new THREE.SphereGeometry(0.1, 8, 8), eye, 0.14, 0.95, 0.28)
  part(g, new THREE.SphereGeometry(0.1, 8, 8), eye, -0.14, 0.95, 0.28)
  return g
}

/** Hex — floating crystal mage. */
function buildBossHex(): THREE.Group {
  const g = new THREE.Group()
  const core = solid(0xa78bfa, { emissive: 0x6d28d9, emissiveIntensity: 0.55, roughness: 0.3 })
  const shard = solid(0xddd6fe, { emissive: 0xc4b5fd, emissiveIntensity: 0.45, roughness: 0.25, metalness: 0.35 })
  part(g, new THREE.OctahedronGeometry(0.48, 0), core, 0, 0.75, 0)
  part(g, new THREE.OctahedronGeometry(0.22, 0), shard, 0.55, 0.9, 0.1)
  part(g, new THREE.OctahedronGeometry(0.22, 0), shard, -0.55, 0.9, -0.1)
  part(g, new THREE.OctahedronGeometry(0.18, 0), shard, 0.1, 1.25, -0.35)
  part(g, new THREE.TorusGeometry(0.62, 0.05, 6, 18), shard, 0, 0.55, 0, 1, 1, 1, Math.PI / 2, 0, 0)
  return g
}

/** Choir — armored bell / iron singer. */
function buildBossChoir(): THREE.Group {
  const g = new THREE.Group()
  const iron = solid(0x94a3b8, { metalness: 0.55, roughness: 0.35, emissive: 0x334155, emissiveIntensity: 0.2 })
  const glow = solid(0xf87171, { emissive: 0xdc2626, emissiveIntensity: 0.65, roughness: 0.3 })
  part(g, new THREE.CylinderGeometry(0.55, 0.65, 0.35, 10), iron, 0, 0.25, 0)
  part(g, new THREE.SphereGeometry(0.55, 12, 10), iron, 0, 0.85, 0, 1, 0.85, 1)
  part(g, new THREE.CylinderGeometry(0.2, 0.35, 0.35, 8), iron, 0, 1.35, 0)
  part(g, new THREE.SphereGeometry(0.18, 8, 8), glow, 0, 0.75, 0.45)
  part(g, new THREE.BoxGeometry(0.9, 0.2, 0.25), iron, 0, 0.55, -0.35)
  return g
}

/** Spitter — venom sac + twin nozzles. */
function buildSpitter(): THREE.Group {
  const g = new THREE.Group()
  const body = solid(0x4ade80, { emissive: 0x166534, emissiveIntensity: 0.35, roughness: 0.45 })
  const sac = solid(0xa3e635, { emissive: 0x65a30d, emissiveIntensity: 0.55, roughness: 0.35 })
  const dark = solid(0x14532d, { roughness: 0.6 })
  part(g, new THREE.SphereGeometry(0.36, 10, 10), body, 0, 0.45, 0, 1.1, 0.9, 1)
  part(g, new THREE.SphereGeometry(0.22, 8, 8), sac, 0, 0.72, 0.2)
  part(g, new THREE.ConeGeometry(0.1, 0.28, 6), dark, 0.18, 0.55, 0.35, 1, 1, 1, Math.PI / 2, 0, 0)
  part(g, new THREE.ConeGeometry(0.1, 0.28, 6), dark, -0.18, 0.55, 0.35, 1, 1, 1, Math.PI / 2, 0, 0)
  return g
}

/** Frost — icy crystal walker. */
function buildFrost(): THREE.Group {
  const g = new THREE.Group()
  const ice = solid(0x7dd3fc, { emissive: 0x0284c7, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.25 })
  const core = solid(0xe0f2fe, { emissive: 0x38bdf8, emissiveIntensity: 0.65, roughness: 0.25 })
  part(g, new THREE.OctahedronGeometry(0.4, 0), ice, 0, 0.55, 0)
  part(g, new THREE.OctahedronGeometry(0.18, 0), core, 0, 0.95, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.4, 0.12), ice, 0.32, 0.35, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.4, 0.12), ice, -0.32, 0.35, 0)
  return g
}

/** Leech — toothy crawler. */
function buildLeech(): THREE.Group {
  const g = new THREE.Group()
  const flesh = solid(0xbe123c, { emissive: 0x881337, emissiveIntensity: 0.35, roughness: 0.5 })
  const maw = solid(0xfda4af, { emissive: 0xfb7185, emissiveIntensity: 0.45, roughness: 0.35 })
  const dark = solid(0x4c0519, { roughness: 0.65 })
  part(g, new THREE.CapsuleGeometry(0.28, 0.55, 4, 8), flesh, 0, 0.45, 0, 1, 1, 1.15)
  part(g, new THREE.SphereGeometry(0.26, 8, 8), maw, 0, 0.55, 0.35)
  part(g, new THREE.ConeGeometry(0.08, 0.2, 4), dark, 0.12, 0.55, 0.52, 1, 1, 1, Math.PI / 2, 0, 0)
  part(g, new THREE.ConeGeometry(0.08, 0.2, 4), dark, -0.12, 0.55, 0.52, 1, 1, 1, Math.PI / 2, 0, 0)
  return g
}

/** Wooden chest — breakable loot. */
function buildChest(): THREE.Group {
  const g = new THREE.Group()
  const wood = solid(0xb45309, { roughness: 0.7, metalness: 0.08 })
  const dark = solid(0x78350f, { roughness: 0.75 })
  const metal = solid(0xfbbf24, { emissive: 0xf59e0b, emissiveIntensity: 0.35, metalness: 0.55, roughness: 0.35 })
  part(g, new THREE.BoxGeometry(0.9, 0.55, 0.65), wood, 0, 0.35, 0)
  part(g, new THREE.BoxGeometry(0.95, 0.22, 0.7), dark, 0, 0.68, 0)
  part(g, new THREE.BoxGeometry(0.12, 0.5, 0.7), metal, 0, 0.4, 0)
  part(g, new THREE.BoxGeometry(0.22, 0.14, 0.12), metal, 0, 0.42, 0.36)
  part(g, new THREE.SphereGeometry(0.08, 8, 8), metal, 0, 0.72, 0)
  return g
}

export type EnemyVisualKind =
  | 'chaser'
  | 'shooter'
  | 'brute'
  | 'spitter'
  | 'frost'
  | 'leech'
  | 'elite'
  | 'chest'
  | 'warden'
  | 'caller'
  | 'hex'
  | 'choir'
  | 'tyrant'

const KINDS: EnemyVisualKind[] = [
  'chaser',
  'shooter',
  'brute',
  'spitter',
  'frost',
  'leech',
  'elite',
  'chest',
  'warden',
  'caller',
  'hex',
  'choir',
  'tyrant',
]

const BUILDERS: Record<EnemyVisualKind, () => THREE.Group> = {
  chaser: buildChaser,
  shooter: buildShooter,
  brute: buildBrute,
  spitter: buildSpitter,
  frost: buildFrost,
  leech: buildLeech,
  elite: buildElite,
  chest: buildChest,
  warden: buildBossWarden,
  caller: buildBossCaller,
  hex: buildBossHex,
  choir: buildBossChoir,
  tyrant: buildBossTyrant,
}

const BOSS_VISUALS = new Set<string>(['warden', 'caller', 'hex', 'choir', 'tyrant'])

export function resolveEnemyVisualKind(kind: string, bossId?: string | null): EnemyVisualKind {
  if (kind === 'boss') {
    if (bossId && BOSS_VISUALS.has(bossId)) return bossId as EnemyVisualKind
    return 'tyrant'
  }
  if (
    kind === 'chaser' ||
    kind === 'shooter' ||
    kind === 'brute' ||
    kind === 'spitter' ||
    kind === 'frost' ||
    kind === 'leech' ||
    kind === 'elite' ||
    kind === 'chest'
  ) {
    return kind
  }
  return 'chaser'
}

/** One pooled slot: all kind variants, show the active one. Feet at y=0, ~1–2 units tall. */
export type EnemyModelSlot = {
  root: THREE.Group
  variants: Record<EnemyVisualKind, THREE.Object3D>
  kind: EnemyVisualKind | null
  flashing: boolean
}

export function createEnemyModelSlot(): EnemyModelSlot {
  const root = new THREE.Group()
  root.visible = false
  const variants = {} as Record<EnemyVisualKind, THREE.Object3D>
  for (const k of KINDS) {
    const v = BUILDERS[k]()
    v.visible = false
    // Normalize roughly to ~1.1 unit tall so radius scaling stays familiar.
    const box = new THREE.Box3().setFromObject(v)
    const size = new THREE.Vector3()
    box.getSize(size)
    const targetH =
      k === 'tyrant' || k === 'choir'
        ? 1.55
        : k === 'warden' || k === 'caller' || k === 'hex'
          ? 1.45
          : k === 'brute'
            ? 1.15
            : 1.1
    const s = size.y > 1e-4 ? targetH / size.y : 1
    v.scale.setScalar(s)
    v.position.y = -box.min.y * s
    variants[k] = v
    root.add(v)
  }
  return { root, variants, kind: null, flashing: false }
}

export function setEnemyModelKind(slot: EnemyModelSlot, kind: EnemyVisualKind): void {
  if (slot.kind === kind) return
  if (slot.kind) slot.variants[slot.kind].visible = false
  slot.variants[kind].visible = true
  slot.kind = kind
  slot.flashing = false
}

export function setEnemyModelFlash(
  slot: EnemyModelSlot,
  flash: boolean,
  flashMat: THREE.Material,
): void {
  if (!slot.kind || slot.flashing === flash) return
  slot.flashing = flash
  const v = slot.variants[slot.kind]
  v.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (flash) {
      if (!o.userData.homeMat) o.userData.homeMat = o.material
      o.material = flashMat
    } else if (o.userData.homeMat) {
      o.material = o.userData.homeMat as THREE.Material
    }
  })
}

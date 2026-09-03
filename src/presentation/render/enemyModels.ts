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
  m.castShadow = false
  m.receiveShadow = false
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

export type EnemyElemTint = 'flame' | 'orb' | 'aura' | 'chain' | 'star'

export type EnemyFxState = {
  boss: boolean
  bossId?: string
  slowed: boolean
  frozen: boolean
  amped: boolean
  broken: boolean
  weak: boolean
  elem: EnemyElemTint | null
  stacks: number
}

const ELEM_COLOR: Record<EnemyElemTint, number> = {
  flame: 0xfb923c,
  orb: 0xf97316,
  aura: 0x38bdf8,
  chain: 0xfacc15,
  star: 0xa8a29e,
}

const BOSS_AURA: Record<string, number> = {
  warden: 0x22d3ee,
  caller: 0xc084fc,
  hex: 0xa78bfa,
  choir: 0xfbbf24,
  tyrant: 0xf43f5e,
}

const statusRingGeo = new THREE.RingGeometry(0.38, 0.54, 28)
const bossRingGeo = new THREE.RingGeometry(0.78, 1.18, 48)
const bossFillGeo = new THREE.CircleGeometry(0.86, 32)
const moteGeo = new THREE.SphereGeometry(0.065, 7, 7)

function glowMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

type EnemyFxKit = {
  root: THREE.Group
  statusRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  statusMotes: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[]
  bossRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  bossFill: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
}

function createEnemyFxKit(): EnemyFxKit {
  const root = new THREE.Group()
  root.name = 'enemyFx'
  const statusRing = new THREE.Mesh(statusRingGeo, glowMat(0x38bdf8, 0.55))
  statusRing.rotation.x = -Math.PI / 2
  statusRing.position.y = 0.05
  statusRing.renderOrder = 2
  root.add(statusRing)
  const statusMotes: EnemyFxKit['statusMotes'] = []
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(moteGeo, glowMat(0x38bdf8, 0.9))
    m.renderOrder = 3
    statusMotes.push(m)
    root.add(m)
  }
  const bossFill = new THREE.Mesh(bossFillGeo, glowMat(0xf43f5e, 0.18))
  bossFill.rotation.x = -Math.PI / 2
  bossFill.position.y = 0.02
  bossFill.renderOrder = 1
  root.add(bossFill)
  const bossRing = new THREE.Mesh(bossRingGeo, glowMat(0xf43f5e, 0.7))
  bossRing.rotation.x = -Math.PI / 2
  bossRing.position.y = 0.035
  bossRing.renderOrder = 2
  root.add(bossRing)
  return { root, statusRing, statusMotes, bossRing, bossFill }
}

function statusTint(st: EnemyFxState): EnemyElemTint | null {
  if (st.frozen) return 'aura'
  if (st.amped) return 'chain'
  if (st.broken) return 'flame'
  if (st.weak) return 'star'
  if (st.slowed) return 'aura'
  return st.elem
}

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

/** One pooled slot: lazily clone the active kind. Feet at y=0, ~1–2 units tall. */
export type EnemyModelSlot = {
  root: THREE.Group
  variants: Partial<Record<EnemyVisualKind, THREE.Group>>
  kind: EnemyVisualKind | null
  flashing: boolean
  flashKey: string
  fx: EnemyFxKit
}

const _fitBox = new THREE.Box3()
const _fitSize = new THREE.Vector3()

function kindCastsShadow(k: EnemyVisualKind): boolean {
  return k === 'elite' || BOSS_VISUALS.has(k)
}

function fitKindRoot(v: THREE.Group, k: EnemyVisualKind): void {
  _fitBox.setFromObject(v)
  _fitBox.getSize(_fitSize)
  const targetH =
    k === 'tyrant' || k === 'choir'
      ? 1.55
      : k === 'warden' || k === 'caller' || k === 'hex'
        ? 1.45
        : k === 'brute'
          ? 1.15
          : 1.1
  const s = _fitSize.y > 1e-4 ? targetH / _fitSize.y : 1
  v.scale.setScalar(s)
  v.position.y = -_fitBox.min.y * s
  const shadow = kindCastsShadow(k)
  v.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.castShadow = shadow
    o.receiveShadow = false
    o.userData.homeMat = o.material
  })
}

export function createEnemyModelSlot(): EnemyModelSlot {
  const root = new THREE.Group()
  root.visible = false
  const fx = createEnemyFxKit()
  root.add(fx.root)
  return { root, variants: {}, kind: null, flashing: false, flashKey: '', fx }
}

function variantHasRealMats(v: THREE.Object3D): boolean {
  let ok = true
  v.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (!(o.material instanceof THREE.Material)) ok = false
    const home = o.userData.homeMat
    if (home != null && !(home instanceof THREE.Material)) ok = false
  })
  return ok
}

export function setEnemyModelKind(slot: EnemyModelSlot, kind: EnemyVisualKind): void {
  if (slot.kind === kind) {
    const cur = slot.kind ? slot.variants[slot.kind] : undefined
    if (cur && variantHasRealMats(cur)) return
  }
  if (slot.kind) {
    const prev = slot.variants[slot.kind]
    if (prev) {
      if (slot.flashKey) {
        prev.traverse((o) => {
          if (!(o instanceof THREE.Mesh)) return
          const home = o.userData.homeMat
          if (home instanceof THREE.Material) o.material = home
        })
      }
      prev.visible = false
    }
  }
  slot.flashing = false
  slot.flashKey = ''
  let v = slot.variants[kind]
  if (v && !variantHasRealMats(v)) {
    slot.root.remove(v)
    delete slot.variants[kind]
    v = undefined
  }
  if (!v) {
    v = BUILDERS[kind]()
    fitKindRoot(v, kind)
    slot.variants[kind] = v
    slot.root.add(v)
  }
  v.visible = true
  slot.kind = kind
}

export function setEnemyModelFlash(
  slot: EnemyModelSlot,
  flash: boolean,
  flashMat: THREE.Material,
): void {
  const key = flash ? flashMat.uuid : ''
  if (!slot.kind || slot.flashKey === key) return
  slot.flashKey = key
  slot.flashing = flash
  const v = slot.variants[slot.kind]
  if (!v) return
  v.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (flash) {
      const home = o.userData.homeMat
      if (!(home instanceof THREE.Material)) o.userData.homeMat = o.material
      o.material = flashMat
    } else {
      const home = o.userData.homeMat
      if (home instanceof THREE.Material) o.material = home
    }
  })
}

/** 叠层 1 起的异常光点 + Boss 脚下光环。chest 不画。 */
export function syncEnemyFx(slot: EnemyModelSlot, st: EnemyFxState, t: number): void {
  const fx = slot.fx
  const chest = slot.kind === 'chest'
  const proc = st.frozen || st.amped || st.broken || st.weak
  const building = (st.stacks ?? 0) > 0 && !!st.elem
  const statusOn = !chest && (st.slowed || proc || building)
  const bossOn = !chest && st.boss
  fx.root.visible = statusOn || bossOn

  fx.bossRing.visible = bossOn
  fx.bossFill.visible = bossOn
  if (bossOn) {
    const col = BOSS_AURA[st.bossId ?? ''] ?? BOSS_AURA.tyrant
    fx.bossRing.material.color.setHex(col)
    fx.bossFill.material.color.setHex(col)
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.6)
    fx.bossRing.material.opacity = 0.42 + 0.38 * pulse
    fx.bossFill.material.opacity = 0.1 + 0.12 * pulse
    const s = 1 + 0.07 * pulse
    fx.bossRing.scale.set(s, 1, s)
    fx.bossFill.scale.set(s, 1, s)
  }

  const tint = statusTint(st)
  fx.statusRing.visible = statusOn && !!tint
  if (!statusOn || !tint) {
    for (const m of fx.statusMotes) m.visible = false
    return
  }
  const col = ELEM_COLOR[tint]
  fx.statusRing.material.color.setHex(col)
  fx.statusRing.material.opacity = proc ? 0.82 : st.slowed ? 0.68 : 0.32 + 0.16 * st.stacks
  const n = proc ? 4 : st.slowed && !building ? 2 : Math.max(1, Math.min(4, st.stacks))
  const spin = proc ? 3.4 : 2.15
  const rad = 0.4 + (proc ? 0.14 : 0.05 * Math.max(1, st.stacks))
  for (let i = 0; i < fx.statusMotes.length; i++) {
    const m = fx.statusMotes[i]!
    if (i >= n) {
      m.visible = false
      continue
    }
    m.visible = true
    m.material.color.setHex(col)
    m.material.opacity = proc ? 0.95 : 0.72
    const a = t * spin + (i / n) * Math.PI * 2
    m.position.set(Math.cos(a) * rad, 0.38 + 0.2 * (i / n) + 0.07 * Math.sin(t * 4.2 + i), Math.sin(a) * rad)
  }
}

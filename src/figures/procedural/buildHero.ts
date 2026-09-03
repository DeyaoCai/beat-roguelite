import * as THREE from 'three'
import { SKYRIM_FEMALE_ID } from '../pack'
import { HERO_KITS, type HeroKit, type HeroKitId } from './kits'

export type ProceduralVariant = 'full' | 'bust'

function solid(
  color: number,
  opts?: { metalness?: number; roughness?: number; emissive?: number; emissiveIntensity?: number },
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts?.metalness ?? 0.15,
    roughness: opts?.roughness ?? 0.55,
    emissive: opts?.emissive ?? 0x000000,
    emissiveIntensity: opts?.emissiveIntensity ?? 0,
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

function emptyPivot(name: string): THREE.Group {
  const g = new THREE.Group()
  g.name = name
  return g
}

export type ProceduralRig = {
  root: THREE.Group
  /** Bob / breathe. */
  torso: THREE.Object3D
  head: THREE.Object3D
  leftThigh: THREE.Object3D
  rightThigh: THREE.Object3D
  leftShin: THREE.Object3D
  rightShin: THREE.Object3D
  leftArm: THREE.Object3D
  rightArm: THREE.Object3D
  height: number
  width: number
  variant: ProceduralVariant
}

/** Build a knight-ish low poly hero. Units ≈ meters; height ~1.7. */
export function buildProceduralHero(
  kitId: HeroKitId,
  opts?: { variant?: ProceduralVariant },
): ProceduralRig {
  const kit: HeroKit = HERO_KITS[kitId]
  const variant: ProceduralVariant = opts?.variant ?? 'full'
  const root = new THREE.Group()
  root.name = `procedural:${kitId}:${variant}`

  const plate = solid(kit.plate, { metalness: 0.45, roughness: 0.4 })
  const trim = solid(kit.trim, { metalness: 0.35, roughness: 0.45 })
  const skin = solid(kit.skin, { metalness: 0.05, roughness: 0.65 })
  const hair = solid(kit.hair, { metalness: 0.05, roughness: 0.7 })
  const accent = solid(kit.accent, { metalness: 0.4, roughness: 0.4 })
  const boot = solid(0x1c1917, { metalness: 0.2, roughness: 0.7 })
  const cloth = solid(kitId === SKYRIM_FEMALE_ID ? 0xc4b5a5 : kit.plate, {
    metalness: 0.08,
    roughness: 0.72,
  })

  const torso = new THREE.Group()
  torso.name = 'torso'
  torso.position.y = 0.95
  root.add(torso)

  // Body + skirt / tunic
  part(torso, new THREE.CapsuleGeometry(0.18, 0.42, 4, 8), cloth, 0, 0.05, 0, 1.05, 1, 0.9)
  part(torso, new THREE.CylinderGeometry(0.22, 0.28, 0.28, 8), trim, 0, -0.28, 0.02, 1, 1, 1)
  // Chest crest
  part(torso, new THREE.BoxGeometry(0.1, 0.12, 0.04), accent, 0, 0.18, 0.16)

  // Pauldrons
  const ps = kit.pauldron
  part(torso, new THREE.BoxGeometry(0.22 * ps, 0.12, 0.2), plate, 0.28, 0.28, 0, 1, 1, 1, 0, 0, 0.25)
  part(torso, new THREE.BoxGeometry(0.22 * ps, 0.12, 0.2), plate, -0.28, 0.28, 0, 1, 1, 1, 0, 0, -0.25)
  part(torso, new THREE.BoxGeometry(0.08, 0.08, 0.02), accent, 0.3, 0.3, 0.1)
  part(torso, new THREE.BoxGeometry(0.08, 0.08, 0.02), accent, -0.3, 0.3, 0.1)

  // Neck + head
  const head = new THREE.Group()
  head.name = 'head'
  head.position.set(0, 0.42, 0)
  torso.add(head)
  part(head, new THREE.CylinderGeometry(0.06, 0.07, 0.1, 6), skin, 0, -0.08, 0)
  part(head, new THREE.SphereGeometry(0.13, 10, 10), skin, 0, 0.06, 0.01)
  // Eyes
  const eye = solid(0x1e293b, { roughness: 0.3 })
  part(head, new THREE.SphereGeometry(0.025, 6, 6), eye, 0.045, 0.08, 0.11)
  part(head, new THREE.SphereGeometry(0.025, 6, 6), eye, -0.045, 0.08, 0.11)
  // Hair / pony
  part(head, new THREE.SphereGeometry(0.14, 8, 8), hair, 0, 0.12, -0.02, 1.05, 0.7, 1.05)
  part(
    head,
    new THREE.ConeGeometry(0.07, 0.45 * kit.pony, 6),
    hair,
    0.02,
    0.1,
    -0.18,
    1,
    1,
    1,
    0.9,
    0.2,
    0,
  )

  // Radio headset (Sofia)
  if (kitId === SKYRIM_FEMALE_ID) {
    const mic = solid(0x292524, { metalness: 0.5, roughness: 0.35 })
    part(head, new THREE.TorusGeometry(0.12, 0.018, 6, 12, Math.PI), mic, 0, 0.06, 0, 1, 1, 1, 0, 0, Math.PI / 2)
    part(head, new THREE.SphereGeometry(0.035, 6, 6), mic, 0.13, 0.04, 0.02)
    part(head, new THREE.CapsuleGeometry(0.012, 0.08, 3, 4), mic, 0.1, -0.02, 0.1, 1, 1, 1, 0.6, 0, 0.4)
  }

  // Arms (pivots at shoulders)
  const leftArm = new THREE.Group()
  leftArm.name = 'leftArm'
  leftArm.position.set(0.28, 0.22, 0)
  torso.add(leftArm)
  part(leftArm, new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), plate, 0.06, -0.18, 0)
  part(leftArm, new THREE.SphereGeometry(0.045, 6, 6), skin, 0.06, -0.38, 0)

  const rightArm = new THREE.Group()
  rightArm.name = 'rightArm'
  rightArm.position.set(-0.28, 0.22, 0)
  torso.add(rightArm)
  part(rightArm, new THREE.CapsuleGeometry(0.05, 0.28, 3, 6), plate, -0.06, -0.18, 0)
  part(rightArm, new THREE.SphereGeometry(0.045, 6, 6), skin, -0.06, -0.38, 0)

  let leftThigh: THREE.Object3D
  let rightThigh: THREE.Object3D
  let leftShin: THREE.Object3D
  let rightShin: THREE.Object3D

  if (variant === 'bust') {
    // Soft pedestal so codex stage doesn't look legless; face cam crops above.
    part(root, new THREE.CylinderGeometry(0.16, 0.22, 0.72, 8), cloth, 0, 0.36, 0)
    part(root, new THREE.CylinderGeometry(0.24, 0.26, 0.06, 8), accent, 0, 0.02, 0)
    leftThigh = emptyPivot('leftThigh')
    rightThigh = emptyPivot('rightThigh')
    leftShin = emptyPivot('leftShin')
    rightShin = emptyPivot('rightShin')
  } else {
    leftThigh = new THREE.Group()
    leftThigh.name = 'leftThigh'
    leftThigh.position.set(0.1, 0.72, 0)
    root.add(leftThigh)
    part(leftThigh, new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), plate, 0, -0.18, 0)

    leftShin = new THREE.Group()
    leftShin.name = 'leftShin'
    leftShin.position.set(0, -0.36, 0)
    leftThigh.add(leftShin)
    part(leftShin, new THREE.CapsuleGeometry(0.055, 0.26, 3, 6), trim, 0, -0.16, 0)
    part(leftShin, new THREE.BoxGeometry(0.12, 0.08, 0.2), boot, 0, -0.34, 0.02)

    rightThigh = new THREE.Group()
    rightThigh.name = 'rightThigh'
    rightThigh.position.set(-0.1, 0.72, 0)
    root.add(rightThigh)
    part(rightThigh, new THREE.CapsuleGeometry(0.07, 0.28, 3, 6), plate, 0, -0.18, 0)

    rightShin = new THREE.Group()
    rightShin.name = 'rightShin'
    rightShin.position.set(0, -0.36, 0)
    rightThigh.add(rightShin)
    part(rightShin, new THREE.CapsuleGeometry(0.055, 0.26, 3, 6), trim, 0, -0.16, 0)
    part(rightShin, new THREE.BoxGeometry(0.12, 0.08, 0.2), boot, 0, -0.34, 0.02)
  }

  return {
    root,
    torso,
    head,
    leftThigh,
    rightThigh,
    leftShin,
    rightShin,
    leftArm,
    rightArm,
    height: 1.7,
    width: 0.55,
    variant,
  }
}

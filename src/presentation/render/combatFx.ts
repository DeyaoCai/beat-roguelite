import * as THREE from 'three'
import type { FrameSnapshot } from './types'
import { graftAccentHex, graftSparkHex, type FxMix } from './fxMix'

/** Foot / outline tint from the run's starter weapon. */
export function starterAuraHex(id: string): number {
  switch (id) {
    case 'flame':
      return 0x5eead4
    case 'spirit_orb':
      return 0xfb923c
    case 'ward_aura':
      return 0x38bdf8
    case 'thunder_chain':
      return 0x7dd3fc
    case 'starfall':
      return 0xfbbf24
    default:
      return 0xfff1c2
  }
}

type Spark = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  vx: number
  vz: number
  vy: number
  life: number
  maxLife: number
}

const tmpA = new THREE.Vector3()
const tmpZ = new THREE.Vector3(0, 0, 1)

/**
 * Arena combat VFX (slash burst, ice ring, lightning, fire orbs, earth smash).
 * Render-only; driven by FrameSnapshot.
 */
export function createCombatFx(scene: THREE.Scene) {
  const root = new THREE.Group()
  root.name = 'combatFx'
  scene.add(root)

  const sparkGeo = new THREE.SphereGeometry(1, 6, 6)
  const sparks: Spark[] = []
  const sparkPool: Spark['mesh'][] = []

  const takeSpark = () => {
    const mesh =
      sparkPool.pop() ??
      new THREE.Mesh(
        sparkGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
    if (!mesh.parent) root.add(mesh)
    return mesh
  }

  const spawnSpark = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    life: number,
    scale: number,
  ) => {
    let spark: Spark
    if (sparks.length >= 96) {
      spark = sparks.shift()!
      spark.mesh.visible = true
    } else {
      spark = { mesh: takeSpark(), vx: 0, vy: 0, vz: 0, life: 1, maxLife: 1 }
    }
    spark.mesh.material.color.setHex(color)
    spark.mesh.material.opacity = 1
    spark.mesh.position.set(x, y, z)
    spark.mesh.scale.setScalar(scale)
    spark.mesh.visible = true
    spark.vx = vx
    spark.vy = vy
    spark.vz = vz
    spark.life = life
    spark.maxLife = life
    sparks.push(spark)
  }

  const slashRoot = new THREE.Group()
  root.add(slashRoot)

  const boltGeo = new THREE.BoxGeometry(1, 1, 1)
  const boltPool: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>[] = []
  const liveBolts: typeof boltPool = []
  const takeBolt = (color: number) => {
    const mesh =
      boltPool.pop() ??
      new THREE.Mesh(
        boltGeo,
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
    mesh.material.color.setHex(color)
    if (!mesh.parent) root.add(mesh)
    return mesh
  }

  const hitGeo = new THREE.SphereGeometry(1, 10, 10)
  const hitPool: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  const liveHits: typeof hitPool = []
  const takeHit = () => {
    const mesh =
      hitPool.pop() ??
      new THREE.Mesh(
        hitGeo,
        new THREE.MeshBasicMaterial({
          color: 0xe0f2fe,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
    if (!mesh.parent) root.add(mesh)
    return mesh
  }

  const recycle = <T extends THREE.Mesh>(live: T[], pool: T[]) => {
    for (const m of live) {
      m.visible = false
      pool.push(m)
    }
    live.length = 0
  }

  const auraDiscMat = new THREE.MeshBasicMaterial({
          color: 0x0284c7,
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const auraDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), auraDiscMat)
  auraDisc.rotation.x = -Math.PI / 2
  auraDisc.visible = false
  root.add(auraDisc)

  const makeRing = (color: number) => {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    root.add(mesh)
    return { mesh, mat, lastR: -1, lastT: -1 }
  }
  const auraRing = makeRing(0x7dd3fc)
  const auraRing2 = makeRing(0xbae6fd)
  const auraPulseRing = makeRing(0xe0f2fe)

  type CraterVis = {
    disc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>
    ring: ReturnType<typeof makeRing>
    column: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>
  }
  const makeCrater = (): CraterVis => {
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 28),
      new THREE.MeshBasicMaterial({
        color: 0xa16207,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.visible = false
    root.add(disc)
    const ring = makeRing(0xd6d3d1)
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.55, 1, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x92400e,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    column.visible = false
    root.add(column)
    return { disc, ring, column }
  }
  const craterPool = [makeCrater(), makeCrater(), makeCrater(), makeCrater()]

  /** World-space ring: radius grows, stroke thickness stays put. */
  const placeRing = (
    vis: { mesh: THREE.Mesh; lastR: number; lastT: number },
    radius: number,
    thickness: number,
  ) => {
    const outer = Math.max(thickness + 0.08, radius)
    if (Math.abs(outer - vis.lastR) < 0.03 && Math.abs(thickness - vis.lastT) < 0.005) return
    vis.lastR = outer
    vis.lastT = thickness
    vis.mesh.geometry.dispose()
    vis.mesh.geometry = new THREE.RingGeometry(Math.max(0.04, outer - thickness), outer, 64)
    vis.mesh.scale.set(1, 1, 1)
  }

  const auraBubbleMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.1,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const auraBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), auraBubbleMat)
  auraBubble.visible = false
  root.add(auraBubble)

  const moteGeo = new THREE.SphereGeometry(0.08, 6, 6)
  const motes: THREE.Mesh[] = []
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(
      moteGeo,
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xe0f2fe : 0x7dd3fc,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    m.visible = false
    root.add(m)
    motes.push(m)
  }

  const glowGeo = new THREE.SphereGeometry(1, 12, 12)
  const glowPool: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[] = []
  const ensureGlow = (n: number) => {
    while (glowPool.length < n) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xea580c,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(glowGeo, mat)
      mesh.visible = false
      root.add(mesh)
      glowPool.push(mesh)
    }
  }

  const coreGlowPool: typeof glowPool = []
  const ensureCore = (n: number) => {
    while (coreGlowPool.length < n) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfde68a,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const mesh = new THREE.Mesh(glowGeo, mat)
      mesh.visible = false
      root.add(mesh)
      coreGlowPool.push(mesh)
    }
  }

  const clearGroup = (g: THREE.Group) => {
    while (g.children.length) {
      const c = g.children.pop()!
      g.remove(c)
      if (c instanceof THREE.Mesh || c instanceof THREE.Line) {
        c.geometry.dispose()
        const m = c.material
        if (Array.isArray(m)) m.forEach((x) => x.dispose())
        else m.dispose()
      }
    }
  }

  const feverMoteGeo = new THREE.SphereGeometry(0.1, 6, 6)
  const feverMotes: THREE.Mesh[] = []
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      feverMoteGeo,
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xfde047 : 0xfef9c3,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    m.visible = false
    root.add(m)
    feverMotes.push(m)
  }
  let lastFeverBurst = 0
  let feverDripAcc = 0

  const burstFever = (x: number, z: number) => {
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2
      const sp = 3.8 + (i % 4) * 1.6
      spawnSpark(
        x + Math.cos(a) * 0.4,
        0.35,
        z + Math.sin(a) * 0.4,
        Math.cos(a) * sp,
        5 + (i % 5) * 0.8,
        Math.sin(a) * sp,
        i % 3 ? 0xfde047 : 0xfbbf24,
        0.48,
        0.1 + (i % 3) * 0.05,
      )
    }
  }

  const hideFever = () => {
    for (const m of feverMotes) m.visible = false
  }

  const heroBloomMat = new THREE.MeshBasicMaterial({
    color: 0xfff1c2,
    transparent: true,
    opacity: 0.22,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const heroBloom = new THREE.Mesh(new THREE.CircleGeometry(1, 40), heroBloomMat)
  heroBloom.rotation.x = -Math.PI / 2
  heroBloom.visible = false
  root.add(heroBloom)

  const heroRing = makeRing(0xfff1c2)
  const heroRing2 = makeRing(0xffe8a3)
  const heroCastRing = makeRing(0xfde047)
  let heroCastLife = 1

  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
  const shieldBubble = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), shieldMat)
  shieldBubble.visible = false
  root.add(shieldBubble)

  const dashGhosts: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = []
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.visible = false
    root.add(mesh)
    dashGhosts.push(mesh)
  }
  const dashTrail: { x: number; z: number; hex: number }[] = []
  let lastHeroX = 0
  let lastHeroZ = 0
  let lastCastSeq = 0
  let lastDashing = false
  let dashSparkAcc = 0
  let moveDustAcc = 0

  const burstHeroCast = (x: number, z: number, hex: number) => {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2
      const sp = 2.4 + (i % 4) * 1.1
      spawnSpark(
        x + Math.cos(a) * 0.22,
        0.28,
        z + Math.sin(a) * 0.22,
        Math.cos(a) * sp,
        2.2 + (i % 5) * 0.55,
        Math.sin(a) * sp,
        i % 2 ? hex : 0xfff7ed,
        0.28,
        0.06 + (i % 3) * 0.03,
      )
    }
  }

  const burstEmerge = (x: number, z: number) => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const sp = 1.4 + (i % 4) * 0.7
      spawnSpark(
        x,
        0.08,
        z,
        Math.cos(a) * sp,
        2.6 + (i % 5) * 0.7,
        Math.sin(a) * sp,
        i % 3 ? 0xa16207 : i % 2 ? 0xd6d3d1 : 0x78716c,
        0.32,
        0.06 + (i % 3) * 0.04,
      )
    }
    spawnSpark(x, 0.2, z, 0, 3.4, 0, 0xe7e5e4, 0.22, 0.16)
  }

  const burstDash = (x: number, z: number, vx: number, vz: number, hex: number) => {
    const len = Math.hypot(vx, vz) || 1
    const dx = vx / len
    const dz = vz / len
    for (let i = 0; i < 12; i++) {
      spawnSpark(
        x - dx * 0.2,
        0.22 + (i % 4) * 0.08,
        z - dz * 0.2,
        -dx * (2.2 + (i % 4) * 0.8) + (Math.random() - 0.5) * 1.4,
        1.4 + (i % 3) * 0.6,
        -dz * (2.2 + (i % 4) * 0.8) + (Math.random() - 0.5) * 1.4,
        i % 2 ? hex : 0xf8fafc,
        0.22,
        0.05 + (i % 3) * 0.03,
      )
    }
  }

  const hideHero = () => {
    heroBloom.visible = false
    heroRing.mesh.visible = false
    heroRing2.mesh.visible = false
    heroCastRing.mesh.visible = false
    shieldBubble.visible = false
    for (const g of dashGhosts) g.visible = false
    dashTrail.length = 0
    heroCastLife = 1
  }

  let lastT = performance.now()
  let lastAuraPulse = 0
  let lastChainSig = ''
  let lastSlashBurst = 0
  let lastCraterSig = ''
  let lastPopSig = ''
  let orbTrailAcc = 0
  let chainDripAcc = 0

  const tickSparks = (dt: number) => {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.life -= dt
      if (s.life <= 0) {
        s.mesh.visible = false
        sparkPool.push(s.mesh)
        sparks.splice(i, 1)
        continue
      }
      const u = s.life / s.maxLife
      s.mesh.position.x += s.vx * dt
      s.mesh.position.y += s.vy * dt
      s.mesh.position.z += s.vz * dt
      s.vy -= 14 * dt
      s.mesh.material.opacity = u * u
      s.mesh.scale.multiplyScalar(0.985)
    }
  }

  const burstSlash = (
    x: number,
    z: number,
    dirX: number,
    dirZ: number,
    radius: number,
    half: number,
    mix: FxMix,
  ) => {
    const yaw = Math.atan2(dirZ, dirX)
    for (let i = 0; i < 28; i++) {
      const a = yaw - half + (i / 27) * half * 2
      const sp = 5 + (i % 4) * 2.2
      spawnSpark(
        x + Math.cos(a) * radius * 0.35,
        0.25 + (i % 5) * 0.08,
        z + Math.sin(a) * radius * 0.35,
        Math.cos(a) * sp,
        3 + (i % 5) * 1.1,
        Math.sin(a) * sp,
        graftSparkHex(mix, i, i % 3 ? 0x5eead4 : i % 2 ? 0xecfeff : 0x67e8f9),
        0.38,
        0.08 + (i % 4) * 0.05,
      )
    }
  }

  const burstKnock = (x: number, z: number, dirX: number, dirZ: number) => {
    const len = Math.hypot(dirX, dirZ) || 1
    const dx = dirX / len
    const dz = dirZ / len
    const px = -dz
    const pz = dx
    for (let i = 0; i < 14; i++) {
      const side = (i / 13 - 0.5) * 0.7
      const along = 2.8 + (i % 5) * 1.1
      spawnSpark(
        x + px * side * 0.35,
        0.22 + (i % 4) * 0.1,
        z + pz * side * 0.35,
        dx * along + px * side * 1.6,
        1.6 + (i % 4) * 0.7,
        dz * along + pz * side * 1.6,
        i % 3 ? 0xecfeff : i % 2 ? 0x5eead4 : 0xa5f3fc,
        0.28,
        0.06 + (i % 3) * 0.04,
      )
    }
  }

  const burstEarth = (x: number, z: number, r: number) => {
    for (let i = 0; i < 8; i++) {
      spawnSpark(
        x + (Math.random() - 0.5) * 0.5,
        0.8 + Math.random() * 0.6,
        z + (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 2.2,
        4 + Math.random() * 3,
        (Math.random() - 0.5) * 2.2,
        i % 2 ? 0xa16207 : 0xd6d3d1,
        0.4,
        0.1 + (i % 3) * 0.05,
      )
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const sp = 2.6 + (i % 3) * 1.4
      spawnSpark(
        x,
        0.25,
        z,
        Math.cos(a) * sp,
        2.4 + (i % 4) * 0.5,
        Math.sin(a) * sp,
        i % 2 ? 0xb45309 : 0x78716c,
        0.38,
        0.08 + (i % 3) * 0.04,
      )
    }
    spawnSpark(x, 0.45, z, 0, 6, 0, 0xd6d3d1, 0.24, 0.22 * r)
  }

  const burstFire = (x: number, z: number, r: number) => {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2
      const sp = 3.4 + (i % 3) * 1.6
      spawnSpark(
        x,
        0.3,
        z,
        Math.cos(a) * sp,
        3.6 + (i % 4) * 0.8,
        Math.sin(a) * sp,
        i % 3 ? 0xea580c : 0xfde68a,
        0.4,
        0.09 + (i % 3) * 0.05,
      )
    }
    spawnSpark(x, 0.55, z, 0, 8, 0, 0xf97316, 0.26, 0.24 * r)
  }

  const burstVolley = (x: number, z: number) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      spawnSpark(
        x,
        0.35,
        z,
        Math.cos(a) * 3.2,
        2.8,
        Math.sin(a) * 3.2,
        i % 2 ? 0xa78bfa : 0xfde68a,
        0.28,
        0.08,
      )
    }
    spawnSpark(x, 0.7, z, 0, 5.5, 0, 0xc4b5fd, 0.22, 0.14)
  }

  const burstSplit = (x: number, z: number) => {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      spawnSpark(
        x,
        0.42,
        z,
        Math.cos(a) * 3.6,
        2.6,
        Math.sin(a) * 3.6,
        i % 2 ? 0xfbbf24 : 0xfde68a,
        0.26,
        0.08,
      )
    }
    spawnSpark(x, 0.75, z, 0, 7, 0, 0xfff7ed, 0.2, 0.14)
  }

  const burstAura = (x: number, z: number, radius: number, mix: Mix) => {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      spawnSpark(
        x + Math.cos(a) * radius * 0.82,
        0.25,
        z + Math.sin(a) * radius * 0.82,
        Math.cos(a) * 4.2,
        3.2,
        Math.sin(a) * 4.2,
        graftSparkHex(mix, i, i % 2 ? 0xe0f2fe : 0x38bdf8),
        0.42,
        0.11,
      )
    }
  }

  type Mix = FrameSnapshot['fxMix']
  type ChainVis = FrameSnapshot['chains'][number]

  const mixExtra = (mix: Mix) =>
    (mix.split ? 1 : 0) + (mix.slow ? 1 : 0) + (mix.knock ? 1 : 0) + (mix.volley ? 1 : 0)

  const hash01 = (n: number) => {
    const s = Math.sin(n * 12.9898) * 43758.5453
    return s - Math.floor(s)
  }

  const pathScratch: THREE.Vector3[] = []
  const fillJagged = (
    ax: number,
    az: number,
    bx: number,
    bz: number,
    t: number,
    seed: number,
    segs: number,
    amp: number,
  ) => {
    while (pathScratch.length <= segs) pathScratch.push(new THREE.Vector3())
    const dx = bx - ax
    const dz = bz - az
    const len = Math.hypot(dx, dz) || 1
    const px = -dz / len
    const pz = dx / len
    for (let i = 0; i <= segs; i++) {
      const u = i / segs
      const jig =
        i === 0 || i === segs
          ? 0
          : Math.sin(t * 48 + seed * 1.7 + i * 2.15) * amp * (0.4 + (i % 2) * 0.7)
      const rise = i === 0 || i === segs ? 0 : Math.abs(Math.sin(t * 19 + seed + i)) * amp * 0.55
      pathScratch[i]!.set(ax + dx * u + px * jig, 0.55 + rise, az + dz * u + pz * jig)
    }
    return segs + 1
  }

  const emitSeg = (
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    thick: number,
    glow: number,
    core: number,
    glowOp: number,
    coreOp: number,
  ) => {
    tmpA.set(bx - ax, by - ay, bz - az)
    const len = tmpA.length()
    if (len < 0.02) return
    tmpA.multiplyScalar(1 / len)
    const g = takeBolt(glow)
    g.visible = true
    g.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5)
    g.quaternion.setFromUnitVectors(tmpZ, tmpA)
    g.scale.set(thick * 2.7, thick * 2.7, len)
    g.material.opacity = glowOp
    liveBolts.push(g)
    const coreMesh = takeBolt(core)
    coreMesh.visible = true
    coreMesh.position.copy(g.position)
    coreMesh.quaternion.copy(g.quaternion)
    coreMesh.scale.set(thick * 0.78, thick * 0.78, len)
    coreMesh.material.opacity = coreOp
    liveBolts.push(coreMesh)
  }

  const stormDiscs: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>[] = []
  const stormRings: ReturnType<typeof makeRing>[] = []
  const ensureStorm = (n: number) => {
    while (stormDiscs.length < n) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1, 28),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      disc.rotation.x = -Math.PI / 2
      disc.visible = false
      root.add(disc)
      stormDiscs.push(disc)
      stormRings.push(makeRing(0xe0f2fe))
    }
  }
  const hideStorm = () => {
    for (const d of stormDiscs) d.visible = false
    for (const r of stormRings) r.mesh.visible = false
  }

  const burstChain = (c: ChainVis, mix: Mix) => {
    const extra = mixExtra(mix)
    const splitBolt = c.kind === 'split'
    const dx = c.bx - c.ax
    const dz = c.bz - c.az
    const len = Math.hypot(dx, dz) || 1
    const ux = dx / len
    const uz = dz / len
    const px = -uz
    const pz = ux
    const nPath = 7 + extra * 4
    for (let i = 0; i < nPath; i++) {
      const u = (i + 0.5) / nPath
      const side = ((i % 3) - 1) * 0.35
      const gold = splitBolt || (mix.split && i % 3 === 0)
      const ice = mix.slow && i % 2 === 0
      const col = gold ? 0xfde68a : ice ? 0xa5f3fc : i % 2 ? 0xf0f9ff : 0x38bdf8
      spawnSpark(
        c.ax + dx * u + px * side,
        0.55 + (i % 4) * 0.12,
        c.az + dz * u + pz * side,
        ux * (1.2 + extra) + px * side * 3,
        4 + extra * 1.4 + (i % 3),
        uz * (1.2 + extra) + pz * side * 3,
        col,
        0.22 + extra * 0.04,
        0.07 + (i % 3) * 0.03,
      )
    }
    const nHit = 12 + extra * 6
    for (let i = 0; i < nHit; i++) {
      const a = (i / nHit) * Math.PI * 2
      const sp = 3.2 + extra * 1.3 + (i % 4) * 1.1
      const gold = mix.split && i % 3 === 0
      const ice = mix.slow && i % 2 === 1
      const knock = mix.knock && i % 4 === 0
      spawnSpark(
        c.bx,
        0.35,
        c.bz,
        Math.cos(a) * sp,
        3.4 + (i % 5) * 0.9,
        Math.sin(a) * sp,
        gold ? 0xfbbf24 : ice ? 0x7dd3fc : knock ? 0x5eead4 : i % 2 ? 0xf0f9ff : 0x7dd3fc,
        0.32 + extra * 0.04,
        0.08 + (i % 4) * 0.04,
      )
    }
    spawnSpark(c.bx, 0.9, c.bz, 0, 9 + extra * 2, 0, 0xf8fafc, 0.3, 0.22 + extra * 0.05)
    spawnSpark(c.ax, 0.55, c.az, 0, 4, 0, 0x38bdf8, 0.2, 0.1)
    if (mix.volley) {
      spawnSpark(c.bx, 1.1, c.bz, px * 2, 6, pz * 2, 0xc4b5fd, 0.28, 0.14)
    }
  }

  const burstStormSplit = (x: number, z: number) => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      spawnSpark(
        x,
        0.45,
        z,
        Math.cos(a) * 4.4,
        3.2,
        Math.sin(a) * 4.4,
        i % 2 ? 0xfde68a : 0x38bdf8,
        0.28,
        0.08,
      )
    }
    spawnSpark(x, 0.8, z, 0, 8, 0, 0xfff7ed, 0.22, 0.16)
  }

  const burstStormKnock = (x: number, z: number, dirX: number, dirZ: number) => {
    burstKnock(x, z, dirX, dirZ)
    const len = Math.hypot(dirX, dirZ) || 1
    const dx = dirX / len
    const dz = dirZ / len
    for (let i = 0; i < 8; i++) {
      spawnSpark(
        x + dx * i * 0.12,
        0.4,
        z + dz * i * 0.12,
        dx * (5 + i),
        2.2,
        dz * (5 + i),
        i % 2 ? 0x38bdf8 : 0xf0f9ff,
        0.26,
        0.07,
      )
    }
  }

  const hideAura = () => {
    auraDisc.visible = false
    auraRing.mesh.visible = false
    auraRing2.mesh.visible = false
    auraPulseRing.mesh.visible = false
    auraBubble.visible = false
    for (const m of motes) m.visible = false
  }

  const hideCraters = () => {
    for (const c of craterPool) {
      c.disc.visible = false
      c.ring.mesh.visible = false
      c.column.visible = false
    }
  }

  const teleMat = (color: number, opacity: number) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

  const teleRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 48),
    teleMat(0xfacc15, 0.55),
  )
  teleRing.rotation.x = -Math.PI / 2
  teleRing.visible = false
  root.add(teleRing)

  const teleDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    teleMat(0xfde68a, 0.12),
  )
  teleDisc.rotation.x = -Math.PI / 2
  teleDisc.visible = false
  root.add(teleDisc)

  const teleCross: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = []
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 1), teleMat(0xfbbf24, 0.5))
    bar.rotation.x = -Math.PI / 2
    bar.visible = false
    root.add(bar)
    teleCross.push(bar)
  }

  const teleDash: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28, -0.35, 0.7),
    teleMat(0xf97316, 0.45),
  )
  teleDash.rotation.x = -Math.PI / 2
  teleDash.visible = false
  root.add(teleDash)

  const teleSummon: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>[] = []
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 24), teleMat(0xf472b6, 0.5))
    m.rotation.x = -Math.PI / 2
    m.visible = false
    root.add(m)
    teleSummon.push(m)
  }

  const eliteTeleRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1, 40),
    teleMat(0xfbbf24, 0.55),
  )
  eliteTeleRing.rotation.x = -Math.PI / 2
  eliteTeleRing.visible = false
  root.add(eliteTeleRing)

  const hideBossTele = () => {
    teleRing.visible = false
    teleDisc.visible = false
    teleDash.visible = false
    eliteTeleRing.visible = false
    for (const m of teleCross) m.visible = false
    for (const m of teleSummon) m.visible = false
  }

  const syncBossTele = (snap: FrameSnapshot, t: number) => {
    hideBossTele()
    if (snap.eliteTele) {
      const e = snap.eliteTele
      const urge = 1 - e.progress
      const pulse = 0.9 + 0.12 * Math.sin(t * 14)
      eliteTeleRing.visible = true
      eliteTeleRing.position.set(e.x, 0.07, e.z)
      eliteTeleRing.scale.setScalar((1.2 + urge * 1.6) * pulse)
      eliteTeleRing.material.opacity = 0.35 + urge * 0.4
    }
    const b = snap.boss
    if (!b?.teleKind || !b.windup) return
    const p = b.teleProgress
    const urge = 1 - p
    const pulse = 0.85 + 0.15 * Math.sin(t * (10 + urge * 18))
    const y = 0.06

    if (b.teleKind === 'ring' || b.teleKind === 'phase') {
      const r = (b.teleKind === 'phase' ? 5.2 : 3.6) * (0.55 + urge * 0.55)
      teleRing.visible = true
      teleRing.position.set(b.x, y, b.z)
      teleRing.scale.setScalar(r * pulse)
      teleRing.material.opacity = 0.35 + urge * 0.45
      teleRing.material.color.setHex(b.teleKind === 'phase' ? 0xf43f5e : 0xfacc15)
      teleDisc.visible = true
      teleDisc.position.set(b.x, y * 0.5, b.z)
      teleDisc.scale.setScalar(r * 0.92)
      teleDisc.material.opacity = 0.08 + urge * 0.14
      return
    }

    if (b.teleKind === 'cross') {
      const len = 4.2 * (0.5 + urge * 0.55)
      for (let i = 0; i < teleCross.length; i++) {
        const bar = teleCross[i]!
        bar.visible = true
        bar.position.set(b.x, y, b.z)
        const ang = (i * Math.PI) / 4
        bar.rotation.z = -ang
        bar.scale.set(1, len, 1)
        bar.material.opacity = 0.3 + urge * 0.45
      }
      return
    }

    if (b.teleKind === 'dash' || b.teleKind === 'fan') {
      const range = b.teleKind === 'dash' ? 4.8 : 3.6
      teleDash.visible = true
      teleDash.position.set(b.x, y, b.z)
      teleDash.rotation.z = -b.yaw
      teleDash.scale.setScalar(range * (0.55 + urge * 0.5) * pulse)
      teleDash.material.color.setHex(b.teleKind === 'dash' ? 0xf97316 : 0xfacc15)
      teleDash.material.opacity = 0.28 + urge * 0.4
      return
    }

    if (b.teleKind === 'summon') {
      for (let i = 0; i < teleSummon.length; i++) {
        const m = teleSummon[i]!
        const ang = (i / teleSummon.length) * Math.PI * 2 + t * 1.2
        const rad = 1.5 + i * 0.15
        m.visible = true
        m.position.set(b.x + Math.cos(ang) * rad, y, b.z + Math.sin(ang) * rad)
        m.scale.setScalar(0.55 + urge * 0.35)
        m.material.opacity = 0.35 + urge * 0.4
      }
    }
  }

  const hide = () => {
    clearGroup(slashRoot)
    recycle(liveBolts, boltPool)
    recycle(liveHits, hitPool)
    hideAura()
    hideFever()
    hideHero()
    hideCraters()
    hideStorm()
    hideBossTele()
    for (const g of glowPool) g.visible = false
    for (const g of coreGlowPool) g.visible = false
    for (const s of sparks) {
      s.mesh.visible = false
      sparkPool.push(s.mesh)
    }
    sparks.length = 0
  }

  const sync = (snap: FrameSnapshot, playing: boolean) => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    tickSparks(dt)
    if (!playing) {
      hide()
      return
    }

    const p = snap.player
    const t = now * 0.001

    clearGroup(slashRoot)
    const hotSlash = snap.slashes.find((s) => s.lifeRatio > 0.8)
    if (hotSlash && now - lastSlashBurst > 90) {
      lastSlashBurst = now
      burstSlash(
        hotSlash.x,
        hotSlash.z,
        hotSlash.dirX,
        hotSlash.dirZ,
        hotSlash.radius,
        hotSlash.halfAngle,
        snap.fxMix,
      )
    }

    const craterSig = snap.craters
      .map((c) => `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.style ?? 'earth'}`)
      .join('|')
    if (craterSig !== lastCraterSig) {
      const prev = new Set(lastCraterSig.split('|').filter(Boolean))
      for (const c of snap.craters) {
        const k = `${c.x.toFixed(1)},${c.z.toFixed(1)},${c.style ?? 'earth'}`
        if (!prev.has(k) && c.lifeRatio > 0.72) {
          if (c.style === 'fire') burstFire(c.x, c.z, c.r)
          else burstEarth(c.x, c.z, c.r)
        }
      }
      lastCraterSig = craterSig
    }
    for (let i = 0; i < craterPool.length; i++) {
      const vis = craterPool[i]!
      const c = snap.craters[i]
      if (!c) {
        vis.disc.visible = false
        vis.ring.mesh.visible = false
        vis.column.visible = false
        continue
      }
      const fire = c.style === 'fire'
      const accent = graftAccentHex(snap.fxMix, fire ? 0xea580c : 0xa16207)
      const fused = accent !== (fire ? 0xea580c : 0xa16207)
      vis.disc.material.color.setHex(fused ? accent : fire ? 0xea580c : 0xa16207)
      vis.ring.mat.color.setHex(
        fused ? graftSparkHex(snap.fxMix, i, fire ? 0xfde68a : 0xd6d3d1) : fire ? 0xfde68a : 0xd6d3d1,
      )
      vis.column.material.color.setHex(fused ? accent : fire ? 0xf97316 : 0x92400e)
      const u = c.lifeRatio
      vis.disc.visible = true
      vis.disc.position.set(c.x, 0.05, c.z)
      vis.disc.scale.setScalar(c.r)
      vis.disc.material.opacity = 0.22 + 0.45 * u
      vis.ring.mesh.visible = true
      vis.ring.mesh.position.set(c.x, 0.08, c.z)
      placeRing(vis.ring, c.r * (0.92 + 0.2 * (1 - u)), 0.14)
      vis.ring.mat.opacity = 0.35 + 0.5 * u
      vis.column.visible = true
      vis.column.position.set(c.x, 0.45 + 0.55 * u, c.z)
      vis.column.scale.set(c.r * 1.15, 0.9 + 1.4 * u, c.r * 1.15)
      vis.column.material.opacity = 0.18 + 0.4 * u
    }

    const popSig = snap.pops.map((p) => `${p.kind}:${p.x.toFixed(1)},${p.z.toFixed(1)}`).join('|')
    if (popSig !== lastPopSig) {
      const prev = new Set(lastPopSig.split('|').filter(Boolean))
      for (const p of snap.pops) {
        const k = `${p.kind}:${p.x.toFixed(1)},${p.z.toFixed(1)}`
        if (!prev.has(k) && p.lifeRatio > 0.55) {
          if (p.kind === 'emerge') {
            burstEmerge(p.x, p.z)
          } else if (p.kind === 'volley') {
            burstVolley(p.x, p.z)
          } else if (p.kind === 'split') {
            burstSplit(p.x, p.z)
          } else if (p.kind === 'knock') {
            if (snap.fxMix.thunder || snap.starterId === 'thunder_chain') {
              burstStormKnock(p.x, p.z, p.dirX ?? 0, p.dirZ ?? -1)
            } else burstKnock(p.x, p.z, p.dirX ?? 0, p.dirZ ?? -1)
          } else if (snap.fxMix.thunder || snap.starterId === 'thunder_chain') {
            burstStormSplit(p.x, p.z)
          } else {
            for (let i = 0; i < 8; i++) {
              const a = (i / 8) * Math.PI * 2
              spawnSpark(
                p.x,
                0.4,
                p.z,
                Math.cos(a) * 2.8,
                2.2,
                Math.sin(a) * 2.8,
                i % 2 ? 0xf97316 : 0xfde68a,
                0.22,
                0.07,
              )
            }
          }
        }
      }
      lastPopSig = popSig
    }

    if (snap.aura) {
      const pulse = snap.aura.pulse
      const r = snap.aura.radius * (1 + pulse * 0.1)
      const auraHex = graftAccentHex(snap.fxMix, 0x38bdf8)
      auraDiscMat.color.setHex(graftAccentHex(snap.fxMix, 0x0284c7))
      auraDisc.visible = true
      auraDisc.position.set(p.x, 0.05, p.z)
      auraDisc.scale.setScalar(r)
      auraDiscMat.opacity = 0.1 + 0.22 * pulse
      auraRing.mat.color.setHex(auraHex)
      auraRing.mesh.visible = true
      auraRing.mesh.position.set(p.x, 0.07, p.z)
      placeRing(auraRing, r, 0.14)
      auraRing.mat.opacity = 0.38 + 0.5 * pulse
      const innerR = r * (0.52 + 0.22 * Math.sin(snap.beatPhase * Math.PI * 2))
      auraRing2.mat.color.setHex(graftSparkHex(snap.fxMix, 1, 0xbae6fd))
      auraRing2.mesh.visible = true
      auraRing2.mesh.position.set(p.x, 0.09, p.z)
      placeRing(auraRing2, innerR, 0.1)
      auraRing2.mat.opacity = 0.28 + 0.4 * pulse
      auraPulseRing.mat.color.setHex(graftSparkHex(snap.fxMix, 2, 0xe0f2fe))
      auraPulseRing.mesh.visible = pulse > 0.08
      auraPulseRing.mesh.position.set(p.x, 0.11, p.z)
      placeRing(auraPulseRing, r * (0.7 + 0.55 * pulse), 0.12)
      auraPulseRing.mat.opacity = 0.55 * pulse
      auraBubbleMat.color.setHex(auraHex)
      auraBubble.visible = true
      auraBubble.position.set(p.x, 0.35, p.z)
      auraBubble.scale.set(r * 0.92, r * 0.48, r * 0.92)
      auraBubbleMat.opacity = 0.08 + 0.16 * pulse
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i]!
        const a = snap.beatPhase * Math.PI * 2 + (i / motes.length) * Math.PI * 2
        const rr = r * (0.5 + 0.4 * ((i % 3) / 3))
        m.visible = true
        m.position.set(p.x + Math.cos(a) * rr, 0.32 + 0.28 * Math.sin(t * 3 + i), p.z + Math.sin(a) * rr)
        const mm = m.material as THREE.MeshBasicMaterial
        mm.color.setHex(graftSparkHex(snap.fxMix, i, i % 2 ? 0xe0f2fe : 0x7dd3fc))
        mm.opacity = 0.4 + 0.55 * pulse
      }
      if (pulse > lastAuraPulse + 0.22 && pulse > 0.4) {
        burstAura(p.x, p.z, snap.aura.radius, snap.fxMix)
      }
      lastAuraPulse = pulse
    } else {
      hideAura()
      lastAuraPulse = 0
    }

    if (snap.feverActive || snap.feverFlash > 0.08) {
      const pulse = snap.feverFlash
      const beat = 0.5 + 0.5 * Math.sin(snap.beatPhase * Math.PI * 2)
      const r = (p.r * 2.4 + 1.1) * (1 + 0.12 * beat + 0.35 * pulse)
      for (let i = 0; i < feverMotes.length; i++) {
        const m = feverMotes[i]!
        const a = snap.beatPhase * Math.PI * 2 + (i / feverMotes.length) * Math.PI * 2
        const rr = r * (0.55 + 0.35 * ((i % 3) / 3))
        m.visible = snap.feverActive
        m.position.set(
          p.x + Math.cos(a) * rr,
          0.4 + 0.35 * Math.sin(t * 4 + i),
          p.z + Math.sin(a) * rr,
        )
        ;(m.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.5 * beat
      }
      feverDripAcc += dt
      if (snap.feverActive && feverDripAcc > 0.07) {
        feverDripAcc = 0
        const a = Math.random() * Math.PI * 2
        spawnSpark(
          p.x + Math.cos(a) * r * 0.7,
          0.5,
          p.z + Math.sin(a) * r * 0.7,
          Math.cos(a) * 1.4,
          2.8,
          Math.sin(a) * 1.4,
          0xfde047,
          0.28,
          0.07,
        )
      }
      if (pulse > 0.45 && now - lastFeverBurst > 280) {
        lastFeverBurst = now
        burstFever(p.x, p.z)
      }
    } else {
      hideFever()
    }

    const hex = starterAuraHex(snap.starterId)
    const graftHex = graftAccentHex(snap.fxMix, hex)
    const beat = 0.5 + 0.5 * Math.sin(snap.beatPhase * Math.PI * 2)
    const fever = snap.feverActive ? 1 : snap.feverFlash
    const vx = p.x - lastHeroX
    const vz = p.z - lastHeroZ
    lastHeroX = p.x
    lastHeroZ = p.z

    heroBloom.visible = true
    heroBloom.material.color.setHex(p.hurtFlash > 0.15 ? 0xfb7185 : hex)
    heroBloom.position.set(p.x, 0.04, p.z)
    heroBloom.scale.setScalar(p.r * (1.7 + 0.35 * beat + 0.55 * fever + (p.dashing ? 0.45 : 0)))
    heroBloom.material.opacity =
      0.16 + 0.14 * beat + 0.18 * fever + (p.invuln > 0 ? 0.12 : 0) + (p.dashing ? 0.2 : 0)

    heroRing.mat.color.setHex(p.hurtFlash > 0.15 ? 0xfb7185 : hex)
    heroRing.mesh.visible = true
    heroRing.mesh.position.set(p.x, 0.06, p.z)
    placeRing(heroRing, p.r * (1.55 + 0.28 * beat + 0.4 * fever), 0.1)
    heroRing.mat.opacity = 0.32 + 0.28 * beat + 0.25 * fever

    heroRing2.mat.color.setHex(graftHex === hex ? 0xfff7ed : graftHex)
    heroRing2.mesh.visible = true
    heroRing2.mesh.position.set(p.x, 0.08, p.z)
    placeRing(heroRing2, p.r * (0.95 + 0.2 * beat), 0.07)
    heroRing2.mat.opacity = 0.22 + 0.2 * beat

    if (p.shieldOn) {
      const pulse = 0.92 + 0.1 * Math.sin(t * 8)
      shieldBubble.visible = true
      shieldBubble.position.set(p.x, 0.55, p.z)
      shieldBubble.scale.setScalar(p.r * 1.85 * pulse)
      shieldBubble.material.opacity = 0.18 + 0.1 * beat
    } else {
      shieldBubble.visible = false
    }

    if (p.dashing) {
      dashTrail.unshift({ x: p.x, z: p.z, hex })
      if (dashTrail.length > dashGhosts.length) dashTrail.length = dashGhosts.length
      if (!lastDashing) burstDash(p.x, p.z, vx, vz, hex)
      dashSparkAcc += dt
      if (dashSparkAcc > 0.02) {
        dashSparkAcc = 0
        spawnSpark(
          p.x,
          0.28,
          p.z,
          -vx * 8 + (Math.random() - 0.5) * 1.2,
          1.8,
          -vz * 8 + (Math.random() - 0.5) * 1.2,
          hex,
          0.18,
          0.07,
        )
      }
    } else {
      dashSparkAcc = 0
      if (dashTrail.length) dashTrail.length = Math.max(0, dashTrail.length - 1)
    }
    lastDashing = p.dashing
    for (let i = 0; i < dashGhosts.length; i++) {
      const g = dashGhosts[i]!
      const node = dashTrail[i]
      if (!node) {
        g.visible = false
        continue
      }
      const u = 1 - i / dashGhosts.length
      g.visible = true
      g.material.color.setHex(node.hex)
      g.position.set(node.x, 0.05, node.z)
      g.scale.setScalar(p.r * (1.15 + 0.35 * u))
      g.material.opacity = 0.12 + 0.28 * u
    }

    if (p.castSeq !== lastCastSeq) {
      if (p.castSeq > 0) {
        burstHeroCast(p.x, p.z, hex)
        heroCastLife = 0
      }
      lastCastSeq = p.castSeq
    }
    if (heroCastLife < 1) {
      heroCastLife = Math.min(1, heroCastLife + dt / 0.22)
      const u = heroCastLife
      heroCastRing.mesh.visible = true
      heroCastRing.mat.color.setHex(hex)
      heroCastRing.mesh.position.set(p.x, 0.09, p.z)
      placeRing(heroCastRing, p.r * (1.2 + u * 2.4), 0.12)
      heroCastRing.mat.opacity = (1 - u) * 0.85
    } else {
      heroCastRing.mesh.visible = false
    }

    if (p.moving && !p.dashing) {
      moveDustAcc += dt
      if (moveDustAcc > 0.09) {
        moveDustAcc = 0
        spawnSpark(
          p.x + (Math.random() - 0.5) * 0.25,
          0.12,
          p.z + (Math.random() - 0.5) * 0.25,
          -vx * 4,
          0.8,
          -vz * 4,
          hex,
          0.16,
          0.045,
        )
      }
    } else {
      moveDustAcc = 0
    }

    recycle(liveBolts, boltPool)
    recycle(liveHits, hitPool)
    hideStorm()
    const mix = snap.fxMix
    const extra = mixExtra(mix)
    const crowded = snap.enemies.length > 40
    const busy = snap.chains.length > 22 || crowded
    const sig = snap.chains
      .map((c) => `${c.kind}:${c.ax.toFixed(1)}>${c.bx.toFixed(1)}`)
      .join('|')
    ensureStorm(snap.chains.length)
    for (let i = 0; i < snap.chains.length; i++) {
      const c = snap.chains[i]!
      const seed = i + c.ax * 3.1 + c.hop * 11
      const splitBolt = c.kind === 'split'
      const segs = splitBolt ? 4 : busy ? 7 : 9
      const amp = splitBolt ? 0.06 : 0.38 + extra * 0.1
      const n = fillJagged(c.ax, c.az, c.bx, c.bz, t, seed, segs, amp)
      const thick = (c.hop === 0 ? 0.09 : 0.07) + 0.12 * c.lifeRatio + extra * 0.012
      const glowHex = splitBolt ? 0xfbbf24 : 0x38bdf8
      const coreHex = splitBolt ? 0xfff7ed : mix.slow ? 0xecfeff : 0xf0f9ff
      const glowOp = 0.32 + 0.4 * c.lifeRatio
      const coreOp = 0.7 + 0.3 * c.lifeRatio
      for (let k = 0; k < n - 1; k++) {
        const a = pathScratch[k]!
        const b = pathScratch[k + 1]!
        emitSeg(a.x, a.y, a.z, b.x, b.y, b.z, thick, glowHex, coreHex, glowOp, coreOp)
      }
      const dx = c.bx - c.ax
      const dz = c.bz - c.az
      const span = Math.hypot(dx, dz) || 1
      const px = -dz / span
      const pz = dx / span
      if (splitBolt && !busy) {
        const mx = c.ax + dx * 0.58
        const mz = c.az + dz * 0.58
        const tine = 0.62
        for (const side of [1, -1] as const) {
          emitSeg(
            mx,
            0.55,
            mz,
            c.bx + px * tine * side,
            0.78,
            c.bz + pz * tine * side,
            thick * 0.72,
            0xfde68a,
            0xfffbeb,
            glowOp * 0.9,
            coreOp * 0.85,
          )
        }
      }
      if (!busy && mix.knock) {
        for (let k = 2; k < n - 2; k += 3) {
          const a = pathScratch[k]!
          emitSeg(
            a.x - px * 0.28,
            a.y,
            a.z - pz * 0.28,
            a.x + px * 0.28,
            a.y + 0.08,
            a.z + pz * 0.28,
            thick * 0.45,
            0x5eead4,
            0xecfeff,
            glowOp * 0.65,
            coreOp * 0.55,
          )
        }
      }
      const u = c.lifeRatio
      const hit = takeHit()
      hit.visible = true
      hit.material.color.setHex(splitBolt ? 0xfde68a : mix.slow ? 0xa5f3fc : 0xe0f2fe)
      hit.position.set(c.bx, 0.62, c.bz)
      hit.scale.setScalar((0.28 + extra * 0.06 + 0.34 * u) * (c.hop === 0 ? 1.15 : 1))
      hit.material.opacity = 0.5 + 0.45 * u
      liveHits.push(hit)
      if (mix.slow) {
        const ice = takeHit()
        ice.visible = true
        ice.material.color.setHex(0x67e8f9)
        ice.position.set(c.bx, 0.18, c.bz)
        ice.scale.set(0.55 + 0.35 * u, 0.12, 0.55 + 0.35 * u)
        ice.material.opacity = 0.35 + 0.4 * u
        liveHits.push(ice)
      }
      if (extra >= 2) {
        const col = takeBolt(mix.volley ? 0xa78bfa : 0x7dd3fc)
        col.visible = true
        col.position.set(c.bx, 0.2 + 1.1 * u, c.bz)
        col.quaternion.identity()
        col.scale.set(0.07 + extra * 0.015, 0.9 + 1.6 * u, 0.07 + extra * 0.015)
        col.material.opacity = 0.22 + 0.35 * u
        liveBolts.push(col)
      }
      const disc = stormDiscs[i]
      const ring = stormRings[i]
      if (disc && ring) {
        const r = 0.55 + extra * 0.12 + 0.45 * u
        disc.visible = true
        disc.material.color.setHex(splitBolt ? 0xfbbf24 : mix.slow ? 0x22d3ee : 0x38bdf8)
        disc.position.set(c.bx, 0.04, c.bz)
        disc.scale.setScalar(r)
        disc.material.opacity = 0.2 + 0.4 * u
        ring.mat.color.setHex(mix.slow ? 0xe0f2fe : mix.split ? 0xfde68a : 0xf0f9ff)
        ring.mesh.visible = true
        ring.mesh.position.set(c.bx, 0.07, c.bz)
        placeRing(ring, r * (1.05 + 0.25 * (1 - u)), 0.1 + extra * 0.02)
        ring.mat.opacity = 0.4 + 0.45 * u
      }
    }
    if (sig !== lastChainSig && snap.chains.length && !crowded) {
      const nBurst = Math.min(snap.chains.length, 10)
      for (let i = snap.chains.length - nBurst; i < snap.chains.length; i++) {
        burstChain(snap.chains[i]!, mix)
      }
    }
    lastChainSig = sig
    if (snap.chains.length && !crowded) {
      chainDripAcc += dt
      if (chainDripAcc > 0.045) {
        chainDripAcc = 0
        const c = snap.chains[Math.min(snap.chains.length - 1, (hash01(t * 9) * snap.chains.length) | 0)]!
        const u = hash01(t * 13 + c.ax)
        const gold = mix.split && u > 0.6
        const ice = mix.slow && u < 0.35
        spawnSpark(
          c.ax + (c.bx - c.ax) * u,
          0.62,
          c.az + (c.bz - c.az) * u,
          (hash01(t + 1) - 0.5) * 2.4,
          3.4,
          (hash01(t + 2) - 0.5) * 2.4,
          gold ? 0xfde68a : ice ? 0xa5f3fc : 0xf0f9ff,
          0.18,
          0.06,
        )
      }
    } else {
      chainDripAcc = 0
    }

    const friends = snap.bullets.filter((b) => b.friendly)
    ensureGlow(friends.length)
    ensureCore(friends.length)
    orbTrailAcc += dt
    const drip = !crowded && orbTrailAcc > 0.04
    if (drip) orbTrailAcc = 0
    for (let i = 0; i < glowPool.length; i++) {
      const halo = glowPool[i]!
      const core = coreGlowPool[i]
      const b = friends[i]
      if (!b) {
        halo.visible = false
        if (core) core.visible = false
        continue
      }
      halo.visible = true
      halo.position.set(b.x, 0.48, b.z)
      halo.scale.setScalar(Math.max(0.38, b.r * 3.4))
      halo.material.color.setHex(graftAccentHex(snap.fxMix, 0xea580c))
      halo.material.opacity = 0.32 + 0.22 * Math.sin(t * 14 + i)
      if (core) {
        core.visible = true
        core.position.set(b.x, 0.5, b.z)
        core.scale.setScalar(Math.max(0.14, b.r * 1.15))
        core.material.color.setHex(graftSparkHex(snap.fxMix, i, 0xfde68a))
        core.material.opacity = 0.75
      }
      if (drip && i % 2 === 0) {
        spawnSpark(b.x, 0.4, b.z, 0, 0.4, 0, graftSparkHex(snap.fxMix, i, 0xfb923c), 0.16, 0.06)
      }
    }

    syncBossTele(snap, t)
  }

  return { sync, hide }
}

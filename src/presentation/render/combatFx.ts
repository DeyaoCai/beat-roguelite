import * as THREE from 'three'
import type { FrameSnapshot } from './types'

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
    root.add(mesh)
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
    const mesh = takeSpark()
    mesh.material.color.setHex(color)
    mesh.material.opacity = 1
    mesh.position.set(x, y, z)
    mesh.scale.setScalar(scale)
    mesh.visible = true
    sparks.push({ mesh, vx, vy, vz, life, maxLife: life })
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
    root.add(mesh)
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
    root.add(mesh)
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

  const bladeGeo = new THREE.BoxGeometry(0.22, 0.1, 0.58)
  const orbitBlades: THREE.Mesh[] = []
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(
      bladeGeo,
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xfde68a : 0xfbbf24,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    m.visible = false
    root.add(m)
    orbitBlades.push(m)
  }

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

  let lastT = performance.now()
  let lastAuraPulse = 0
  let lastChainSig = ''
  let lastSlashBurst = 0
  let lastCraterSig = ''
  let lastPopSig = ''
  let orbTrailAcc = 0

  const tickSparks = (dt: number) => {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      s.life -= dt
      if (s.life <= 0) {
        s.mesh.visible = false
        root.remove(s.mesh)
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
        i % 3 ? 0x5eead4 : i % 2 ? 0xecfeff : 0x67e8f9,
        0.38,
        0.08 + (i % 4) * 0.05,
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

  const burstAura = (x: number, z: number, radius: number) => {
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2
      spawnSpark(
        x + Math.cos(a) * radius * 0.82,
        0.25,
        z + Math.sin(a) * radius * 0.82,
        Math.cos(a) * 4.2,
        3.2,
        Math.sin(a) * 4.2,
        i % 2 ? 0xe0f2fe : 0x38bdf8,
        0.42,
        0.11,
      )
    }
  }

  const burstChain = (ax: number, az: number, bx: number, bz: number) => {
    spawnSpark(bx, 0.85, bz, 0, 7, 0, 0xf0f9ff, 0.28, 0.2)
    spawnSpark(bx, 0.55, bz, 2.2, 3, 0.6, 0x7dd3fc, 0.24, 0.1)
    spawnSpark(ax, 0.5, az, 0, 3, 0, 0x38bdf8, 0.18, 0.08)
  }

  const jagged = (ax: number, az: number, bx: number, bz: number, t: number, seed: number) => {
    const pts: THREE.Vector3[] = []
    const segs = 7
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
          : Math.sin(t * 42 + seed * 1.7 + i * 2.4) * 0.42 * (0.45 + (i % 2))
      pts.push(
        new THREE.Vector3(
          ax + dx * u + px * jig,
          0.52 + Math.abs(jig) * 0.7,
          az + dz * u + pz * jig,
        ),
      )
    }
    return pts
  }

  const hideAura = () => {
    auraDisc.visible = false
    auraRing.mesh.visible = false
    auraRing2.mesh.visible = false
    auraPulseRing.mesh.visible = false
    auraBubble.visible = false
    for (const m of motes) m.visible = false
  }

  const hideOrbit = () => {
    for (const b of orbitBlades) b.visible = false
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
    hideOrbit()
    hideFever()
    hideCraters()
    hideBossTele()
    for (const g of glowPool) g.visible = false
    for (const g of coreGlowPool) g.visible = false
    for (const s of sparks) {
      s.mesh.visible = false
      root.remove(s.mesh)
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
      burstSlash(hotSlash.x, hotSlash.z, hotSlash.dirX, hotSlash.dirZ, hotSlash.radius, hotSlash.halfAngle)
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
      vis.disc.material.color.setHex(fire ? 0xea580c : 0xa16207)
      vis.ring.mat.color.setHex(fire ? 0xfde68a : 0xd6d3d1)
      vis.column.material.color.setHex(fire ? 0xf97316 : 0x92400e)
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

    const popSig = snap.pops.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join('|')
    if (popSig !== lastPopSig) {
      const prev = new Set(lastPopSig.split('|').filter(Boolean))
      for (const p of snap.pops) {
        const k = `${p.x.toFixed(1)},${p.z.toFixed(1)}`
        if (!prev.has(k) && p.lifeRatio > 0.55) {
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
      lastPopSig = popSig
    }

    if (snap.aura) {
      const pulse = snap.aura.pulse
      const r = snap.aura.radius * (1 + pulse * 0.1)
      auraDisc.visible = true
      auraDisc.position.set(p.x, 0.05, p.z)
      auraDisc.scale.setScalar(r)
      auraDiscMat.opacity = 0.1 + 0.22 * pulse
      auraRing.mesh.visible = true
      auraRing.mesh.position.set(p.x, 0.07, p.z)
      placeRing(auraRing, r, 0.14)
      auraRing.mat.opacity = 0.38 + 0.5 * pulse
      const innerR = r * (0.52 + 0.22 * Math.sin(snap.beatPhase * Math.PI * 2))
      auraRing2.mesh.visible = true
      auraRing2.mesh.position.set(p.x, 0.09, p.z)
      placeRing(auraRing2, innerR, 0.1)
      auraRing2.mat.opacity = 0.28 + 0.4 * pulse
      auraPulseRing.mesh.visible = pulse > 0.08
      auraPulseRing.mesh.position.set(p.x, 0.11, p.z)
      placeRing(auraPulseRing, r * (0.7 + 0.55 * pulse), 0.12)
      auraPulseRing.mat.opacity = 0.55 * pulse
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
        ;(m.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.55 * pulse
      }
      if (pulse > lastAuraPulse + 0.22 && pulse > 0.4) {
        burstAura(p.x, p.z, snap.aura.radius)
      }
      lastAuraPulse = pulse
    } else {
      hideAura()
      lastAuraPulse = 0
    }

    if (snap.orbit) {
      for (let i = 0; i < orbitBlades.length; i++) {
        const mesh = orbitBlades[i]!
        const b = snap.orbit.blades[i]
        if (!b) {
          mesh.visible = false
          continue
        }
        mesh.visible = true
        mesh.position.set(b.x, 0.42 + 0.12 * snap.orbit.pulse, b.z)
        const ang = Math.atan2(b.z - p.z, b.x - p.x) + Math.PI / 2
        mesh.rotation.y = -ang
        const s = 1 + 0.25 * snap.orbit.pulse
        mesh.scale.set(s, s, s)
        ;(mesh.material as THREE.MeshBasicMaterial).opacity = 0.72 + 0.28 * snap.orbit.pulse
      }
    } else {
      hideOrbit()
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

    recycle(liveBolts, boltPool)
    recycle(liveHits, hitPool)
    const sig = snap.chains.map((c) => `${c.ax.toFixed(1)}>${c.bx.toFixed(1)}`).join('|')
    for (let i = 0; i < snap.chains.length; i++) {
      const c = snap.chains[i]!
      const pts = jagged(c.ax, c.az, c.bx, c.bz, t, i + c.ax)
      const thick = 0.07 + 0.1 * c.lifeRatio
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k]!
        const b = pts[k + 1]!
        tmpA.copy(b).sub(a)
        const len = tmpA.length()
        if (len < 0.02) continue
        tmpA.multiplyScalar(1 / len)
        const glow = takeBolt(0x38bdf8)
        glow.visible = true
        glow.position.copy(a).lerp(b, 0.5)
        glow.quaternion.setFromUnitVectors(tmpZ, tmpA)
        glow.scale.set(thick * 2.4, thick * 2.4, len)
        glow.material.opacity = 0.28 + 0.35 * c.lifeRatio
        liveBolts.push(glow)
        const core = takeBolt(0xf0f9ff)
        core.visible = true
        core.position.copy(glow.position)
        core.quaternion.copy(glow.quaternion)
        core.scale.set(thick * 0.85, thick * 0.85, len)
        core.material.opacity = 0.65 + 0.35 * c.lifeRatio
        liveBolts.push(core)
      }
      const hit = takeHit()
      hit.visible = true
      hit.position.set(c.bx, 0.62, c.bz)
      hit.scale.setScalar(0.22 + 0.28 * c.lifeRatio)
      hit.material.opacity = 0.45 + 0.5 * c.lifeRatio
      liveHits.push(hit)
    }
    if (sig !== lastChainSig && snap.chains.length) {
      for (const c of snap.chains) burstChain(c.ax, c.az, c.bx, c.bz)
    }
    lastChainSig = sig

    const friends = snap.bullets.filter((b) => b.friendly)
    ensureGlow(friends.length)
    ensureCore(friends.length)
    orbTrailAcc += dt
    const drip = orbTrailAcc > 0.04
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
      halo.material.opacity = 0.32 + 0.22 * Math.sin(t * 14 + i)
      if (core) {
        core.visible = true
        core.position.set(b.x, 0.5, b.z)
        core.scale.setScalar(Math.max(0.14, b.r * 1.15))
        core.material.opacity = 0.75
      }
      if (drip && i % 2 === 0) {
        spawnSpark(b.x, 0.4, b.z, 0, 0.4, 0, 0xfb923c, 0.16, 0.06)
      }
    }

    syncBossTele(snap, t)
  }

  return { sync, hide }
}

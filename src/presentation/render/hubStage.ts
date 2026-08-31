import * as THREE from 'three'
import type { HubThemeId } from '../../content/hubThemes'

export type HubLights = {
  bg: number
  fog: number
  fogDensity: number
  exposure: number
  hemiSky: number
  hemiGround: number
  hemi: number
  dir: number
  dirColor: number
  dirPos: [number, number, number]
  rim: number
  rimColor: number
  rimPos: [number, number, number]
  beautyKey: number
  beautyFill: number
  beautyRim: number
}

const LIGHTS: Record<Exclude<HubThemeId, 'studio'>, HubLights> = {
  grove: {
    bg: 0x071a18,
    fog: 0x051410,
    fogDensity: 0.038,
    exposure: 0.78,
    hemiSky: 0xb8ffe0,
    hemiGround: 0x143028,
    hemi: 0.32,
    dir: 0.48,
    dirColor: 0xd8f0ff,
    dirPos: [5.2, 9.5, -3.4],
    rim: 0.38,
    rimColor: 0x3dff9a,
    rimPos: [-2.8, 2.2, 1.6],
    beautyKey: 0xe8fff4,
    beautyFill: 0x7dffb3,
    beautyRim: 0x3dff9a,
  },
  frost: {
    bg: 0x0a1424,
    fog: 0x0c182c,
    fogDensity: 0.028,
    exposure: 0.86,
    hemiSky: 0xc8e8ff,
    hemiGround: 0x1a2840,
    hemi: 0.38,
    dir: 0.55,
    dirColor: 0xe8f4ff,
    dirPos: [4.4, 10, 3.2],
    rim: 0.42,
    rimColor: 0x7ec8ff,
    rimPos: [-3.2, 2.4, -1.2],
    beautyKey: 0xf0f8ff,
    beautyFill: 0xa8d8ff,
    beautyRim: 0x67e8f9,
  },
  ember: {
    bg: 0x1a0c08,
    fog: 0x180804,
    fogDensity: 0.032,
    exposure: 0.84,
    hemiSky: 0xffd0a0,
    hemiGround: 0x3a1810,
    hemi: 0.3,
    dir: 0.7,
    dirColor: 0xffc078,
    dirPos: [3.2, 8.5, 2.4],
    rim: 0.46,
    rimColor: 0xff6a2a,
    rimPos: [-2.6, 2.6, -1.8],
    beautyKey: 0xfff1e4,
    beautyFill: 0xffb347,
    beautyRim: 0xff6a2a,
  },
  star: {
    bg: 0x070614,
    fog: 0x08061a,
    fogDensity: 0.022,
    exposure: 0.8,
    hemiSky: 0xe0d4ff,
    hemiGround: 0x1a1438,
    hemi: 0.28,
    dir: 0.42,
    dirColor: 0xc4b5fd,
    dirPos: [-2.8, 8, 4.2],
    rim: 0.5,
    rimColor: 0x67e8f9,
    rimPos: [2.4, 2.2, -2.2],
    beautyKey: 0xf3e8ff,
    beautyFill: 0xc4b5fd,
    beautyRim: 0x67e8f9,
  },
}

type Mote = {
  attr: THREE.BufferAttribute
  base: Float32Array
  seeds: Float32Array
  kind: 'firefly' | 'snow' | 'ember' | 'dust'
}

function hash(i: number, salt: number): number {
  const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function canvasTex(
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 256,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  paint(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function skyTex(top: string, mid: string, bot: string): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 256
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, top)
  g.addColorStop(0.42, mid)
  g.addColorStop(1, bot)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 8, 256)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function glowSprite(inner: string, outer: string, size = 64): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, inner)
  g.addColorStop(0.45, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function addSky(parent: THREE.Group, top: string, mid: string, bot: string) {
  const mat = new THREE.MeshBasicMaterial({
    map: skyTex(top, mid, bot),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(36, 24, 16), mat)
  parent.add(mesh)
}

function addFloor(
  parent: THREE.Group,
  map: THREE.CanvasTexture,
  size: number,
  color = 0xffffff,
  roughness = 0.92,
  metalness = 0.04,
) {
  map.repeat.set(size / 6, size / 6)
  const mat = new THREE.MeshStandardMaterial({
    map,
    color,
    roughness,
    metalness,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function addGlowBillboard(
  parent: THREE.Group,
  tex: THREE.CanvasTexture,
  x: number,
  y: number,
  z: number,
  scale: number,
  color: number,
) {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const s = new THREE.Sprite(mat)
  s.position.set(x, y, z)
  s.scale.setScalar(scale)
  parent.add(s)
  return s
}

function scatterRing(
  count: number,
  r0: number,
  r1: number,
  salt: number,
): { x: number; z: number; a: number; h: number; s: number }[] {
  const out = []
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash(i, salt) * 0.42
    const r = r0 + hash(i, salt + 1) * (r1 - r0)
    out.push({
      x: Math.sin(a) * r,
      z: Math.cos(a) * r,
      a,
      h: hash(i, salt + 2),
      s: 0.72 + hash(i, salt + 3) * 0.7,
    })
  }
  return out
}

function makePoints(
  n: number,
  color: number,
  size: number,
  place: (i: number, arr: Float32Array) => void,
): { mesh: THREE.Points; mote: Mote } {
  const pos = new Float32Array(n * 3)
  const seeds = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    place(i, pos)
    seeds[i * 3] = hash(i, 9)
    seeds[i * 3 + 1] = hash(i, 11)
    seeds[i * 3 + 2] = hash(i, 13)
  }
  const geo = new THREE.BufferGeometry()
  const attr = new THREE.BufferAttribute(pos, 3)
  geo.setAttribute('position', attr)
  const mat = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return {
    mesh: new THREE.Points(geo, mat),
    mote: { attr, base: pos.slice(), seeds, kind: 'dust' },
  }
}

function paintMoss(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash(x * 0.17 + y * 0.05, 2)
      const n2 = hash(x * 0.41, y * 0.33)
      const n3 = hash(x * 0.09 + 4, y * 0.11)
      let r = 28 + n * 22 + n3 * 10
      let g = 48 + n * 36 + n2 * 18
      let b = 32 + n * 16
      if (n2 > 0.82) {
        r += 18
        g += 40
        b += 12
      }
      if (n3 > 0.93) {
        r = 70
        g = 120
        b = 90
      }
      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function paintIce(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash(x * 0.08, y * 0.08)
      const crack = Math.abs(Math.sin(x * 0.11 + y * 0.03) * Math.cos(y * 0.09)) < 0.04
      let r = 170 + n * 40
      let g = 196 + n * 36
      let b = 220 + n * 28
      if (crack) {
        r = 220
        g = 236
        b = 255
      }
      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function paintEmberStone(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash(x * 0.13, y * 0.15)
      const vein = Math.abs(Math.sin(x * 0.07 + y * 0.19) * Math.cos(y * 0.05)) < 0.06
      let r = 42 + n * 18
      let g = 22 + n * 10
      let b = 16 + n * 8
      if (vein) {
        r = 180 + n * 50
        g = 110 + n * 30
        b = 36
      }
      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function paintVoidTile(ctx: CanvasRenderingContext2D, size: number) {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash(x * 0.2, y * 0.2)
      const ring = Math.hypot(x - size / 2, y - size / 2) / (size / 2)
      const band = Math.abs(ring - 0.72) < 0.03
      let r = 18 + n * 10
      let g = 16 + n * 12
      let b = 32 + n * 18
      if (band) {
        r = 80
        g = 70
        b = 140
      }
      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function buildGrove(motes: Mote[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'hub-grove'
  addSky(g, '#0b2230', '#0a2a28', '#071410')
  addFloor(g, canvasTex(paintMoss, 256), 48)

  const clearing = new THREE.Mesh(
    new THREE.CircleGeometry(2.35, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1a3a2a,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  clearing.rotation.x = -Math.PI / 2
  clearing.position.y = 0.01
  clearing.receiveShadow = true
  g.add(clearing)

  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.92 })
  const canopyGeo = new THREE.ConeGeometry(0.72, 1.35, 7)
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0x164a38,
    roughness: 0.78,
    emissive: 0x0a3328,
    emissiveIntensity: 0.35,
  })
  const glowCanopyMat = new THREE.MeshStandardMaterial({
    color: 0x1a6a48,
    roughness: 0.7,
    emissive: 0x1dff8a,
    emissiveIntensity: 0.28,
  })
  const dummy = new THREE.Object3D()
  const spots = scatterRing(22, 3.8, 14, 1)
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length)
  const glowCaps = new THREE.InstancedMesh(canopyGeo, glowCanopyMat, spots.length)
  trunks.castShadow = true
  canopies.castShadow = true
  spots.forEach((p, i) => {
    const h = 1.6 + p.h * 2.4
    dummy.position.set(p.x, h * 0.5, p.z)
    dummy.scale.set(p.s, h, p.s)
    dummy.rotation.set(0, p.a, 0)
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    dummy.position.set(p.x, h + 0.35, p.z)
    dummy.scale.set(p.s * 1.35, 1.1 + p.h * 0.4, p.s * 1.35)
    dummy.updateMatrix()
    canopies.setMatrixAt(i, dummy.matrix)
    dummy.position.set(p.x, h + 1.05, p.z)
    dummy.scale.set(p.s * 0.85, 0.7, p.s * 0.85)
    dummy.updateMatrix()
    glowCaps.setMatrixAt(i, dummy.matrix)
  })
  trunks.instanceMatrix.needsUpdate = true
  canopies.instanceMatrix.needsUpdate = true
  glowCaps.instanceMatrix.needsUpdate = true
  g.add(trunks, canopies, glowCaps)

  const stemGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.28, 6)
  const stemMat = new THREE.MeshStandardMaterial({ color: 0xd8c8b0, roughness: 0.7 })
  const capGeo = new THREE.SphereGeometry(0.16, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  const capColors = [0x7dffb3, 0xc4b5fd, 0xffe08a]
  const mush = scatterRing(16, 1.7, 4.6, 7)
  mush.forEach((p, i) => {
    const col = capColors[i % capColors.length]!
    const capMat = new THREE.MeshStandardMaterial({
      color: col,
      emissive: col,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    })
    const stem = new THREE.Mesh(stemGeo, stemMat)
    const cap = new THREE.Mesh(capGeo, capMat)
    const s = 0.7 + p.s * 0.9
    stem.position.set(p.x, 0.14 * s, p.z)
    stem.scale.setScalar(s)
    cap.position.set(p.x, 0.28 * s, p.z)
    cap.scale.set(s * 1.4, s, s * 1.4)
    g.add(stem, cap)
  })

  const glow = glowSprite('rgba(180,255,210,0.95)', 'rgba(40,180,120,0.25)')
  addGlowBillboard(g, glow, 0, 4.8, -6.5, 7.5, 0xb8ffe0)
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8fff8, fog: false }),
  )
  moon.position.set(2.2, 7.4, -8.5)
  g.add(moon)
  const moonLight = new THREE.PointLight(0xb8ffe0, 1.1, 18, 1.6)
  moonLight.position.copy(moon.position)
  g.add(moonLight)

  const { mesh, mote } = makePoints(56, 0xc8ff9a, 0.055, (i, arr) => {
    const a = hash(i, 3) * Math.PI * 2
    const r = 1.2 + hash(i, 4) * 6
    arr[i * 3] = Math.sin(a) * r
    arr[i * 3 + 1] = 0.35 + hash(i, 5) * 2.4
    arr[i * 3 + 2] = Math.cos(a) * r
  })
  mote.kind = 'firefly'
  g.add(mesh)
  motes.push(mote)

  const rootMat = new THREE.MeshStandardMaterial({
    color: 0x1a6a48,
    emissive: 0x1dff8a,
    emissiveIntensity: 0.4,
    roughness: 0.55,
  })
  for (let i = 0; i < 5; i++) {
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.55 + i * 0.08, 0.018, 6, 18, Math.PI * 0.9), rootMat)
    const p = scatterRing(5, 2.1, 3.4, 20)[i]!
    torus.position.set(p.x, 0.04, p.z)
    torus.rotation.set(-Math.PI / 2.2, p.a, 0.2)
    g.add(torus)
  }
  return g
}

function paintAurora(ctx: CanvasRenderingContext2D, size: number) {
  ctx.clearRect(0, 0, size, size)
  const g = ctx.createLinearGradient(0, 0, 0, size)
  g.addColorStop(0, 'rgba(120,220,255,0)')
  g.addColorStop(0.25, 'rgba(120,255,210,0.55)')
  g.addColorStop(0.55, 'rgba(80,160,255,0.28)')
  g.addColorStop(1, 'rgba(40,80,180,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
}

function buildFrost(motes: Mote[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'hub-frost'
  addSky(g, '#1a3358', '#12243c', '#0a1424')
  addFloor(g, canvasTex(paintIce, 256), 48, 0xffffff, 0.22, 0.35)

  const ice = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 40),
    new THREE.MeshStandardMaterial({
      color: 0xd8eefc,
      roughness: 0.12,
      metalness: 0.55,
      envMapIntensity: 0.8,
    }),
  )
  ice.rotation.x = -Math.PI / 2
  ice.position.y = 0.012
  ice.receiveShadow = true
  g.add(ice)

  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6)
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a4450, roughness: 0.9 })
  const canopyGeo = new THREE.ConeGeometry(0.55, 1.6, 7)
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xdceaf8,
    roughness: 0.7,
    emissive: 0x8ab4d8,
    emissiveIntensity: 0.12,
  })
  const dummy = new THREE.Object3D()
  const spots = scatterRing(18, 4.2, 13, 4)
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length)
  spots.forEach((p, i) => {
    const h = 1.8 + p.h * 2.2
    dummy.position.set(p.x, h * 0.5, p.z)
    dummy.scale.set(p.s, h, p.s)
    dummy.rotation.y = p.a
    dummy.updateMatrix()
    trunks.setMatrixAt(i, dummy.matrix)
    dummy.position.set(p.x, h + 0.2, p.z)
    dummy.scale.set(p.s * 1.1, 1.2, p.s * 1.1)
    dummy.updateMatrix()
    canopies.setMatrixAt(i, dummy.matrix)
  })
  trunks.instanceMatrix.needsUpdate = true
  canopies.instanceMatrix.needsUpdate = true
  g.add(trunks, canopies)

  const auroraTex = canvasTex(paintAurora, 128)
  auroraTex.wrapS = auroraTex.wrapT = THREE.ClampToEdgeWrapping
  const auroraMat = new THREE.MeshBasicMaterial({
    map: auroraTex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  })
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(14, 6.5), auroraMat)
    plane.position.set(-4 + i * 4.2, 5.2, -10 + i * 0.6)
    plane.rotation.y = 0.18 * (i - 1)
    g.add(plane)
  }

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8f4ff, fog: false }),
  )
  moon.position.set(-3.4, 8.2, -9)
  g.add(moon)
  addGlowBillboard(g, glowSprite('rgba(220,240,255,0.9)', 'rgba(80,160,255,0.2)'), -3.4, 8.2, -9, 6.2, 0xc8e8ff)

  const { mesh, mote } = makePoints(90, 0xe8f4ff, 0.04, (i, arr) => {
    arr[i * 3] = (hash(i, 1) - 0.5) * 16
    arr[i * 3 + 1] = hash(i, 2) * 8
    arr[i * 3 + 2] = (hash(i, 3) - 0.5) * 16
  })
  mote.kind = 'snow'
  g.add(mesh)
  motes.push(mote)
  return g
}

function buildEmber(motes: Mote[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'hub-ember'
  addSky(g, '#4a2010', '#2a1008', '#120804')
  addFloor(g, canvasTex(paintEmberStone, 256), 40, 0xffffff, 0.82, 0.18)

  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.35, 0.12, 24),
    new THREE.MeshStandardMaterial({
      color: 0x3a2418,
      roughness: 0.55,
      metalness: 0.28,
      emissive: 0x4a1808,
      emissiveIntensity: 0.2,
    }),
  )
  dais.position.y = 0.04
  dais.receiveShadow = true
  g.add(dais)

  const colGeo = new THREE.CylinderGeometry(0.18, 0.22, 1, 8)
  const colMat = new THREE.MeshStandardMaterial({
    color: 0x4a3020,
    roughness: 0.7,
    metalness: 0.15,
  })
  const capGeo = new THREE.CylinderGeometry(0.28, 0.22, 0.12, 8)
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xc48a40,
    roughness: 0.4,
    metalness: 0.55,
    emissive: 0xff6a2a,
    emissiveIntensity: 0.25,
  })
  scatterRing(8, 3.1, 3.4, 2).forEach((p) => {
    const h = 1.4 + p.h * 1.6
    const col = new THREE.Mesh(colGeo, colMat)
    col.position.set(p.x, h * 0.5, p.z)
    col.scale.set(1, h, 1)
    col.castShadow = true
    const cap = new THREE.Mesh(capGeo, capMat)
    cap.position.set(p.x, h + 0.04, p.z)
    g.add(col, cap)
  })

  const archMat = new THREE.MeshStandardMaterial({
    color: 0x5a3824,
    roughness: 0.65,
    metalness: 0.2,
  })
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 8, 24, Math.PI), archMat)
  arch.position.set(0, 2.1, -3.4)
  arch.rotation.y = Math.PI
  g.add(arch)

  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.6),
    new THREE.MeshStandardMaterial({
      color: 0xff9040,
      emissive: 0xff6a2a,
      emissiveIntensity: 0.7,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
    }),
  )
  glass.position.set(0, 1.7, -3.55)
  g.add(glass)

  const { mesh, mote } = makePoints(70, 0xffb070, 0.045, (i, arr) => {
    const a = hash(i, 2) * Math.PI * 2
    const r = hash(i, 3) * 5
    arr[i * 3] = Math.sin(a) * r
    arr[i * 3 + 1] = 0.2 + hash(i, 4) * 3.2
    arr[i * 3 + 2] = Math.cos(a) * r
  })
  mote.kind = 'ember'
  g.add(mesh)
  motes.push(mote)
  return g
}

function buildStar(motes: Mote[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'hub-star'
  addSky(g, '#1a1440', '#100c28', '#070614')
  addFloor(g, canvasTex(paintVoidTile, 256), 36, 0xffffff, 0.7, 0.25)

  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(2.05, 2.2, 0.1, 32),
    new THREE.MeshStandardMaterial({
      color: 0x1c1638,
      roughness: 0.35,
      metalness: 0.45,
      emissive: 0x3a2a78,
      emissiveIntensity: 0.22,
    }),
  )
  pad.position.y = 0.03
  pad.receiveShadow = true
  g.add(pad)

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xc4b5fd,
    emissive: 0x67e8f9,
    emissiveIntensity: 0.45,
    roughness: 0.3,
    metalness: 0.6,
    side: THREE.DoubleSide,
  })
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.035, 8, 48), ringMat)
  ringA.rotation.x = Math.PI / 2.15
  ringA.position.y = 1.15
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(3.35, 0.028, 8, 48), ringMat)
  ringB.rotation.set(0.7, 0.4, 0.2)
  ringB.position.y = 1.55
  ringA.name = 'spin-a'
  ringB.name = 'spin-b'
  g.add(ringA, ringB)

  const shardGeo = new THREE.OctahedronGeometry(0.22)
  const shardMat = new THREE.MeshStandardMaterial({
    color: 0xa5f3fc,
    emissive: 0x67e8f9,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.5,
  })
  scatterRing(7, 4.4, 7.5, 9).forEach((p, i) => {
    const s = new THREE.Mesh(shardGeo, shardMat)
    s.position.set(p.x, 0.9 + p.h * 1.8, p.z)
    s.scale.setScalar(0.6 + p.s * 0.8)
    s.rotation.set(p.h, p.a, i)
    s.name = 'spin-shard'
    g.add(s)
  })

  const { mesh, mote } = makePoints(220, 0xe8e0ff, 0.035, (i, arr) => {
    const a = hash(i, 1) * Math.PI * 2
    const b = hash(i, 2) * Math.PI
    const r = 16 + hash(i, 3) * 10
    arr[i * 3] = Math.sin(b) * Math.cos(a) * r
    arr[i * 3 + 1] = Math.cos(b) * r * 0.55 + 4
    arr[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r
  })
  mote.kind = 'dust'
  g.add(mesh)
  motes.push(mote)
  return g
}

export function hubLights(id: HubThemeId): HubLights | null {
  if (id === 'studio') return null
  return LIGHTS[id]
}

export function createHubStage(): {
  root: THREE.Group
  setTheme: (id: HubThemeId) => void
  tick: (t: number, dt: number) => void
} {
  const root = new THREE.Group()
  root.name = 'hubStage'
  root.visible = false
  const motes: Mote[] = []
  const byId: Partial<Record<HubThemeId, THREE.Group>> = {
    grove: buildGrove(motes),
    frost: buildFrost(motes),
    ember: buildEmber(motes),
    star: buildStar(motes),
  }
  for (const g of Object.values(byId)) {
    if (!g) continue
    g.visible = false
    root.add(g)
  }

  const setTheme = (id: HubThemeId) => {
    for (const [k, g] of Object.entries(byId)) {
      if (g) g.visible = k === id
    }
    root.visible = id !== 'studio'
  }

  const tick = (t: number, dt: number) => {
    if (!root.visible) return
    for (const m of motes) {
      const pos = m.attr.array as Float32Array
      const n = pos.length / 3
      for (let i = 0; i < n; i++) {
        const sx = m.seeds[i * 3]!
        const sy = m.seeds[i * 3 + 1]!
        const sz = m.seeds[i * 3 + 2]!
        if (m.kind === 'firefly') {
          pos[i * 3] = m.base[i * 3]! + Math.sin(t * (0.6 + sx) + i) * 0.28
          pos[i * 3 + 1] = m.base[i * 3 + 1]! + Math.sin(t * 1.4 + i) * 0.22
          pos[i * 3 + 2] = m.base[i * 3 + 2]! + Math.cos(t * (0.5 + sz) + i) * 0.28
        } else if (m.kind === 'snow') {
          pos[i * 3 + 1] -= (0.35 + sy * 0.5) * dt
          pos[i * 3] += Math.sin(t * 0.4 + i) * dt * 0.15
          if (pos[i * 3 + 1]! < 0) pos[i * 3 + 1] = 8
        } else if (m.kind === 'ember') {
          pos[i * 3 + 1] += (0.45 + sy * 0.6) * dt
          pos[i * 3] += Math.sin(t * 1.2 + i) * dt * 0.12
          if (pos[i * 3 + 1]! > 4.2) pos[i * 3 + 1] = 0.15
        }
      }
      m.attr.needsUpdate = true
    }
    const star = byId.star
    if (star?.visible) {
      star.traverse((obj) => {
        if (obj.name === 'spin-a') obj.rotation.z += dt * 0.18
        if (obj.name === 'spin-b') obj.rotation.y += dt * 0.12
        if (obj.name === 'spin-shard') obj.rotation.y += dt * 0.35
      })
    }
  }

  setTheme('grove')
  return { root, setTheme, tick }
}

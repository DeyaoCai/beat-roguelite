import * as THREE from 'three'
import type { WeatherId } from '../../content/weather'
import type { FrameSnapshot } from './types'

type Drop = {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
}

const SPAN = 18
const SPAN2 = SPAN * 2

function wrap(v: number, c: number): number {
  let d = v - c
  if (d > SPAN) v -= SPAN2
  else if (d < -SPAN) v += SPAN2
  return v
}

function addMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  })
}

/**
 * Arena weather atmosphere (fog veil + particles). Render-only.
 */
export function createWeatherFx(scene: THREE.Scene) {
  const root = new THREE.Group()
  root.name = 'weatherFx'
  scene.add(root)

  const veilMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  })
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veilMat)
  veil.rotation.x = -Math.PI / 2
  veil.position.y = 0.03
  veil.visible = false
  root.add(veil)

  const rainGeo = new THREE.BoxGeometry(0.028, 0.72, 0.028)
  const rainMat = addMat(0x7dd3fc, 0.42)
  const snowGeo = new THREE.SphereGeometry(0.055, 5, 5)
  const snowMat = addMat(0xe0f2fe, 0.7)
  const emberGeo = new THREE.SphereGeometry(0.05, 5, 5)
  const emberMat = addMat(0xfb923c, 0.85)
  const dustGeo = new THREE.SphereGeometry(0.07, 5, 5)
  const dustMat = addMat(0xd6a15c, 0.45)
  const streakGeo = new THREE.BoxGeometry(0.04, 0.04, 0.9)
  const streakMat = addMat(0xe0f2fe, 0.28)
  const sparkGeo = new THREE.SphereGeometry(0.06, 5, 5)
  const sparkMat = addMat(0xc4b5fd, 0.8)

  const makePool = (n: number, geo: THREE.BufferGeometry, mat: THREE.Material): Drop[] => {
    const out: Drop[] = []
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      root.add(mesh)
      out.push({ mesh, vx: 0, vy: 0, vz: 0 })
    }
    return out
  }

  const rain = makePool(80, rainGeo, rainMat)
  const snow = makePool(56, snowGeo, snowMat)
  const embers = makePool(48, emberGeo, emberMat)
  const dust = makePool(64, dustGeo, dustMat)
  const streaks = makePool(40, streakGeo, streakMat)
  const sparks = makePool(36, sparkGeo, sparkMat)

  const boltGeo = new THREE.BoxGeometry(1, 1, 1)
  const bolts: THREE.Mesh[] = []
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(
      boltGeo,
      new THREE.MeshBasicMaterial({
        color: i % 2 ? 0xe9d5ff : 0xddd6fe,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    )
    mesh.visible = false
    root.add(mesh)
    bolts.push(mesh)
  }
  let boltT = 0
  let boltLife = 1

  let lastT = performance.now()
  let seeded = false
  let lastId: WeatherId | '' = ''

  const hidePool = (pool: Drop[]) => {
    for (const d of pool) d.mesh.visible = false
  }

  const hide = () => {
    veil.visible = false
    hidePool(rain)
    hidePool(snow)
    hidePool(embers)
    hidePool(dust)
    hidePool(streaks)
    hidePool(sparks)
    for (const b of bolts) b.visible = false
    lastId = ''
    seeded = false
  }

  const scatter = (pool: Drop[], px: number, pz: number, y0: number, y1: number) => {
    for (const d of pool) {
      d.mesh.position.set(px + (Math.random() - 0.5) * SPAN2, y0 + Math.random() * (y1 - y0), pz + (Math.random() - 0.5) * SPAN2)
    }
  }

  const confine = (d: Drop, px: number, pz: number, y0: number, y1: number) => {
    d.mesh.position.x = wrap(d.mesh.position.x, px)
    d.mesh.position.z = wrap(d.mesh.position.z, pz)
    if (d.mesh.position.y < y0) d.mesh.position.y = y1
    if (d.mesh.position.y > y1) d.mesh.position.y = y0
  }

  const sync = (snap: FrameSnapshot, playing: boolean) => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now
    if (!playing) {
      hide()
      return
    }

    const id = snap.weatherId
    const px = snap.player.x
    const pz = snap.player.z
    const wx = snap.windX
    const wz = snap.windZ
    const t = now * 0.001

    if (id !== lastId) {
      lastId = id
      seeded = false
      boltLife = 1
    }
    if (!seeded) {
      scatter(rain, px, pz, 1, 9)
      scatter(snow, px, pz, 0.4, 7)
      scatter(embers, px, pz, 0.15, 3.2)
      scatter(dust, px, pz, 0.2, 4)
      scatter(streaks, px, pz, 0.6, 4.2)
      scatter(sparks, px, pz, 0.3, 5)
      seeded = true
    }

    hidePool(rain)
    hidePool(snow)
    hidePool(embers)
    hidePool(dust)
    hidePool(streaks)
    hidePool(sparks)
    for (const b of bolts) b.visible = false
    veil.visible = id !== 'clear'
    const half = snap.arenaHalf * 2.15
    veil.scale.set(half, half, 1)
    veil.position.set(0, 0.03, 0)

    if (id === 'clear') {
      veil.visible = false
      return
    }

    if (id === 'rain') {
      veilMat.color.setHex(0x0284c7)
      veilMat.opacity = 0.07
      rainMat.opacity = 0.38 + 0.12 * Math.sin(t * 3)
      for (const d of rain) {
        d.mesh.visible = true
        d.mesh.position.x += wx * 2.4 * dt
        d.mesh.position.y -= 14 * dt
        d.mesh.position.z += wz * 2.4 * dt
        confine(d, px, pz, 0.08, 9.2)
      }
      return
    }

    if (id === 'frost') {
      veilMat.color.setHex(0x7dd3fc)
      veilMat.opacity = 0.09
      for (const d of snow) {
        d.mesh.visible = true
        d.mesh.position.x += (wx * 1.1 + Math.sin(t + d.mesh.position.z) * 0.35) * dt
        d.mesh.position.y -= 1.35 * dt
        d.mesh.position.z += (wz * 1.1 + Math.cos(t + d.mesh.position.x) * 0.35) * dt
        d.mesh.rotation.y += dt * 1.4
        const s = 0.7 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2 + d.mesh.position.x))
        d.mesh.scale.setScalar(s)
        confine(d, px, pz, 0.12, 7.2)
      }
      return
    }

    if (id === 'heat') {
      veilMat.color.setHex(0xea580c)
      veilMat.opacity = 0.1 + 0.04 * Math.sin(t * 1.8)
      for (const d of embers) {
        d.mesh.visible = true
        d.mesh.position.x += (Math.sin(t * 1.7 + d.mesh.position.z) * 0.55 + wx * 0.4) * dt
        d.mesh.position.y += (1.8 + (d.mesh.position.y % 1) * 0.6) * dt
        d.mesh.position.z += (Math.cos(t * 1.4 + d.mesh.position.x) * 0.55 + wz * 0.4) * dt
        const u = (d.mesh.position.y - 0.15) / 3.1
        d.mesh.scale.setScalar(0.7 + 0.8 * (1 - Math.abs(u - 0.4)))
        confine(d, px, pz, 0.12, 3.4)
      }
      return
    }

    if (id === 'dust') {
      veilMat.color.setHex(0xa16207)
      veilMat.opacity = 0.13
      for (const d of dust) {
        d.mesh.visible = true
        d.mesh.position.x += (wx * 3.2 + Math.sin(t * 0.8 + d.mesh.position.z) * 0.8) * dt
        d.mesh.position.y += Math.sin(t * 1.6 + d.mesh.position.x) * 0.35 * dt
        d.mesh.position.z += (wz * 3.2 + Math.cos(t * 0.7 + d.mesh.position.x) * 0.8) * dt
        d.mesh.scale.setScalar(0.8 + 0.7 * (0.5 + 0.5 * Math.sin(t + d.mesh.position.x)))
        confine(d, px, pz, 0.15, 4.2)
      }
      return
    }

    if (id === 'gale') {
      veilMat.color.setHex(0xbae6fd)
      veilMat.opacity = 0.06
      const yaw = Math.atan2(wx, wz)
      for (const d of streaks) {
        d.mesh.visible = true
        d.mesh.rotation.y = yaw
        d.mesh.position.x += wx * 11 * dt
        d.mesh.position.z += wz * 11 * dt
        d.mesh.position.y += Math.sin(t * 4 + d.mesh.position.x) * 0.15 * dt
        d.mesh.scale.set(1, 1, 1.15)
        confine(d, px, pz, 0.45, 4.4)
      }
      return
    }

    if (id === 'magnet') {
      veilMat.color.setHex(0xa78bfa)
      veilMat.opacity = 0.08 + 0.04 * Math.sin(t * 6)
      for (const d of sparks) {
        d.mesh.visible = true
        d.mesh.position.x += Math.sin(t * 8 + d.mesh.position.z * 0.4) * 1.8 * dt
        d.mesh.position.y += Math.sin(t * 5 + d.mesh.position.x) * 1.1 * dt
        d.mesh.position.z += Math.cos(t * 8 + d.mesh.position.x * 0.4) * 1.8 * dt
        const flash = 0.55 + 0.45 * Math.sin(t * 14 + d.mesh.position.x)
        d.mesh.scale.setScalar(0.6 + flash)
        confine(d, px, pz, 0.2, 5.2)
      }
      boltT += dt
      if (boltLife < 1) {
        boltLife = Math.min(1, boltLife + dt / 0.12)
        const u = 1 - boltLife
        for (let i = 0; i < bolts.length; i++) {
          const b = bolts[i]!
          b.visible = u > 0.05
          ;(b.material as THREE.MeshBasicMaterial).opacity = u * (i === 0 ? 0.7 : 0.35)
        }
      } else if (boltT > 1.05) {
        boltT = 0
        boltLife = 0
        const ax = px + (Math.random() - 0.5) * 10
        const az = pz + (Math.random() - 0.5) * 10
        const bx = ax + (Math.random() - 0.5) * 6
        const bz = az + (Math.random() - 0.5) * 6
        const y0 = 2.4 + Math.random() * 2.2
        const y1 = 0.4 + Math.random() * 1.2
        for (let i = 0; i < bolts.length; i++) {
          const b = bolts[i]!
          const k = i / Math.max(1, bolts.length - 1)
          const jitter = (i - 2) * 0.18
          const x0 = ax + (bx - ax) * Math.max(0, k - 0.12) + jitter * 0.3
          const z0 = az + (bz - az) * Math.max(0, k - 0.12)
          const x1 = ax + (bx - ax) * Math.min(1, k + 0.22) + jitter * 0.3
          const z1 = az + (bz - az) * Math.min(1, k + 0.22)
          const yy0 = y0 + (y1 - y0) * Math.max(0, k - 0.08)
          const yy1 = y0 + (y1 - y0) * Math.min(1, k + 0.22)
          const len = Math.hypot(x1 - x0, yy1 - yy0, z1 - z0) || 0.2
          b.position.set((x0 + x1) * 0.5, (yy0 + yy1) * 0.5, (z0 + z1) * 0.5)
          b.scale.set(0.07 + (i === 0 ? 0.05 : 0), 0.07, len)
          b.lookAt(x1, yy1, z1)
          b.visible = true
          ;(b.material as THREE.MeshBasicMaterial).opacity = i === 0 ? 0.85 : 0.4
        }
      }
    }
  }

  return { sync, hide }
}

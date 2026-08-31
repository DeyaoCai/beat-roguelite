import * as THREE from 'three'
import type { AuraAudio } from '../types'

export type { AuraAudio }

const HULL = 'outlineHull'
const AURA_FX = 'ssjAuraFx'
const AURA_VER = 23
const WAVE_SEGS = 256

let softDisc: THREE.CanvasTexture | null = null
let softStreak: THREE.CanvasTexture | null = null
let sigilTex: THREE.CanvasTexture | null = null

function discTex(): THREE.CanvasTexture {
  if (softDisc) return softDisc
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,0.15)')
  grd.addColorStop(0.45, 'rgba(200,230,255,0.08)')
  grd.addColorStop(0.75, 'rgba(255,220,180,0.12)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  softDisc = new THREE.CanvasTexture(c)
  softDisc.colorSpace = THREE.SRGBColorSpace
  return softDisc
}

function streakTex(): THREE.CanvasTexture {
  if (softStreak) return softStreak
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 128
  const g = c.getContext('2d')!
  const img = g.createImageData(32, 128)
  for (let y = 0; y < 128; y++) {
    const along = Math.sin((y / 127) * Math.PI)
    for (let x = 0; x < 32; x++) {
      const edge = Math.pow(Math.max(0, 1 - Math.abs(x - 16) / 16), 2.8)
      const i = (y * 32 + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255
      img.data[i + 3] = Math.round(edge * along * 255)
    }
  }
  g.putImageData(img, 0, 0)
  softStreak = new THREE.CanvasTexture(c)
  softStreak.colorSpace = THREE.SRGBColorSpace
  return softStreak
}

/** Center: treble clef + circular staff (reference sigil). */
function makeSigilTex(): THREE.CanvasTexture {
  if (sigilTex) return sigilTex
  const s = 256
  const c = document.createElement('canvas')
  c.width = c.height = s
  const g = c.getContext('2d')!
  g.clearRect(0, 0, s, s)
  const cx = s / 2
  const cy = s / 2

  // soft fill
  const fill = g.createRadialGradient(cx, cy, 10, cx, cy, 110)
  fill.addColorStop(0, 'rgba(255,255,255,0.2)')
  fill.addColorStop(0.6, 'rgba(180,210,255,0.08)')
  fill.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = fill
  g.beginPath()
  g.arc(cx, cy, 110, 0, Math.PI * 2)
  g.fill()

  // circular staff lines
  g.strokeStyle = 'rgba(220,235,255,0.55)'
  g.lineWidth = 2
  for (const r of [48, 62, 76, 90]) {
    g.beginPath()
    g.arc(cx, cy, r, 0, Math.PI * 2)
    g.stroke()
  }
  // tick marks
  g.strokeStyle = 'rgba(200,220,255,0.4)'
  g.lineWidth = 1.5
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 92, cy + Math.sin(a) * 92)
    g.lineTo(cx + Math.cos(a) * 104, cy + Math.sin(a) * 104)
    g.stroke()
  }

  // treble clef (stylized path)
  g.save()
  g.translate(cx - 6, cy + 8)
  g.scale(1.15, 1.15)
  g.strokeStyle = 'rgba(255,255,255,0.95)'
  g.fillStyle = 'rgba(255,255,255,0.9)'
  g.lineWidth = 5
  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.beginPath()
  g.moveTo(4, 55)
  g.bezierCurveTo(-18, 40, -16, 5, 8, -5)
  g.bezierCurveTo(28, -14, 32, 18, 10, 28)
  g.bezierCurveTo(-8, 36, -4, 8, 12, 0)
  g.bezierCurveTo(30, -10, 22, -48, 6, -58)
  g.bezierCurveTo(-2, -64, -2, -40, 6, -28)
  g.stroke()
  // clef bulb
  g.beginPath()
  g.arc(6, 48, 7, 0, Math.PI * 2)
  g.fill()
  g.restore()

  // warm petal hints
  g.strokeStyle = 'rgba(255,200,150,0.35)'
  g.lineWidth = 3
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20)
    g.quadraticCurveTo(
      cx + Math.cos(a + 0.4) * 55,
      cy + Math.sin(a + 0.4) * 55,
      cx + Math.cos(a) * 85,
      cy + Math.sin(a) * 85,
    )
    g.stroke()
  }

  sigilTex = new THREE.CanvasTexture(c)
  sigilTex.colorSpace = THREE.SRGBColorSpace
  return sigilTex
}

function disposeMesh(obj: THREE.Object3D): void {
  if (!(obj instanceof THREE.Mesh)) return
  const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
  for (const m of mats) m?.dispose?.()
}

function stripHulls(root: THREE.Object3D): void {
  const doomed: THREE.Object3D[] = []
  root.traverse((obj) => {
    if (obj.name === HULL || obj.name === 'outlineHullOuter' || obj.userData.isOutline) {
      doomed.push(obj)
    }
  })
  for (const obj of doomed) {
    obj.parent?.remove(obj)
    disposeMesh(obj)
  }
}

function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    for (const m of mats) m?.dispose?.()
  })
}

type Rise = {
  mesh: THREE.Mesh
  life: number
  max: number
  ang: number
  radius: number
  phase: number
}

/** Continuous circular waveform ribbon (reference outer 音浪). */
type WaveCoeffs = {
  /** spatial harmonics (lobe counts around the circle) */
  f1: number
  f2: number
  f3: number
  f4: number
  w1: number
  w2: number
  w3: number
  w4: number
  p2: number
  p3: number
  p4: number
  thrashA: number
  thrashB: number
  speedA: number
  speedB: number
  stepA: number
  stepB: number
  ampScale: number
  baseH: number
}

/**
 * r = baseR + (current − prev) × k
 * current is circular-smoothed so the ring reads as a continuous curve.
 */
/** Default if a ring omits k. */
const WAVE_DELTA_K = 2.4
/** Gaussian half-width (segs) + passes for round curve. */
const WAVE_SMOOTH_R = 6
const WAVE_SMOOTH_PASSES = 3
/** Ghost trail: keep last N radii, draw N times with fading opacity → 0. */
const WAVE_TRAIL_N = 8

type WaveRing = {
  /** Parent holding trail meshes (name e.g. waveMain). */
  group: THREE.Group
  /** trail[0] = newest … trail[N-1] = oldest (opacity → 0). */
  meshes: THREE.Mesh[]
  positions: Float32Array[]
  /** Ring buffer of per-seg radii. */
  history: Float32Array[]
  head: number
  /** Previous frame's per-seg level (for delta). */
  prev: Float32Array
  /** Scratch: current frame level / radii. */
  current: Float32Array
  scratch: Float32Array
  baseR: number
  k: number
  width: number
  opacity: number
  coeffs: WaveCoeffs
}

/** Circular Gaussian blur (wraps around the ring). */
function smoothCircular(src: Float32Array, dst: Float32Array, radius: number): void {
  const n = src.length
  const sigma = Math.max(0.8, radius * 0.45)
  const inv2s = 1 / (2 * sigma * sigma)
  for (let i = 0; i < n; i++) {
    let sum = 0
    let w = 0
    for (let d = -radius; d <= radius; d++) {
      const wt = Math.exp(-(d * d) * inv2s)
      sum += src[(i + d + n) % n]! * wt
      w += wt
    }
    dst[i] = sum / w
  }
}

function smoothInPlace(buf: Float32Array, scratch: Float32Array, radius: number, passes: number): void {
  let a = buf
  let b = scratch
  for (let p = 0; p < passes; p++) {
    smoothCircular(a, b, radius)
    const t = a
    a = b
    b = t
  }
  if (a !== buf) {
    buf.set(a)
  }
}

function writeRadiiToPos(radii: Float32Array, pos: Float32Array, width: number): void {
  const segs = radii.length
  const half = Math.max(0.01, width * 0.5)
  for (let i = 0; i < segs; i++) {
    const i1 = (i + 1) % segs
    const a0 = (i / segs) * Math.PI * 2
    const a1 = (i1 / segs) * Math.PI * 2
    const r0 = radii[i]!
    const r1 = radii[i1]!
    const xIn0 = Math.cos(a0) * (r0 - half)
    const yIn0 = Math.sin(a0) * (r0 - half)
    const xOut0 = Math.cos(a0) * (r0 + half)
    const yOut0 = Math.sin(a0) * (r0 + half)
    const xIn1 = Math.cos(a1) * (r1 - half)
    const yIn1 = Math.sin(a1) * (r1 - half)
    const xOut1 = Math.cos(a1) * (r1 + half)
    const yOut1 = Math.sin(a1) * (r1 + half)
    const b = i * 18
    pos[b] = xIn0
    pos[b + 1] = yIn0
    pos[b + 2] = 0
    pos[b + 3] = xOut0
    pos[b + 4] = yOut0
    pos[b + 5] = 0
    pos[b + 6] = xOut1
    pos[b + 7] = yOut1
    pos[b + 8] = 0
    pos[b + 9] = xIn0
    pos[b + 10] = yIn0
    pos[b + 11] = 0
    pos[b + 12] = xOut1
    pos[b + 13] = yOut1
    pos[b + 14] = 0
    pos[b + 15] = xIn1
    pos[b + 16] = yIn1
    pos[b + 17] = 0
  }
}

function makeWaveRing(
  baseR: number,
  width: number,
  color: number,
  opacity: number,
  coeffs: WaveCoeffs,
  k = WAVE_DELTA_K,
): WaveRing {
  const segs = WAVE_SEGS
  const vCount = segs * 6
  const n = WAVE_TRAIL_N
  const group = new THREE.Group()
  const meshes: THREE.Mesh[] = []
  const positions: Float32Array[] = []
  const history: Float32Array[] = []
  for (let t = 0; t < n; t++) {
    const pos = new Float32Array(vCount * 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: opacity * (1 - t / Math.max(1, n - 1)),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.04
    mesh.frustumCulled = false
    // older ghosts behind
    mesh.renderOrder = -1 - t
    group.add(mesh)
    meshes.push(mesh)
    positions.push(pos)
    const hist = new Float32Array(segs)
    hist.fill(baseR)
    history.push(hist)
  }
  return {
    group,
    meshes,
    positions,
    history,
    head: 0,
    prev: new Float32Array(segs),
    current: new Float32Array(segs),
    scratch: new Float32Array(segs),
    baseR,
    k,
    width,
    opacity,
    coeffs,
  }
}

/** Per-segment level from FFT only — no synth / thrash. */
function sampleWave(
  i: number,
  segs: number,
  _phase: number,
  _t: number,
  _boost: number,
  _impact: number,
  c: WaveCoeffs,
  spectrum?: Float32Array,
): number {
  if (!spectrum || spectrum.length === 0) return 0
  const u = i / segs
  const n = spectrum.length
  const f = u * (n - 1)
  const i0 = Math.floor(f)
  const i1 = Math.min(n - 1, i0 + 1)
  const fr = f - i0
  const s = fr * fr * (3 - 2 * fr)
  const audio = spectrum[i0]! * (1 - s) + spectrum[i1]! * s
  return Math.pow(Math.max(0, audio), 0.82) * c.ampScale
}

function writeWave(
  w: WaveRing,
  phase: number,
  t: number,
  boost: number,
  impact: number,
  spectrum?: Float32Array,
  flashMul = 1,
): void {
  const segs = w.current.length
  const { current, prev, scratch } = w
  const k = w.k
  for (let i = 0; i < segs; i++) {
    current[i] = sampleWave(i, segs, phase, t, boost, impact, w.coeffs, spectrum)
  }
  smoothInPlace(current, scratch, WAVE_SMOOTH_R, WAVE_SMOOTH_PASSES)

  // this frame's radii → history
  const radii = scratch
  for (let i = 0; i < segs; i++) {
    radii[i] = Math.max(0.12, w.baseR + (current[i]! - prev[i]!) * k)
  }
  prev.set(current)
  w.history[w.head]!.set(radii)
  const head = w.head
  const n = WAVE_TRAIL_N
  const denom = Math.max(1, n - 1)

  for (let age = 0; age < n; age++) {
    const histIdx = (head - age + n) % n
    const op = w.opacity * flashMul * (1 - age / denom)
    const mesh = w.meshes[age]!
    const mat = mesh.material as THREE.MeshBasicMaterial
    mat.opacity = Math.max(0, op)
    mesh.visible = op > 0.001
    writeRadiiToPos(w.history[histIdx]!, w.positions[age]!, w.width)
    const pa = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    pa.needsUpdate = true
    const geo = mesh.geometry
    if (!geo.boundingSphere) geo.computeBoundingSphere()
    if (geo.boundingSphere) {
      geo.boundingSphere.center.set(0, 0, 0)
      geo.boundingSphere.radius = w.baseR + Math.abs(k) * 2 + w.width + 0.5
    }
  }
  w.head = (head + 1) % n
}

type Shock = { mesh: THREE.Mesh; life: number; max: number }

function spawnShock(shocks: Shock[], boost: number): void {
  const idle = shocks.find((s) => s.life >= s.max)
  if (!idle) return
  idle.life = 0
  idle.max = 0.16 + 0.04 * Math.min(1.5, boost)
  idle.mesh.visible = true
  idle.mesh.scale.setScalar(0.3)
  ;(idle.mesh.material as THREE.MeshBasicMaterial).opacity = 0.95
}

function ensureAuraFx(root: THREE.Object3D): THREE.Group {
  let fx = root.getObjectByName(AURA_FX) as THREE.Group | undefined
  if (fx && fx.userData.ver !== AURA_VER) {
    root.remove(fx)
    disposeObject(fx)
    fx = undefined
  }
  if (fx) return fx

  fx = new THREE.Group()
  fx.name = AURA_FX
  fx.userData.ssjAura = true
  fx.userData.ver = AURA_VER
  fx.userData.t = 0
  fx.userData.boost = 1

  // soft floor bloom
  const groundMat = new THREE.MeshBasicMaterial({
    map: discTex(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  })
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), groundMat)
  ground.name = 'ssjGround'
  ground.rotation.x = -Math.PI / 2
  ground.position.y = 0.02
  ground.renderOrder = -4
  fx.add(ground)

  // center sigil
  const sigilMat = new THREE.MeshBasicMaterial({
    map: makeSigilTex(),
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  })
  const sigil = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), sigilMat)
  sigil.name = 'ssjSigil'
  sigil.rotation.x = -Math.PI / 2
  sigil.position.y = 0.045
  sigil.renderOrder = -2
  fx.add(sigil)

  // outer waveform — denser nodes; each ring has different harmonic coeffs
  const waveMain = makeWaveRing(0.82, 0.026, 0xffffff, 1, {
    f1: 16,
    f2: 11,
    f3: 23,
    f4: 7,
    w1: 0.38,
    w2: 0.28,
    w3: 0.2,
    w4: 0.14,
    p2: 0.6,
    p3: 1.4,
    p4: 2.1,
    thrashA: 0.28,
    thrashB: 0.22,
    speedA: 17,
    speedB: 25,
    stepA: 0.37,
    stepB: 0.29,
    ampScale: 1.05,
    baseH: 0.13,
  }, 2.8)
  waveMain.group.name = 'waveMain'
  fx.add(waveMain.group)
  fx.userData.waveMain = waveMain

  // rising mist strands
  const streak = streakTex()
  const rises: Rise[] = []
  for (let i = 0; i < 8; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: streak,
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.75), mat)
    mesh.visible = false
    mesh.renderOrder = -1
    fx.add(mesh)
    rises.push({
      mesh,
      life: (i / 8) * 0.9,
      max: 0.9,
      ang: (i / 8) * Math.PI * 2,
      radius: 0.4,
      phase: i * 1.1,
    })
  }
  fx.userData.rises = rises

  // fast expanding shock rings on beat
  const shocks: Shock[] = []
  for (let i = 0; i < 4; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: discTex(),
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.y = 0.05
    mesh.visible = false
    mesh.renderOrder = -1
    fx.add(mesh)
    shocks.push({ mesh, life: 1, max: 0.18 })
  }
  fx.userData.shocks = shocks
  fx.userData.impact = 0
  fx.userData.lastPhase = 0

  root.add(fx)
  writeWave(waveMain, 0, 0, 1, 0)
  return fx
}

export function syncAvatarOutlines(root: THREE.Object3D): void {
  stripHulls(root)
  ensureAuraFx(root)
}

export function setAvatarOutline(
  root: THREE.Object3D,
  color: number,
  width: number,
): void {
  const boost = Math.max(0.55, Math.min(2.0, width / 0.014))
  const fx = ensureAuraFx(root)
  fx.userData.boost = boost
  fx.userData.color = color
  const hurt = color === 0xfb7185

  const tintRing = (key: string, hex: number, op: number) => {
    const ring = fx.userData[key] as WaveRing | undefined
    if (!ring) return
    ring.opacity = op
    for (const m of ring.meshes) {
      if (m.material instanceof THREE.MeshBasicMaterial) {
        m.material.color.setHex(hex)
      }
    }
  }
  tintRing('waveMain', hurt ? 0xfb7185 : 0xffffff, hurt ? 0.85 : 1)

  const ground = fx.getObjectByName('ssjGround') as THREE.Mesh | undefined
  if (ground?.material instanceof THREE.MeshBasicMaterial) {
    ground.material.color.setHex(hurt ? 0xfb7185 : 0xffffff)
    ground.material.opacity = 0.55 + 0.25 * boost
  }
}

export function tickAvatarAura(
  root: THREE.Object3D,
  dt: number,
  beatPhase?: number,
  audio?: AuraAudio,
): void {
  const fx = root.getObjectByName(AURA_FX) as THREE.Group | undefined
  if (!fx) return
  const boost = (fx.userData.boost as number) || 1
  fx.userData.t = ((fx.userData.t as number) || 0) + dt
  const t = fx.userData.t as number
  const phase = beatPhase ?? ((t * 2.8) % 1)
  const spectrum = audio?.spectrum
  const bass = audio?.bass ?? 0
  const energy = audio?.energy ?? 0

  const last = fx.userData.lastPhase as number
  fx.userData.lastPhase = phase
  const hit = last !== undefined && (phase + 0.2 < last || (last < 0.08 && phase >= 0.08))
  const halfHit =
    last !== undefined &&
    ((last < 0.5 && phase >= 0.5) || (last < 0.25 && phase >= 0.25) || (last < 0.75 && phase >= 0.75))
  // co_der-player shock-style: slam on beat OR bass punch
  const bassHit = bass > 0.42 && bass > ((fx.userData.lastBass as number) || 0) + 0.08
  fx.userData.lastBass = bass
  if (hit || bassHit) {
    fx.userData.impact = Math.max(fx.userData.impact as number, bassHit ? 0.85 + bass * 0.4 : 1)
    spawnShock(fx.userData.shocks as Shock[], boost)
    if (boost > 1.2 || bass > 0.55) spawnShock(fx.userData.shocks as Shock[], boost)
  } else if (halfHit) {
    fx.userData.impact = Math.max(fx.userData.impact as number, 0.55)
    spawnShock(fx.userData.shocks as Shock[], boost * 0.7)
  }
  fx.userData.impact = Math.max(0, (fx.userData.impact as number) - dt / 0.09)
  const impact = Math.max(fx.userData.impact as number, bass * 0.55 + energy * 0.25)

  const waveMain = fx.userData.waveMain as WaveRing | undefined
  const flash = 1 + impact * 0.35
  if (waveMain) writeWave(waveMain, phase, t, boost, impact, spectrum, Math.min(1.25, flash))

  const sigil = fx.getObjectByName('ssjSigil')
  if (sigil) {
    sigil.rotation.z = 0
    sigil.scale.setScalar(1 + impact * 0.28 * boost)
    if (sigil instanceof THREE.Mesh && sigil.material instanceof THREE.MeshBasicMaterial) {
      sigil.material.opacity = 0.8 + impact * 0.2
    }
  }

  const ground = fx.getObjectByName('ssjGround')
  if (ground) {
    ground.scale.setScalar(1 + impact * 0.35 * boost)
    if (ground instanceof THREE.Mesh && ground.material instanceof THREE.MeshBasicMaterial) {
      ground.material.opacity = (0.5 + 0.25 * boost) * (0.75 + impact * 0.5)
    }
  }

  const shocks = fx.userData.shocks as Shock[] | undefined
  if (shocks) {
    for (const s of shocks) {
      if (s.life >= s.max) {
        s.mesh.visible = false
        continue
      }
      s.life += dt
      const u = Math.min(1, s.life / s.max)
      const r = 0.4 + u * (2.2 + 0.6 * boost)
      s.mesh.visible = true
      s.mesh.scale.setScalar(r)
      ;(s.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - u) * (0.85 + 0.15 * boost)
    }
  }

  const rises = fx.userData.rises as Rise[] | undefined
  if (!rises) return
  for (const s of rises) {
    s.life += dt
    if (s.life >= s.max) {
      s.life = 0
      s.max = 0.22 + Math.random() * 0.2
      s.ang = Math.random() * Math.PI * 2
      s.radius = 0.35 + Math.random() * 0.4
      s.phase = Math.random() * Math.PI * 2
    }
    const u = s.life / s.max
    const y = 0.1 + u * (1.35 + 0.4 * boost)
    s.mesh.visible = true
    s.mesh.position.set(Math.cos(s.ang) * s.radius, y, Math.sin(s.ang) * s.radius)
    s.mesh.rotation.y = s.ang + Math.PI * 0.5
    const fade = u < 0.08 ? u / 0.08 : u > 0.55 ? (1 - u) / 0.45 : 1
    ;(s.mesh.material as THREE.MeshBasicMaterial).opacity =
      fade * (0.5 + 0.3 * boost + impact * 0.35)
  }
}

import * as THREE from 'three'
import type { JudgeResult } from '../../domain/rhythm/judge'
import type { FrameSnapshot } from './types'
import { highwayLayout } from './highwayLayout'

type NoteMesh = THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshStandardMaterial>
type TrailMesh = THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshBasicMaterial>

type FxParticle = {
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  vx: number
  vy: number
  life: number
  maxLife: number
  drag: number
}

type FxRing = {
  mesh: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  life: number
  maxLife: number
  maxScale: number
}

/**
 * Screen-space Three.js rhythm highway + judge VFX (single rail).
 */
export type Highway3D = {
  resize: (cssW: number, cssH: number) => void
  sync: (snap: FrameSnapshot) => void
  render: (gl: THREE.WebGLRenderer) => void
  fxRoot: THREE.Group
}

const NOTE_COLOR = 0xe8a04a
const TRAIL_SEGS = 5

export function createHighway3D(): Highway3D {
  const uiScene = new THREE.Scene()
  const uiCam = new THREE.OrthographicCamera(0, 1, 0, 1, -100, 100)
  uiCam.position.z = 10

  const root = new THREE.Group()
  root.name = 'highway3d'
  uiScene.add(root)

  const ambient = new THREE.AmbientLight(0xffffff, 0.85)
  uiScene.add(ambient)
  const key = new THREE.DirectionalLight(0xffffff, 1.15)
  key.position.set(0.2, 1.0, 2.4)
  uiScene.add(key)

  // Slim vertical rail panel (not a wide 3-lane box).
  const panelMat = new THREE.MeshStandardMaterial({
    color: 0x1c120c,
    transparent: true,
    opacity: 0.62,
    roughness: 0.88,
    metalness: 0.08,
    depthWrite: false,
  })
  const railBg = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), panelMat)
  railBg.position.z = -2
  root.add(railBg)

  const grooveMat = new THREE.MeshBasicMaterial({
    color: 0x1c120c,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const groove = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), grooveMat)
  groove.position.z = -1.6
  root.add(groove)

  // Chrome side rails
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0x8a6240,
    emissive: 0x3a2414,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.85,
  })
  const leftRail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), chromeMat)
  const rightRail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), chromeMat)
  leftRail.position.z = -0.8
  rightRail.position.z = -0.8
  root.add(leftRail, rightRail)

  const progressTrack = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 }),
  )
  progressTrack.position.z = -1
  root.add(progressTrack)

  const progressFill = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: 0xe8a04a, transparent: true, opacity: 0.95 }),
  )
  progressFill.position.z = -0.9
  root.add(progressFill)

  const laneFlashMat = new THREE.MeshBasicMaterial({
    color: NOTE_COLOR,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const laneFlash = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), laneFlashMat)
  laneFlash.position.z = -1.2
  root.add(laneFlash)

  // Receptor pad at judge line
  const receptorMat = new THREE.MeshStandardMaterial({
    color: 0x3a2414,
    emissive: 0xc4783a,
    emissiveIntensity: 0.4,
    roughness: 0.4,
    metalness: 0.35,
  })
  const receptor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), receptorMat)
  receptor.position.z = -0.2
  root.add(receptor)

  const judgeMat = new THREE.MeshStandardMaterial({
    color: 0xe8a04a,
    emissive: 0xe8a04a,
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.4,
  })
  const judgeLine = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), judgeMat)
  judgeLine.position.z = 0.2
  root.add(judgeLine)

  const flashPlateMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const flashPlate = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), flashPlateMat)
  flashPlate.position.z = 0.5
  root.add(flashPlate)

  const labelSprite = makeTextSprite('Space')
  root.add(labelSprite)

  const titleSprite = makeTextSprite('TRACK', 256, 48)
  root.add(titleSprite)

  const judgeSprite = makeTextSprite('', 256, 64)
  judgeSprite.visible = false
  root.add(judgeSprite)

  // Capsule notes — horizontal pills falling down the rail.
  const noteGeo = new THREE.CapsuleGeometry(0.5, 1.2, 6, 12)
  noteGeo.rotateZ(Math.PI / 2)

  const notePool: NoteMesh[] = []
  const trailPool: TrailMesh[][] = []
  const glowPool: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = []

  const ensureNotes = (n: number) => {
    while (notePool.length < n) {
      const mat = new THREE.MeshStandardMaterial({
        color: NOTE_COLOR,
        emissive: NOTE_COLOR,
        emissiveIntensity: 0.7,
        roughness: 0.28,
        metalness: 0.35,
        transparent: true,
      })
      const mesh = new THREE.Mesh(noteGeo, mat)
      mesh.visible = false
      root.add(mesh)
      notePool.push(mesh)

      const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          color: NOTE_COLOR,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      )
      glow.visible = false
      root.add(glow)
      glowPool.push(glow)

      const segs: TrailMesh[] = []
      for (let s = 0; s < TRAIL_SEGS; s++) {
        const trail = new THREE.Mesh(
          noteGeo,
          new THREE.MeshBasicMaterial({
            color: NOTE_COLOR,
            transparent: true,
            opacity: 0.2,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        )
        trail.visible = false
        root.add(trail)
        segs.push(trail)
      }
      trailPool.push(segs)
    }
  }

  const fxRoot = new THREE.Group()
  fxRoot.name = 'highwayFx'
  root.add(fxRoot)

  const sparkGeo = new THREE.SphereGeometry(1, 8, 8)
  const ringGeo = new THREE.RingGeometry(0.4, 0.62, 32)
  const particles: FxParticle[] = []
  const rings: FxRing[] = []
  const sparkPool: FxParticle['mesh'][] = []
  const ringPool: FxRing['mesh'][] = []

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
    fxRoot.add(mesh)
    return mesh
  }
  const takeRing = () => {
    const mesh =
      ringPool.pop() ??
      new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        }),
      )
    fxRoot.add(mesh)
    return mesh
  }

  let layout = {
    x0: 0,
    y0: 0,
    panelW: 96,
    panelH: 400,
    cx: 48,
    topY: 0,
    judgeY: 0,
  }
  let lastTitle = ''
  let lastKeyLabel = ''
  let lastJudgeLabel = ''
  let lastJudgeSeq = 0
  let plateLife = 0
  let plateMax = 0.28
  let plateColor = 0xffffff
  let lastT = performance.now()

  const spawnJudgeFx = (result: JudgeResult) => {
    const { cx, judgeY } = layout
    const color =
      result === 'miss' ? 0xfb7185 : result === 'perfect' ? 0xfde047 : 0xe8a04a
    plateColor = color
    plateLife = result === 'perfect' ? 0.34 : 0.26
    plateMax = plateLife
    flashPlate.position.set(cx, judgeY, 0.5)

    const count = result === 'perfect' ? 20 : result === 'good' ? 12 : 8
    const speed = result === 'miss' ? 100 : 160
    for (let i = 0; i < count; i++) {
      const mesh = takeSpark()
      mesh.material.color.setHex(color)
      mesh.material.opacity = 1
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.35
      const sp = speed * (0.4 + Math.random() * 0.85)
      mesh.position.set(cx + (Math.random() - 0.5) * 6, judgeY, 9)
      mesh.scale.setScalar(result === 'perfect' ? 3.2 + Math.random() * 2 : 2.2 + Math.random() * 1.6)
      mesh.visible = true
      particles.push({
        mesh,
        vx: Math.cos(ang) * sp * (result === 'miss' ? 0.5 : 1),
        vy: Math.sin(ang) * sp * 0.42 - 12,
        life: result === 'perfect' ? 0.48 : 0.34,
        maxLife: result === 'perfect' ? 0.48 : 0.34,
        drag: 1.8 + Math.random(),
      })
    }

    const ringCount = result === 'perfect' ? 2 : 1
    for (let r = 0; r < ringCount; r++) {
      const ring = takeRing()
      ring.material.color.setHex(color)
      ring.material.opacity = 0.9 - r * 0.25
      ring.position.set(cx, judgeY, 7 - r)
      ring.scale.set(8 + r * 3, 8 + r * 3, 1)
      ring.visible = true
      rings.push({
        mesh: ring,
        life: (result === 'perfect' ? 0.4 : 0.28) + r * 0.06,
        maxLife: (result === 'perfect' ? 0.4 : 0.28) + r * 0.06,
        maxScale: (result === 'perfect' ? 52 : result === 'good' ? 40 : 30) + r * 10,
      })
    }
  }

  const tickFx = (dt: number) => {
    if (plateLife > 0) {
      plateLife = Math.max(0, plateLife - dt)
      const u = plateLife / plateMax
      flashPlateMat.color.setHex(plateColor)
      flashPlateMat.opacity = u * u * 0.55
      flashPlate.scale.set(layout.panelW * (0.85 + (1 - u) * 0.55), 16 + (1 - u) * 36, 1)
    } else {
      flashPlateMat.opacity = 0
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!
      p.life -= dt
      if (p.life <= 0) {
        p.mesh.visible = false
        fxRoot.remove(p.mesh)
        sparkPool.push(p.mesh)
        particles.splice(i, 1)
        continue
      }
      const t = p.life / p.maxLife
      p.vx *= Math.max(0, 1 - p.drag * dt)
      p.vy *= Math.max(0, 1 - p.drag * 0.6 * dt)
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.vy += 260 * dt
      p.mesh.material.opacity = t * t
      const s = Math.max(0.4, p.mesh.scale.x * (1 - 1.6 * dt))
      p.mesh.scale.setScalar(s)
    }

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!
      r.life -= dt
      if (r.life <= 0) {
        r.mesh.visible = false
        fxRoot.remove(r.mesh)
        ringPool.push(r.mesh)
        rings.splice(i, 1)
        continue
      }
      const u = 1 - r.life / r.maxLife
      const ease = 1 - (1 - u) * (1 - u)
      const s = 8 + (r.maxScale - 8) * ease
      r.mesh.scale.set(s, s, 1)
      r.mesh.material.opacity = (1 - u) * 0.9
    }
  }

  const resize = (cssW: number, cssH: number) => {
    uiCam.left = 0
    uiCam.right = cssW
    uiCam.top = 0
    uiCam.bottom = cssH
    uiCam.updateProjectionMatrix()

    layout = highwayLayout(cssW, cssH)
    const { y0, panelW, panelH, cx, topY, judgeY } = layout

    const grooveW = panelW * 0.58
    railBg.position.set(cx, y0 + panelH / 2, -2)
    railBg.scale.set(panelW, panelH, 1)
    groove.position.set(cx, (topY + judgeY) / 2, -1.6)
    groove.scale.set(grooveW, judgeY - topY + 24, 1)

    const railThick = 3.2
    const railH = judgeY - topY + 28
    leftRail.position.set(cx - grooveW / 2 - railThick * 0.35, (topY + judgeY) / 2, -0.8)
    leftRail.scale.set(railThick, railH, 5)
    rightRail.position.set(cx + grooveW / 2 + railThick * 0.35, (topY + judgeY) / 2, -0.8)
    rightRail.scale.set(railThick, railH, 5)

    progressTrack.position.set(cx, y0 + 30, -1)
    progressTrack.scale.set(panelW - 14, 3.5, 1)

    laneFlash.position.set(cx, (topY + judgeY) / 2, -1.2)
    laneFlash.scale.set(grooveW, judgeY - topY + 18, 1)

    receptor.position.set(cx, judgeY, -0.2)
    receptor.scale.set(grooveW * 1.05, 14, 8)

    judgeLine.position.set(cx, judgeY, 0.2)
    judgeLine.scale.set(grooveW * 0.92, 3.5, 6)
    flashPlate.position.set(cx, judgeY, 0.5)

    labelSprite.position.set(cx, judgeY + 30, 1)
    labelSprite.scale.set(56, 22, 1)

    titleSprite.position.set(cx, y0 + 16, 1)
    titleSprite.scale.set(panelW * 1.35, 20, 1)
  }

  const sync = (snap: FrameSnapshot) => {
    const now = performance.now()
    const dt = Math.min(0.05, (now - lastT) / 1000)
    lastT = now

    const hw = snap.highway
    root.visible = snap.scene === 'play' && hw.visible
    tickFx(dt)
    if (!root.visible) return

    if (hw.songTitle && hw.songTitle !== lastTitle) {
      lastTitle = hw.songTitle
      setSpriteText(titleSprite, hw.songTitle.slice(0, 18))
    }

    const keyLabel = hw.labels[0] ?? 'Space'
    if (keyLabel !== lastKeyLabel) {
      lastKeyLabel = keyLabel
      setSpriteText(labelSprite, keyLabel, '#d4c4b0')
    }

    const { cx, panelW, topY, judgeY, x0 } = layout
    const fillW = Math.max(0.001, (panelW - 14) * hw.songProgress)
    progressFill.position.set(x0 + 7 + fillW / 2, layout.y0 + 30, -0.9)
    progressFill.scale.set(fillW, 3.5, 1)

    const pulse = hw.judgePulse
    const jr = hw.judgeResult
    const breathe = 0.5 + 0.5 * Math.sin(snap.beatPhase * Math.PI * 2)
    const grooveW = panelW * 0.58

    if (pulse > 0.05) {
      laneFlashMat.opacity = 0.14 + 0.48 * pulse
      laneFlashMat.color.setHex(
        jr === 'miss' ? 0xfb7185 : jr === 'perfect' ? 0xfde047 : 0xe8a04a,
      )
      const col = jr === 'miss' ? 0xfb7185 : jr === 'perfect' ? 0xfde047 : 0xe8a04a
      judgeMat.color.setHex(col)
      judgeMat.emissive.setHex(col)
      judgeMat.emissiveIntensity = 0.55 + 1.4 * pulse
      judgeLine.scale.set(grooveW * 0.92, 3.5 + 7 * pulse, 6)
      receptorMat.emissive.setHex(col)
      receptorMat.emissiveIntensity = 0.45 + 1.1 * pulse
    } else {
      laneFlashMat.opacity = 0.025 * breathe
      laneFlashMat.color.setHex(NOTE_COLOR)
      judgeMat.color.setHex(0xe8a04a)
      judgeMat.emissive.setHex(0xe8a04a)
      judgeMat.emissiveIntensity = 0.4 + 0.28 * breathe
      judgeLine.scale.set(grooveW * 0.92, 3.2 + breathe, 6)
      receptorMat.emissive.setHex(0xc4783a)
      receptorMat.emissiveIntensity = 0.35 + 0.2 * breathe
    }

    if (pulse > 0.05 && jr) {
      const tip = hw.timingHint
      const jLabel = tip
        ? `${jr.toUpperCase()} · ${tip.toUpperCase()}`
        : jr.toUpperCase()
      const fill =
        jr === 'miss' ? '#fb7185' : jr === 'perfect' ? '#fde047' : '#e8a04a'
      if (jLabel !== lastJudgeLabel) {
        setSpriteText(judgeSprite, jLabel, tip === 'early' ? '#c9a882' : tip === 'late' ? '#fb923c' : fill, true)
        lastJudgeLabel = jLabel
      }
      const s = 1 + 0.25 * pulse
      judgeSprite.position.set(cx, judgeY - 26, 4)
      judgeSprite.scale.set(tip ? 120 * s : 88 * s, 22 * s, 1)
      judgeSprite.material.opacity = 0.55 + 0.45 * pulse
      judgeSprite.visible = true
    } else {
      judgeSprite.visible = false
      lastJudgeLabel = ''
    }

    if (hw.judgeSeq !== lastJudgeSeq) {
      lastJudgeSeq = hw.judgeSeq
      if (jr) spawnJudgeFx(jr)
    }

    ensureNotes(hw.notes.length)
    for (let i = 0; i < notePool.length; i++) {
      const mesh = notePool[i]!
      const glow = glowPool[i]!
      const trails = trailPool[i]!
      const n = hw.notes[i]
      if (!n) {
        mesh.visible = false
        glow.visible = false
        for (const t of trails) t.visible = false
        continue
      }

      const yy = topY + (1 - Math.max(0, n.y)) * (judgeY - topY)
      const near = 1 - Math.min(1, Math.max(0, n.y))
      const punch = 1 + near * near * 0.28

      // Capsule scale: width along rail, thickness as height.
      let rw = grooveW * 0.78 * punch
      let rh = 11 * punch
      let color = NOTE_COLOR
      let opacity = 0.96
      let em = 0.6 + near * 0.55

      mesh.visible = true
      if (n.judged) {
        if (n.result === 'miss') {
          color = 0xfb7185
          opacity = 0.45
          em = 0.25
        } else if (n.result === 'perfect') {
          color = 0xfde047
          opacity = 0.92
          em = 1.4
          rw *= 1.22
          rh *= 1.4
        } else {
          color = 0xe8a04a
          opacity = 0.7
          em = 0.85
          rw *= 1.1
        }
      }

      // CapsuleGeometry unit size ~ diameter 1 + length; scale maps to screen px.
      mesh.position.set(cx, yy, 2)
      mesh.scale.set(rh * 0.55, rw * 0.42, rh * 0.55)
      const mat = mesh.material
      mat.color.setHex(color)
      mat.emissive.setHex(color)
      mat.emissiveIntensity = em
      mat.opacity = opacity

      glow.visible = !n.judged
      if (glow.visible) {
        glow.position.set(cx, yy, 1.2)
        glow.scale.set(rw * 1.35, rh * 2.4, 1)
        glow.material.color.setHex(color)
        glow.material.opacity = 0.16 + 0.38 * near
      }

      if (!n.judged && n.y > 0.015) {
        for (let s = 0; s < TRAIL_SEGS; s++) {
          const trail = trails[s]!
          const k = s + 1
          trail.visible = true
          trail.position.set(cx, yy - rh * 0.9 * k, 0.8 - s * 0.05)
          trail.scale.set(
            rh * 0.45 * (0.9 - s * 0.1),
            rw * 0.38 * (0.85 - s * 0.1),
            rh * 0.45 * (0.9 - s * 0.1),
          )
          trail.material.color.setHex(color)
          trail.material.opacity = (0.26 - s * 0.045) * (0.4 + 0.6 * n.y)
        }
      } else {
        for (const t of trails) t.visible = false
      }
    }
  }

  const render = (gl: THREE.WebGLRenderer) => {
    if (!root.visible && particles.length === 0 && rings.length === 0 && plateLife <= 0) return
    const prev = gl.autoClear
    gl.autoClear = false
    gl.clearDepth()
    gl.render(uiScene, uiCam)
    gl.autoClear = prev
  }

  return { resize, sync, render, fxRoot }
}

function makeTextSprite(text: string, tw = 128, th = 128): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = tw
  canvas.height = th
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, tw, th)
  ctx.fillStyle = '#f3ead8'
  ctx.font = `700 ${Math.floor(th * 0.55)}px Segoe UI, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, tw / 2, th / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
  })
  const spr = new THREE.Sprite(mat)
  ;(
    spr as THREE.Sprite & {
      userData: {
        canvas: HTMLCanvasElement
        ctx: CanvasRenderingContext2D
        tex: THREE.CanvasTexture
      }
    }
  ).userData = { canvas, ctx, tex }
  return spr
}

function setSpriteText(spr: THREE.Sprite, text: string, fill = '#b8a894', heavy = false) {
  const data = spr.userData as {
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    tex: THREE.CanvasTexture
  }
  const { canvas, ctx, tex } = data
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = fill
  ctx.font = heavy ? '800 36px Segoe UI, sans-serif' : '600 26px Segoe UI, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (heavy) {
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'
    ctx.lineWidth = 8
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  tex.needsUpdate = true
}

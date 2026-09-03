import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { paintHudLayer } from './hud2d'
import { drawDamageFloaters } from './damageFloaters'
import { drawOffscreenTrackers } from './offscreenTrack'
import { drawPlayPortraitChrome, playCamLayout } from './playPortrait'
import { createHighway3D } from './highway3d'
import { createCombatFx, starterAuraHex } from './combatFx'
import { createWeatherFx } from './weatherFx'
import { createHeroFigure, SKYRIM_FEMALE_ID, type Gait } from '../../figures'
import {
  createEnemyModelSlot,
  resolveEnemyVisualKind,
  setEnemyModelFlash,
  setEnemyModelKind,
  syncEnemyFx,
  type EnemyModelSlot,
} from './enemyModels'
import {
  createObstacleModelSlot,
  setObstacleModelKind,
  type ObstacleModelSlot,
  type ObstacleVisualKind,
} from './obstacleModels'
import {
  createPickupModelSlot,
  setPickupModelKind,
  type PickupModelSlot,
  type PickupVisualKind,
} from './pickupModels'
import { createGroundMaps, setGroundRepeat } from './groundTextures'
import { createHubStage, hubLights } from './hubStage'
import type { FrameSnapshot, Renderer } from './types'
import { PREVIEW_SHOTS, type PreviewShot } from '../../wardrobe/preview'
import { loadWardrobePersist, saveWardrobePersistSoon } from '../../wardrobe/session'
import { PLAY_VIEW_HALF } from '../../domain/combat/arena'

type PoolMesh = THREE.Mesh

/**
 * Orthographic top-down Three.js renderer.
 * Sim (x,z) → Three (x,z); Y is visual only.
 */
export type ThreeOrthoOpts = { figureId?: string }

export function createThreeOrthoRenderer(host: HTMLElement, opts: ThreeOrthoOpts = {}): Renderer {
  host.innerHTML = ''
  host.style.position = 'relative'
  host.style.width = '100%'
  host.style.height = '100%'
  host.style.overflow = 'hidden'

  const glCanvas = document.createElement('canvas')
  const hudCanvas = document.createElement('canvas')
  for (const c of [glCanvas, hudCanvas]) {
    c.style.position = 'absolute'
    c.style.inset = '0'
    c.style.width = '100%'
    c.style.height = '100%'
  }
  hudCanvas.style.pointerEvents = 'none'
  host.append(glCanvas, hudCanvas)

  const highway3d = createHighway3D()

  const hudCtx = hudCanvas.getContext('2d')
  if (!hudCtx) throw new Error('2d hud context unavailable')

  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    antialias: true,
    alpha: false,
  })
  renderer.setClearColor(0x1a120c, 1)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const pmrem = new THREE.PMREMGenerator(renderer)
  const studioEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  pmrem.dispose()

  const scene = new THREE.Scene()
  const combatFx = createCombatFx(scene)
  const weatherFx = createWeatherFx(scene)
  scene.background = new THREE.Color(0x1a120c)

  const playCam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 120)
  playCam.position.set(0, 44, 15)
  playCam.lookAt(0, 0, 0)

  /**
   * Title closet = glTF lookdev / UE Persona turntable:
   *   world Y-up meters, character at origin, feet on y=0
   *   orbit target = chest (derived from fitted height)
   *   UI composition = PerspectiveCamera.setViewOffset (do not translate the pawn)
   */
  const AVATAR_HEIGHT = 1.7
  const PREVIEW_FOV = 32
  let shot: PreviewShot = 'full'
  let chestRatio = PREVIEW_SHOTS.full.chestRatio
  let frameFill = PREVIEW_SHOTS.full.fill
  let chestGoal = chestRatio
  let fillGoal = frameFill
  let zoomGoal = PREVIEW_SHOTS.full.zoom
  let pitchGoal = PREVIEW_SHOTS.full.pitch
  let zoomUser = false
  let previewIdle = 0
  let previewT = performance.now()
  const previewCam = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.05, 40)
  const faceCam = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.05, 40)
  const radioCam = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.05, 40)
  const bustCam = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.05, 40)
  const fullCam = new THREE.PerspectiveCamera(PREVIEW_FOV, 1, 0.05, 40)
  const previewLook = new THREE.Vector3(0, AVATAR_HEIGHT * chestRatio, 0)
  const previewOrbit = {
    yaw: 0.55,
    pitch: PREVIEW_SHOTS.full.pitch,
    zoom: PREVIEW_SHOTS.full.zoom,
    dragging: false,
    lastX: 0,
    lastY: 0,
  }

  const PLAY_HEMI = 1.15
  const PLAY_DIR = 1.85
  const hemi = new THREE.HemisphereLight(0xe8c4a0, 0x3a2418, PLAY_HEMI)
  scene.add(hemi)
  const dir = new THREE.DirectionalLight(0xffc878, PLAY_DIR)
  dir.position.set(12, 28, 8)
  dir.castShadow = true
  dir.shadow.mapSize.set(1024, 1024)
  dir.shadow.bias = -0.00025
  dir.shadow.normalBias = 0.035
  // Default shadow cam is tiny (±5); expand + follow player each frame.
  const shadowSpan = 22
  dir.shadow.camera.left = -shadowSpan
  dir.shadow.camera.right = shadowSpan
  dir.shadow.camera.top = shadowSpan
  dir.shadow.camera.bottom = -shadowSpan
  dir.shadow.camera.near = 1
  dir.shadow.camera.far = 80
  dir.shadow.camera.updateProjectionMatrix()
  scene.add(dir)
  scene.add(dir.target)
  const rim = new THREE.DirectionalLight(0xc47848, 0.42)
  rim.position.set(-8, 6, -10)
  scene.add(rim)

  /**
   * Beauty / portrait key-fill-rim on the hero (short falloff).
   * Parent later onto playerScale so it tracks feet + play height.
   */
  const beautyRig = new THREE.Group()
  beautyRig.name = 'beautyRig'
  beautyRig.visible = false
  const beautyKey = new THREE.PointLight(0xfff1e4, 0.7, 3.8, 1.8)
  beautyKey.name = 'beautyKey'
  beautyKey.position.set(0.42, 1.45, 0.72)
  const beautyFill = new THREE.PointLight(0xe8c4a0, 0.28, 3.4, 1.8)
  beautyFill.name = 'beautyFill'
  beautyFill.position.set(-0.55, 1.2, 0.5)
  const beautyRim = new THREE.PointLight(0xc47848, 0.4, 3.6, 1.8)
  beautyRim.name = 'beautyRimL'
  beautyRim.position.set(-0.25, 1.55, -0.7)
  const beautyBounce = new THREE.PointLight(0xffe8dc, 0.14, 2.4, 2)
  beautyBounce.name = 'beautyBounce'
  beautyBounce.position.set(0.05, 0.4, 0.45)
  beautyRig.add(beautyKey, beautyFill, beautyRim, beautyBounce)

  const arenaGroup = new THREE.Group()
  scene.add(arenaGroup)

  // Full-viewport floor (covers black bars). Playable square is a lighter inset.
  const groundMaps = createGroundMaps()
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
  groundMaps.arenaMap.anisotropy = maxAniso
  groundMaps.arenaRough.anisotropy = maxAniso
  groundMaps.voidMap.anisotropy = maxAniso
  const voidMat = new THREE.MeshStandardMaterial({
    map: groundMaps.voidMap,
    color: 0xffffff,
    roughness: 1,
    metalness: 0,
  })
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundMaps.arenaMap,
    roughnessMap: groundMaps.arenaRough,
    color: 0xffffff,
    roughness: 1,
    metalness: 0.08,
  })
  const voidFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), voidMat)
  voidFloor.rotation.x = -Math.PI / 2
  voidFloor.position.y = -0.02
  voidFloor.receiveShadow = true
  voidFloor.visible = true
  arenaGroup.add(voidFloor)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  arenaGroup.add(ground)

  // Soft playable bound (thin guide only).
  const bound = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 0.02, 1)),
    new THREE.LineBasicMaterial({ color: 0x8a6240, transparent: true, opacity: 0.22 }),
  )
  bound.position.y = 0.04
  arenaGroup.add(bound)

  const previewStudio = new THREE.Group()
  previewStudio.name = 'previewStudio'
  previewStudio.visible = false

  const studioWallMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c14,
    roughness: 0.92,
    metalness: 0.04,
  })
  const studioFrameMat = new THREE.MeshStandardMaterial({
    color: 0x5a3c24,
    roughness: 0.55,
    metalness: 0.35,
  })

  const mirrorRes = Math.min(4096, Math.floor(1024 * Math.min(window.devicePixelRatio || 1, 2) * 2))
  const makeMirror = (w: number, h: number, tint = 0xf3ead8) =>
    new Reflector(new THREE.PlaneGeometry(w, h, 1, 1), {
      clipBias: 0.002,
      textureWidth: mirrorRes,
      textureHeight: mirrorRes,
      color: tint,
      multisample: 8,
    })

  // Matte floor only — no floor mirror
  const studioFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshStandardMaterial({
      color: 0x1c1410,
      roughness: 0.88,
      metalness: 0.06,
    }),
  )
  studioFloor.rotation.x = -Math.PI / 2
  studioFloor.position.y = 0
  studioFloor.receiveShadow = true
  previewStudio.add(studioFloor)

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.4), studioWallMat)
  backWall.position.set(0, 1.55, -2.35)
  backWall.receiveShadow = true
  previewStudio.add(backWall)

  const backFrame = new THREE.Mesh(new THREE.PlaneGeometry(3.95, 2.95), studioFrameMat)
  backFrame.position.set(0, 1.35, -2.32)
  previewStudio.add(backFrame)
  const backMirror = makeMirror(3.7, 2.7, 0xf3ead8)
  backMirror.position.set(0, 1.35, -2.275)
  previewStudio.add(backMirror)

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 3.4), studioWallMat)
  leftWall.position.set(-2.55, 1.55, -0.2)
  leftWall.rotation.y = Math.PI / 2
  leftWall.receiveShadow = true
  previewStudio.add(leftWall)

  const leftFrame = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.8), studioFrameMat)
  leftFrame.position.set(-2.52, 1.3, 0.15)
  leftFrame.rotation.y = Math.PI / 2
  previewStudio.add(leftFrame)
  const leftMirror = makeMirror(2.5, 2.6, 0xf0e4d0)
  leftMirror.position.set(-2.475, 1.3, 0.15)
  leftMirror.rotation.y = Math.PI / 2
  previewStudio.add(leftMirror)

  // Accent strip lights on mirror frames
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffc878,
    emissiveIntensity: 0.55,
    roughness: 1,
  })
  const addStrip = (x: number, y: number, z: number, w: number, h: number, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), stripMat)
    m.position.set(x, y, z)
    m.rotation.y = ry
    previewStudio.add(m)
  }
  addStrip(-1.85, 1.35, -2.275, 0.04, 2.55)
  addStrip(1.85, 1.35, -2.275, 0.04, 2.55)
  addStrip(-2.475, 1.3, -1.1, 0.04, 2.45, Math.PI / 2)
  addStrip(-2.475, 1.3, 1.35, 0.04, 2.45, Math.PI / 2)

  scene.add(previewStudio)

  const hubStage = createHubStage()
  scene.add(hubStage.root)

  const playerGeo = new THREE.CylinderGeometry(1, 1, 1.2, 20)
  const playerMat = new THREE.MeshStandardMaterial({
    color: 0xd4a06a,
    emissive: 0x3a2414,
    roughness: 0.45,
  })
  const playerPlaceholder = new THREE.Mesh(playerGeo, playerMat)
  playerPlaceholder.castShadow = true
  const playerRoot = new THREE.Group()
  playerRoot.name = 'playerRoot'
  const playerScale = new THREE.Group()
  playerScale.name = 'avatarScale'
  playerRoot.add(playerScale)
  playerScale.add(playerPlaceholder)
  playerScale.add(beautyRig)
  scene.add(playerRoot)

  const previewAxes = new THREE.AxesHelper(0.45)
  previewAxes.visible = false
  playerRoot.add(previewAxes)
  const previewGrid = new THREE.GridHelper(2.4, 8, 0x8a6240, 0x3a2418)
  previewGrid.visible = false
  playerRoot.add(previewGrid)
  const previewLookAxes = new THREE.AxesHelper(0.18)
  previewLookAxes.visible = false
  playerScale.add(previewLookAxes)
  let previewFov = PREVIEW_FOV
  let allowCamPersist = true

  const previewTune = document.createElement('div')
  previewTune.style.cssText = `
    display:none; position:absolute; left:16px; bottom:52px; z-index:21;
    width:min(320px, 42vw); max-height:min(48vh, 420px); overflow:auto;
    padding:10px 12px 12px; border-radius:10px;
    background:rgba(22,14,10,0.92); border:1px solid rgba(180,140,90,0.28);
    font:12px Segoe UI,PingFang SC,Microsoft YaHei,sans-serif; color:#d4c4b0;
    pointer-events:auto;
  `
  const tuneTitle = document.createElement('div')
  tuneTitle.style.cssText = 'font-weight:700;color:#f3ead8;margin-bottom:6px;'
  tuneTitle.textContent = '预览构图'
  const tuneAxesHint = document.createElement('div')
  tuneAxesHint.style.cssText = 'margin:0 0 8px;font-size:11px;color:#b8a894;'
  tuneAxesHint.textContent = '人物钉在原点脚底 · 镜头绕胸口转 · 衣橱用 viewOffset 让位'
  const tuneDump = document.createElement('pre')
  tuneDump.style.cssText =
    'margin:0 0 8px;font:11px/1.45 ui-monospace,Consolas,monospace;color:#e8a04a;white-space:pre-wrap;'
  previewTune.append(tuneTitle, tuneAxesHint, tuneDump)
  previewTune.addEventListener('wheel', (e) => e.stopPropagation())
  previewTune.addEventListener('keydown', (e) => e.stopPropagation())
  previewTune.addEventListener('keyup', (e) => e.stopPropagation())

  const tuneBinds: Array<{ input: HTMLInputElement; get: () => number; digits: number }> = []
  const inputCss = `
    width:64px;padding:3px 6px;border-radius:4px;
    border:1px solid rgba(180,140,90,0.35);background:#1a1008;color:#e8a04a;
    font:12px ui-monospace,Consolas,monospace;text-align:right;
  `
  const addField = (
    label: string,
    get: () => number,
    set: (v: number) => void,
    digits = 2,
  ) => {
    const row = document.createElement('label')
    row.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;'
    const name = document.createElement('span')
    name.textContent = label
    const text = document.createElement('input')
    text.type = 'text'
    text.inputMode = 'decimal'
    text.autocomplete = 'off'
    text.spellcheck = false
    text.value = get().toFixed(digits)
    text.style.cssText = inputCss.replace('width:64px', 'width:92px')
    const apply = () => {
      const v = Number(text.value.trim())
      if (!Number.isFinite(v)) return
      set(v)
    }
    text.addEventListener('input', apply)
    text.addEventListener('change', apply)
    row.append(name, text)
    previewTune.appendChild(row)
    tuneBinds.push({ input: text, get, digits })
  }
  addField(
    '胸口比例',
    () => chestRatio,
    (v) => {
      chestRatio = Math.max(0.2, Math.min(0.9, v))
    },
  )
  addField(
    '画面占比',
    () => frameFill,
    (v) => {
      frameFill = Math.max(0.4, Math.min(0.95, v))
    },
  )
  addField(
    '视野 FOV',
    () => previewFov,
    (v) => {
      previewFov = Math.max(18, Math.min(60, v))
    },
    1,
  )
  const syncTuneFields = () => {
    for (const b of tuneBinds) {
      if (document.activeElement === b.input) continue
      const next = b.get().toFixed(b.digits)
      if (b.input.value !== next) b.input.value = next
    }
  }
  host.appendChild(previewTune)

  let previewDebug = false
  const debugBtn = document.createElement('button')
  debugBtn.type = 'button'
  debugBtn.textContent = '构图'
  debugBtn.title = '~ 开关坐标轴和构图面板'
  debugBtn.style.cssText = `
    display:none; position:absolute; left:16px; bottom:16px; z-index:21;
    appearance:none; cursor:pointer; pointer-events:auto;
    padding:5px 10px; border-radius:8px; font:12px Segoe UI,PingFang SC,sans-serif;
    color:#d4c4b0; background:rgba(22,14,10,0.88);
    border:1px solid rgba(180,140,90,0.28);
  `
  const syncDebugUi = (onTitle: boolean) => {
    debugBtn.style.display = onTitle ? 'block' : 'none'
    debugBtn.style.borderColor = previewDebug
      ? 'rgba(232,160,74,0.85)'
      : 'rgba(180,140,90,0.28)'
    previewTune.style.display = onTitle && previewDebug ? 'block' : 'none'
    previewAxes.visible = onTitle && previewDebug
    previewLookAxes.visible = onTitle && previewDebug
    previewGrid.visible = onTitle && previewDebug
  }
  debugBtn.addEventListener('click', () => {
    previewDebug = !previewDebug
    syncDebugUi(true)
  })
  host.appendChild(debugBtn)
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote') return
    if (!previewInput) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    e.preventDefault()
    previewDebug = !previewDebug
    syncDebugUi(true)
  })

  const persistCam = () => {
    if (!allowCamPersist) return
    saveWardrobePersistSoon({
      shot,
      yaw: previewOrbit.yaw,
      pitch: previewOrbit.pitch,
      zoom: previewOrbit.zoom,
      fov: previewFov,
    })
  }

  const applyShot = (next: PreviewShot) => {
    shot = next
    const s = PREVIEW_SHOTS[next]
    chestGoal = s.chestRatio
    fillGoal = s.fill
    zoomGoal = s.zoom
    pitchGoal = s.pitch
    zoomUser = false
    persistCam()
  }

  const savedCam = loadWardrobePersist()
  if (savedCam?.shot && PREVIEW_SHOTS[savedCam.shot]) {
    shot = savedCam.shot
    const s = PREVIEW_SHOTS[savedCam.shot]
    chestRatio = s.chestRatio
    frameFill = s.fill
    chestGoal = s.chestRatio
    fillGoal = s.fill
    zoomGoal = s.zoom
    pitchGoal = s.pitch
    previewOrbit.pitch = s.pitch
    previewOrbit.zoom = s.zoom
  }
  if (typeof savedCam?.yaw === 'number') previewOrbit.yaw = savedCam.yaw
  if (typeof savedCam?.pitch === 'number') {
    previewOrbit.pitch = savedCam.pitch
    pitchGoal = savedCam.pitch
  }
  if (typeof savedCam?.zoom === 'number') {
    previewOrbit.zoom = savedCam.zoom
    zoomUser = true
  }
  if (typeof savedCam?.fov === 'number') previewFov = savedCam.fov

  let playerUsesModel = false
  let created = createHeroFigure({
    id: opts.figureId,
    getShot: () => shot,
    onShot: applyShot,
  })
  let figure = created.figure
  let wardrobe = created.wardrobe
  playerScale.add(figure.root)
  /** Look hydrate may finish mid-fight; force combat clip rebind. */
  let refreshCombatAnim = false
  let combatGait: Gait | null = null
  let lastCastSeq = 0
  let heroGen = 0
  const bindHeroReady = (gen: number) => {
    void figure.ready
      .then(() => {
        if (gen !== heroGen) return
        playerPlaceholder.visible = false
        playerUsesModel = true
      })
      .catch((err) => {
        if (gen !== heroGen) return
        console.warn('[player model] load failed, keeping placeholder', err)
      })
  }
  if (wardrobe) {
    void wardrobe
      .hydrate({ pose: true })
      .catch((err) => console.warn('[wardrobe] hydrate look failed', err))
      .finally(() => {
        refreshCombatAnim = true
      })
  }
  bindHeroReady(heroGen)

  const radioScene = new THREE.Scene()
  radioScene.background = new THREE.Color(0x160e0a)
  radioScene.add(new THREE.HemisphereLight(0xfff1e4, 0x3a2418, 1.05))
  const radioKey = new THREE.PointLight(0xfff1e4, 0.95, 4.2, 1.8)
  radioKey.position.set(0.4, 1.5, 0.75)
  const radioFill = new THREE.PointLight(0xe8c4a0, 0.32, 3.6, 1.8)
  radioFill.position.set(-0.5, 1.2, 0.45)
  const radioRim = new THREE.PointLight(0xc47848, 0.45, 3.8, 1.8)
  radioRim.position.set(-0.2, 1.55, -0.65)
  radioScene.add(radioKey, radioFill, radioRim)
  const radioFigure = createHeroFigure({ id: SKYRIM_FEMALE_ID, variant: 'bust' }).figure
  radioScene.add(radioFigure.root)
  void radioFigure.ready
    .then(() => radioFigure.playGait('idle'))
    .catch((err) => console.warn('[radio] Sofia load failed', err))
  let radioOnStage = false
  const setRadioOnStage = (on: boolean) => {
    if (on === radioOnStage) return
    radioOnStage = on
    if (on) {
      radioScene.remove(radioFigure.root)
      scene.add(radioFigure.root)
      radioFigure.root.position.set(0, 0, 0)
      radioFigure.root.rotation.set(0, 0, 0)
      radioFigure.root.scale.setScalar(1)
      radioFigure.playGait('idle')
    } else {
      scene.remove(radioFigure.root)
      radioScene.add(radioFigure.root)
      radioFigure.root.position.set(0, 0, 0)
      radioFigure.root.rotation.set(0, 0, 0)
    }
  }

  const enemyMatFlash = new THREE.MeshStandardMaterial({
    color: 0xfff1f2,
    emissive: 0xff6b6b,
    emissiveIntensity: 0.85,
    roughness: 0.35,
  })
  const enemyMatFreeze = new THREE.MeshStandardMaterial({
    color: 0xe0f2fe,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  })
  const enemyMatAmp = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfacc15,
    emissiveIntensity: 0.7,
    roughness: 0.3,
  })
  const enemyMatBreak = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0x64748b,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  })
  const enemyMatWeak = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    emissive: 0x78716c,
    emissiveIntensity: 0.45,
    roughness: 0.5,
  })
  const enemyMatSlow = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    roughness: 0.35,
  })
  const combatFxRoot = scene.getObjectByName('combatFx')
  const weatherFxRoot = scene.getObjectByName('weatherFx')

  const enemyPool: EnemyModelSlot[] = []
  const ensureEnemyPool = (need: number) => {
    while (enemyPool.length < need) {
      const slot = createEnemyModelSlot()
      scene.add(slot.root)
      enemyPool.push(slot)
    }
  }
  const codexFoe = createEnemyModelSlot()
  scene.add(codexFoe.root)
  codexFoe.root.visible = false

  const pickupPool: PickupModelSlot[] = []
  const ensurePickupPool = (need: number) => {
    while (pickupPool.length < need) {
      const slot = createPickupModelSlot()
      scene.add(slot.root)
      pickupPool.push(slot)
    }
  }

  const obstaclePool: ObstacleModelSlot[] = []
  const ensureObstaclePool = (need: number) => {
    while (obstaclePool.length < need) {
      const slot = createObstacleModelSlot()
      scene.add(slot.root)
      obstaclePool.push(slot)
    }
  }

  const bulletGeo = new THREE.SphereGeometry(1, 10, 10)
  const bulletMatFriend = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 0.85,
    roughness: 0.25,
  })
  const bulletMatFoe = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    emissive: 0x5a1010,
    roughness: 0.4,
  })
  const bulletPool: PoolMesh[] = []

  const terrainGeo = new THREE.PlaneGeometry(1, 1)
  const mkTerrainMat = (color: number, opacity: number) =>
    new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      roughness: 0.85,
      metalness: 0,
    })
  const terrainMats: Record<string, THREE.MeshStandardMaterial> = {
    mud: mkTerrainMat(0x6b4f32, 0.58),
    ice: mkTerrainMat(0xa5f3fc, 0.48),
    wind: mkTerrainMat(0xe0f2fe, 0.38),
    flame: mkTerrainMat(0xfb923c, 0.55),
    tide: mkTerrainMat(0x38bdf8, 0.46),
  }
  terrainMats.flame!.emissive.setHex(0xea580c)
  terrainMats.ice!.emissive.setHex(0x22d3ee)
  terrainMats.tide!.emissive.setHex(0x0284c7)
  terrainMats.wind!.emissive.setHex(0x7dd3fc)
  const terrainPool: PoolMesh[] = []
  const ensureTerrainPool = (need: number) => {
    while (terrainPool.length < need) {
      const m = new THREE.Mesh(terrainGeo, terrainMats.mud)
      m.rotation.x = -Math.PI / 2
      m.receiveShadow = true
      m.visible = false
      scene.add(m)
      terrainPool.push(m)
    }
  }

  let lastArenaHalf = -1
  let playViewW = 40
  let playViewH = 40
  let followX = 0
  let followZ = 0
  let displayYaw = 0
  const floaterNdc = new THREE.Vector3()

  const lerpAngle = (from: number, to: number, t: number) => {
    let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI
    if (d < -Math.PI) d += Math.PI * 2
    return from + d * t
  }

  const ensurePool = (
    pool: PoolMesh[],
    need: number,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
  ) => {
    while (pool.length < need) {
      const m = new THREE.Mesh(geo, mat)
      m.castShadow = false
      m.visible = false
      scene.add(m)
      pool.push(m)
    }
  }

  const fitPlayCamera = (half: number, aspect: number) => {
    // Local chase window: frustum does not grow with the arena, so a bigger map
    // stays a bigger place to run rather than a zoomed-out miniature.
    const arena = half * 2
    const vis = Math.min(PLAY_VIEW_HALF, half) * 2
    const pad = 1.05
    if (aspect >= 1) {
      playViewH = vis * pad * 0.72
      playViewW = playViewH * aspect
    } else {
      playViewW = vis * pad * 0.72
      playViewH = playViewW / aspect
    }
    playCam.left = -playViewW / 2
    playCam.right = playViewW / 2
    playCam.top = playViewH / 2
    playCam.bottom = -playViewH / 2
    playCam.up.set(0, 1, 0)
    playCam.updateProjectionMatrix()

    const voidW = Math.max(playViewW, arena) * 2.2
    const voidD = Math.max(playViewH, arena) * 2.2
    const groundW = Math.max(playViewW, arena) * 2.0
    const groundD = Math.max(playViewH, arena) * 2.0
    voidFloor.scale.set(voidW, voidD, 1)
    ground.scale.set(groundW, groundD, 1)
    setGroundRepeat(groundMaps, groundW, groundD, 'arena')
    setGroundRepeat(groundMaps, voidW, voidD, 'void')
    bound.scale.set(arena, 1, arena)
    bound.visible = true
  }

  /** Soft-follow player with tilted chase offset + optional hurt shake. */
  const updateFollowCamera = (x: number, z: number, half: number, hurtFlash: number) => {
    if (Math.hypot(x - followX, z - followZ) > 10) {
      followX = x
      followZ = z
    } else {
      followX += (x - followX) * 0.16
      followZ += (z - followZ) * 0.16
    }
    const view = Math.min(PLAY_VIEW_HALF, half)
    const oy = view * 2.45
    const oz = view * 0.85
    const shake = hurtFlash
    const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.55 : 0
    const sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.25 : 0
    const sz = shake > 0 ? (Math.random() - 0.5) * shake * 0.45 : 0
    playCam.up.set(0, 1, 0)
    playCam.position.set(followX + sx, oy + sy, followZ + oz + sz)
    playCam.lookAt(followX + sx * 0.25, 0, followZ + sz * 0.25)

    // Keep sun + shadow frustum centered on the player.
    dir.target.position.set(followX, 0, followZ)
    dir.position.set(followX + 14, 32, followZ + 10)
    dir.target.updateMatrixWorld()
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    renderer.setPixelRatio(dpr)
    renderer.setSize(w, h, false)
    glCanvas.style.width = `${w}px`
    glCanvas.style.height = `${h}px`

    hudCanvas.width = Math.floor(w * dpr)
    hudCanvas.height = Math.floor(h * dpr)
    hudCanvas.style.width = `${w}px`
    hudCanvas.style.height = `${h}px`
    hudCtx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const half = lastArenaHalf > 0 ? lastArenaHalf : 14
    fitPlayCamera(half, w / h)
    highway3d.resize(w, h)
  }

  const framingDist = (height: number, fovDeg: number, fill: number) => {
    const half = height / (2 * Math.max(0.2, fill))
    return half / Math.tan((fovDeg * Math.PI) / 360)
  }

  const compositionOffsetX = (cssW: number, mode: 'closet' | 'prep' | 'codex') => {
    if (mode === 'codex') {
      const leftSafe = Math.min(390, cssW * 0.36)
      const wellW = Math.max(240, cssW - leftSafe - 36)
      return cssW / 2 - (leftSafe + wellW / 2)
    }
    if (mode === 'prep') {
      const leftSafe = Math.min(360, cssW * 0.4)
      const wellW = Math.max(180, cssW - leftSafe - 48)
      return cssW / 2 - (leftSafe + wellW / 2)
    }
    const leftSafe = Math.min(280, cssW * 0.24)
    const rightSafe = Math.min(620, cssW * 0.56) + 24
    const wellW = Math.max(160, cssW - leftSafe - rightSafe)
    return cssW / 2 - (leftSafe + wellW / 2)
  }

  const applyTitleLights = (themeId: FrameSnapshot['hubThemeId']) => {
    const L = hubLights(themeId)
    scene.environment = studioEnv
    if (!L) {
      renderer.toneMappingExposure = 0.82
      hemi.intensity = 0.14
      hemi.color.setHex(0xe8c4a0)
      hemi.groundColor.setHex(0x3a2418)
      dir.intensity = 0.65
      dir.color.setHex(0xffc878)
      rim.intensity = 0.22
      rim.color.setHex(0xc47848)
      dir.position.set(2.6, 4.8, 2.8)
      dir.target.position.set(0, AVATAR_HEIGHT * 0.55, 0)
      dir.target.updateMatrixWorld()
      const s = 4.2
      dir.shadow.camera.left = -s
      dir.shadow.camera.right = s
      dir.shadow.camera.top = s
      dir.shadow.camera.bottom = -s
      dir.shadow.camera.near = 0.4
      dir.shadow.camera.far = 18
      dir.shadow.camera.updateProjectionMatrix()
      rim.position.set(-2.4, 2.0, -1.6)
      scene.fog = null
      scene.background = new THREE.Color(0x1a120c)
      beautyKey.color.setHex(0xfff1e4)
      beautyFill.color.setHex(0xe8c4a0)
      beautyRim.color.setHex(0xc47848)
      return
    }
    renderer.toneMappingExposure = L.exposure
    hemi.intensity = L.hemi
    hemi.color.setHex(L.hemiSky)
    hemi.groundColor.setHex(L.hemiGround)
    dir.intensity = L.dir
    dir.color.setHex(L.dirColor)
    dir.position.set(...L.dirPos)
    dir.target.position.set(0, AVATAR_HEIGHT * 0.55, 0)
    dir.target.updateMatrixWorld()
    const s = 8
    dir.shadow.camera.left = -s
    dir.shadow.camera.right = s
    dir.shadow.camera.top = s
    dir.shadow.camera.bottom = -s
    dir.shadow.camera.near = 0.4
    dir.shadow.camera.far = 28
    dir.shadow.camera.updateProjectionMatrix()
    rim.intensity = L.rim
    rim.color.setHex(L.rimColor)
    rim.position.set(...L.rimPos)
    if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(L.fog, L.fogDensity)
    } else {
      scene.fog.color.setHex(L.fog)
      scene.fog.density = L.fogDensity
    }
    scene.background = new THREE.Color(L.bg)
    beautyKey.color.setHex(L.beautyKey)
    beautyFill.color.setHex(L.beautyFill)
    beautyRim.color.setHex(L.beautyRim)
  }

  const restorePlayLights = () => {
    scene.environment = null
    renderer.toneMappingExposure = 1.15
    hemi.intensity = PLAY_HEMI
    hemi.color.setHex(0xe8c4a0)
    hemi.groundColor.setHex(0x3a2418)
    dir.intensity = PLAY_DIR
    dir.color.setHex(0xffc878)
    rim.intensity = 0.42
    rim.color.setHex(0xc47848)
    dir.shadow.camera.left = -shadowSpan
    dir.shadow.camera.right = shadowSpan
    dir.shadow.camera.top = shadowSpan
    dir.shadow.camera.bottom = -shadowSpan
    dir.shadow.camera.near = 1
    dir.shadow.camera.far = 80
    dir.shadow.camera.updateProjectionMatrix()
    rim.position.set(-8, 6, -10)
    scene.fog = null
    scene.background = new THREE.Color(0x1a120c)
    beautyKey.color.setHex(0xfff1e4)
    beautyFill.color.setHex(0xe8c4a0)
    beautyRim.color.setHex(0xc47848)
  }

  const applyWeatherMood = (id: string) => {
    if (id === 'clear') return
    if (id === 'heat') {
      hemi.color.setHex(0xffc090)
      hemi.groundColor.setHex(0x5a2410)
      dir.color.setHex(0xff9a4a)
      dir.intensity = PLAY_DIR * 1.08
      rim.color.setHex(0xea580c)
      scene.fog = new THREE.FogExp2(0x3a1608, 0.012)
      scene.background = new THREE.Color(0x2a1208)
      return
    }
    if (id === 'rain') {
      hemi.color.setHex(0xb8d4e8)
      hemi.groundColor.setHex(0x1e293b)
      dir.color.setHex(0xc7d2fe)
      dir.intensity = PLAY_DIR * 0.78
      rim.color.setHex(0x38bdf8)
      scene.fog = new THREE.FogExp2(0x0f172a, 0.014)
      scene.background = new THREE.Color(0x121820)
      return
    }
    if (id === 'gale') {
      hemi.color.setHex(0xe0f2fe)
      dir.color.setHex(0xf0f9ff)
      rim.color.setHex(0x7dd3fc)
      rim.intensity = 0.55
      scene.fog = new THREE.FogExp2(0x1e293b, 0.008)
      scene.background = new THREE.Color(0x1a2228)
      return
    }
    if (id === 'frost') {
      hemi.color.setHex(0xbae6fd)
      hemi.groundColor.setHex(0x1e3a4c)
      dir.color.setHex(0xe0f2fe)
      dir.intensity = PLAY_DIR * 0.9
      rim.color.setHex(0x67e8f9)
      scene.fog = new THREE.FogExp2(0x0c1922, 0.013)
      scene.background = new THREE.Color(0x101820)
      return
    }
    if (id === 'dust') {
      hemi.color.setHex(0xe8c478)
      hemi.groundColor.setHex(0x4a3218)
      dir.color.setHex(0xeab308)
      dir.intensity = PLAY_DIR * 0.85
      rim.color.setHex(0xa16207)
      scene.fog = new THREE.FogExp2(0x3a2a12, 0.016)
      scene.background = new THREE.Color(0x241808)
      return
    }
    if (id === 'magnet') {
      hemi.color.setHex(0xddd6fe)
      hemi.groundColor.setHex(0x2e1064)
      dir.color.setHex(0xc4b5fd)
      rim.color.setHex(0xa78bfa)
      rim.intensity = 0.7
      scene.fog = new THREE.FogExp2(0x1e1b4b, 0.012)
      scene.background = new THREE.Color(0x14102a)
    }
  }

  const fitPreviewCamera = (
    cssW: number,
    cssH: number,
    mode: 'closet' | 'prep' | 'codex',
    heightArg?: number,
    lookRatioArg?: number,
    fillArg?: number,
  ) => {
    const height = heightArg ?? figure.getFrame().height
    const chestY = height * (lookRatioArg ?? chestRatio)
    previewLook.set(0, chestY, 0)
    const fill = fillArg ?? frameFill
    const dist = framingDist(height, previewFov, fill) * previewOrbit.zoom
    const cp = Math.cos(previewOrbit.pitch)
    previewCam.aspect = cssW / cssH
    previewCam.fov = previewFov
    previewCam.near = 0.05
    previewCam.far = Math.max(48, dist * 4)
    previewCam.position.set(
      previewLook.x + Math.sin(previewOrbit.yaw) * cp * dist,
      previewLook.y + Math.sin(previewOrbit.pitch) * dist,
      previewLook.z + Math.cos(previewOrbit.yaw) * cp * dist,
    )
    previewCam.lookAt(previewLook)
    previewCam.setViewOffset(cssW, cssH, compositionOffsetX(cssW, mode), 0, cssW, cssH)
    previewCam.updateProjectionMatrix()
    return dist
  }

  /** Genshin/WuWa roster + MH hunter notes: 3/4 全身、髋部看点、轻俯、慢转台。 */
  const CODEX_YAW0 = 0.44
  const CODEX_PITCH = 0.08
  const CODEX_PITCH_BOSS = 0.03
  const CODEX_FOV = 28
  const CODEX_FILL = 0.76
  const CODEX_FILL_BOSS = 0.7
  const CODEX_LOOK = 0.46
  const CODEX_SPIN = 0.36
  const CODEX_BOSS = new Set(['warden', 'caller', 'hex', 'choir', 'tyrant'])
  const _codexBox = new THREE.Box3()
  const _codexSize = new THREE.Vector3()
  let hubOrbitHold: { yaw: number; pitch: number; zoom: number; fov: number } | null = null
  let lastCodexId = ''

  const restoreHubOrbit = () => {
    if (!hubOrbitHold) return
    previewOrbit.yaw = hubOrbitHold.yaw
    previewOrbit.pitch = hubOrbitHold.pitch
    previewOrbit.zoom = hubOrbitHold.zoom
    previewFov = hubOrbitHold.fov
    hubOrbitHold = null
    lastCodexId = ''
  }

  const applyCodexStage = (snap: FrameSnapshot, dt: number, cssW: number, cssH: number) => {
    if (!hubOrbitHold) {
      hubOrbitHold = {
        yaw: previewOrbit.yaw,
        pitch: previewOrbit.pitch,
        zoom: previewOrbit.zoom,
        fov: previewFov,
      }
    }
    const idKey = `${snap.codexSubject}:${snap.codexFoeKind ?? snap.codexIndex}`
    if (idKey !== lastCodexId) {
      lastCodexId = idKey
      previewOrbit.yaw = CODEX_YAW0
      previewIdle = 0
      zoomUser = false
    }
    const boss = !!snap.codexFoeKind && CODEX_BOSS.has(snap.codexFoeKind)
    previewOrbit.pitch = boss ? CODEX_PITCH_BOSS : CODEX_PITCH
    if (!zoomUser) previewOrbit.zoom = 1
    previewFov = CODEX_FOV
    if (!previewOrbit.dragging && previewIdle > 0.4) previewOrbit.yaw += dt * CODEX_SPIN

    const sub = snap.codexSubject
    setRadioOnStage(sub === 'radio')
    figure.root.visible = sub === 'hero'
    playerPlaceholder.visible = sub === 'hero' && !playerUsesModel
    playerRoot.visible = sub === 'hero'

    if (sub === 'foe' && snap.codexFoeKind) {
      const raw = snap.codexFoeKind
      const kind = CODEX_BOSS.has(raw)
        ? resolveEnemyVisualKind('boss', raw)
        : resolveEnemyVisualKind(raw)
      setEnemyModelKind(codexFoe, kind)
      codexFoe.root.visible = true
      codexFoe.root.position.set(0, 0, 0)
      codexFoe.root.rotation.set(0, 0, 0)
      syncEnemyFx(
        codexFoe,
        {
          boss,
          bossId: boss ? raw : undefined,
          slowed: false,
          frozen: false,
          amped: false,
          broken: false,
          weak: false,
          elem: null,
          stacks: 0,
        },
        performance.now() * 0.001,
      )
      codexFoe.root.updateMatrixWorld(true)
    } else {
      codexFoe.root.visible = false
    }

    let height = figure.getFrame().height || AVATAR_HEIGHT
    let lookRatio = CODEX_LOOK
    const fill = boss ? CODEX_FILL_BOSS : CODEX_FILL
    if (sub === 'radio') {
      height = radioFigure.getFrame().height || AVATAR_HEIGHT
    } else if (sub === 'foe' && codexFoe.kind) {
      const body = codexFoe.variants[codexFoe.kind]
      if (body) {
        _codexBox.setFromObject(body)
        _codexBox.getSize(_codexSize)
        height = Math.max(0.45, _codexSize.y)
        const lookY = _codexBox.min.y + height * CODEX_LOOK
        lookRatio = lookY / height
      }
    }

    fitPreviewCamera(cssW, cssH, 'codex', height, lookRatio, fill)
  }

  const FACE_YAW = 0.22
  const BUST_YAW = 0.55
  const FULL_YAW = 0.72
  /** Play portrait wells — telephoto (narrow FOV), not wardrobe PREVIEW_FOV. */
  const PLAY_FACE_FOV = 18
  const PLAY_BUST_FOV = 24
  const PLAY_FULL_FOV = 28
  /** Face look-at ≈ eyes / mid-face (fraction of body height). */
  const PLAY_FACE_LOOK = 0.91
  /** Head+neck span used for face framing distance. */
  const PLAY_FACE_SUBJECT = 0.3
  /** 2号特写头像：拉远 */
  const PLAY_FACE_DIST = 1.85
  /** 3/4 机位（半身·全身）：抬高 */
  const PLAY_BUST_PITCH = 0.22
  const PLAY_FULL_PITCH = 0.28

  /** In-arena close-up: telephoto, offset fixed in protagonist local space. */
  const framePlayLocalCam = (
    cam: THREE.PerspectiveCamera,
    shot: (typeof PREVIEW_SHOTS)['face'],
    localYaw: number,
    aspect: number,
    fovDeg: number,
    opts?: { lookRatio?: number; subjectH?: number; distMul?: number; pitch?: number },
  ) => {
    const bodyH = (figure.getFrame().height || AVATAR_HEIGHT) * playerScale.scale.x
    const lookY = bodyH * (opts?.lookRatio ?? shot.chestRatio)
    const frameH = opts?.subjectH ?? bodyH
    const px = playerRoot.position.x
    const pz = playerRoot.position.z
    const yaw = playerRoot.rotation.y + localYaw
    const dist = framingDist(frameH, fovDeg, shot.fill) * shot.zoom * (opts?.distMul ?? 1)
    const pitch = opts?.pitch ?? shot.pitch
    const cp = Math.cos(pitch)
    cam.aspect = Math.max(0.35, aspect)
    cam.fov = fovDeg
    cam.near = 0.08
    cam.far = Math.max(40, dist * 5)
    cam.position.set(
      px + Math.sin(yaw) * cp * dist,
      lookY + Math.sin(pitch) * dist,
      pz + Math.cos(yaw) * cp * dist,
    )
    cam.lookAt(px, lookY, pz)
    cam.clearViewOffset()
    cam.updateProjectionMatrix()
  }

  const blitWell = (
    cam: THREE.PerspectiveCamera,
    well: { x: number; y: number; w: number; h: number },
    cssH: number,
    target: THREE.Scene = scene,
  ) => {
    if (well.w < 48 || well.h < 48) return
    renderer.setViewport(well.x, cssH - well.y - well.h, well.w, well.h)
    renderer.setScissor(well.x, cssH - well.y - well.h, well.w, well.h)
    renderer.clear(true, true, true)
    renderer.render(target, cam)
  }

  const frameRadioCam = (well: { w: number; h: number }) => {
    const shot = PREVIEW_SHOTS.face
    const bodyH = radioFigure.getFrame().height || AVATAR_HEIGHT
    const lookY = bodyH * PLAY_FACE_LOOK
    const frameH = bodyH * PLAY_FACE_SUBJECT
    const dist = framingDist(frameH, PLAY_FACE_FOV, shot.fill) * shot.zoom * PLAY_FACE_DIST
    const pitch = shot.pitch
    const cp = Math.cos(pitch)
    radioCam.aspect = Math.max(0.35, well.w / well.h)
    radioCam.fov = PLAY_FACE_FOV
    radioCam.near = 0.08
    radioCam.far = Math.max(40, dist * 5)
    radioCam.position.set(
      Math.sin(FACE_YAW) * cp * dist,
      lookY + Math.sin(pitch) * dist,
      Math.cos(FACE_YAW) * cp * dist,
    )
    radioCam.lookAt(0, lookY, 0)
    radioCam.clearViewOffset()
    radioCam.updateProjectionMatrix()
  }

  /** Soften / lift beauty for portrait wells (still same lights). */
  const setBeautyPortrait = (on: boolean) => {
    beautyKey.intensity = on ? 0.95 : 0.7
    beautyFill.intensity = on ? 0.38 : 0.28
    beautyRim.intensity = on ? 0.55 : 0.4
    beautyBounce.intensity = on ? 0.2 : 0.14
  }

  /** Portrait wells — same arena scene, telephoto cams locked to the protagonist. */
  const renderPlayPortrait = (snap: FrameSnapshot, cssW: number, cssH: number) => {
    const hidden: THREE.Object3D[] = [arenaGroup]
    if (combatFxRoot) hidden.push(combatFxRoot)
    if (weatherFxRoot) hidden.push(weatherFxRoot)
    for (const slot of enemyPool) hidden.push(slot.root)
    for (const slot of obstaclePool) hidden.push(slot.root)
    for (const slot of pickupPool) hidden.push(slot.root)
    for (const m of bulletPool) hidden.push(m)
    for (const m of terrainPool) hidden.push(m)
    const prev = hidden.map((o) => o.visible)
    for (const o of hidden) o.visible = false

    const lay = playCamLayout(cssW, cssH, snap)
    const bodyH = (figure.getFrame().height || AVATAR_HEIGHT) * playerScale.scale.x
    framePlayLocalCam(faceCam, PREVIEW_SHOTS.face, FACE_YAW, lay.face.w / lay.face.h, PLAY_FACE_FOV, {
      lookRatio: PLAY_FACE_LOOK,
      subjectH: bodyH * PLAY_FACE_SUBJECT,
      distMul: PLAY_FACE_DIST,
    })
    if (lay.featured === 'bust') {
      framePlayLocalCam(bustCam, PREVIEW_SHOTS.bust, BUST_YAW, lay.bust.w / lay.bust.h, PLAY_BUST_FOV, {
        pitch: PLAY_BUST_PITCH,
      })
    } else {
      framePlayLocalCam(fullCam, PREVIEW_SHOTS.full, FULL_YAW, lay.full.w / lay.full.h, PLAY_FULL_FOV, {
        pitch: PLAY_FULL_PITCH,
      })
    }

    setBeautyPortrait(true)
    const prevAuto = renderer.autoClear
    renderer.autoClear = false
    renderer.setScissorTest(true)
    blitWell(faceCam, lay.face, cssH)
    frameRadioCam(lay.radio)
    blitWell(radioCam, lay.radio, cssH, radioScene)
    if (lay.featured === 'bust') blitWell(bustCam, lay.bust, cssH)
    else blitWell(fullCam, lay.full, cssH)
    renderer.setScissorTest(false)
    renderer.setViewport(0, 0, cssW, cssH)
    renderer.autoClear = prevAuto
    setBeautyPortrait(false)

    for (let i = 0; i < hidden.length; i++) hidden[i]!.visible = prev[i]!
  }

  let previewInput = true
  const onPreviewDown = (e: PointerEvent) => {
    if (!previewInput) return
    if (e.button !== 0) return
    previewOrbit.dragging = true
    previewIdle = 0
    previewOrbit.lastX = e.clientX
    previewOrbit.lastY = e.clientY
    glCanvas.setPointerCapture(e.pointerId)
  }
  const onPreviewMove = (e: PointerEvent) => {
    if (!previewOrbit.dragging) return
    const dx = e.clientX - previewOrbit.lastX
    const dy = e.clientY - previewOrbit.lastY
    previewOrbit.lastX = e.clientX
    previewOrbit.lastY = e.clientY
    previewOrbit.yaw -= dx * 0.008
    previewOrbit.pitch = Math.max(-0.05, Math.min(0.72, previewOrbit.pitch + dy * 0.006))
    pitchGoal = previewOrbit.pitch
  }
  const onPreviewUp = (e: PointerEvent) => {
    previewOrbit.dragging = false
    try {
      glCanvas.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    persistCam()
  }
  const onPreviewWheel = (e: WheelEvent) => {
    if (!previewInput) return
    e.preventDefault()
    previewIdle = 0
    zoomUser = true
    previewOrbit.zoom = Math.max(0.4, Math.min(2.6, previewOrbit.zoom * (e.deltaY > 0 ? 1.08 : 0.92)))
    persistCam()
  }
  glCanvas.addEventListener('pointerdown', onPreviewDown)
  glCanvas.addEventListener('pointermove', onPreviewMove)
  glCanvas.addEventListener('pointerup', onPreviewUp)
  glCanvas.addEventListener('pointercancel', onPreviewUp)
  glCanvas.addEventListener('wheel', onPreviewWheel, { passive: false })
  glCanvas.addEventListener('contextmenu', (e) => {
    if (previewInput) e.preventDefault()
  })

  const draw = (snap: FrameSnapshot) => {
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    const half = snap.arenaHalf
    const onStudio =
      snap.scene === 'title' ||
      snap.scene === 'prep' ||
      snap.scene === 'closet' ||
      snap.scene === 'options' ||
      snap.scene === 'shop' ||
      snap.scene === 'codex'
    const onCloset = snap.scene === 'closet'
    const hubTheme = onCloset ? 'studio' : snap.hubThemeId
    previewInput = onStudio
    const showArena = snap.scene === 'play' || snap.scene === 'pick'
    if (half !== lastArenaHalf) lastArenaHalf = half
    if (showArena) fitPlayCamera(half, cssW / cssH)

    arenaGroup.visible = showArena
    previewStudio.visible = onStudio && hubTheme === 'studio'
    hubStage.setTheme(onStudio ? hubTheme : 'studio')
    hubStage.root.visible = onStudio && hubTheme !== 'studio'
    beautyRig.visible = showArena || onStudio
    syncDebugUi(onCloset)
    playerRoot.visible = showArena || onStudio
    rim.visible = onStudio

    const now = performance.now()
    const dt = Math.min(0.05, (now - previewT) / 1000)
    previewT = now
    if (onStudio) {
      if (combatGait) {
        combatGait = null
        if (wardrobe) void wardrobe.setPose(wardrobe.getPoseId())
        else figure.playGait('idle')
      }
    } else if (showArena) {
      if (refreshCombatAnim) {
        refreshCombatAnim = false
        combatGait = null
      }
      const next: Gait = snap.player.moving ? 'walk' : 'idle'
      if (combatGait !== next) {
        combatGait = next
        figure.playGait(next)
      }
      if (snap.player.castSeq !== lastCastSeq) {
        lastCastSeq = snap.player.castSeq
        if (lastCastSeq > 0) figure.playCast()
      }
    }

    if (onStudio) {
      playerRoot.position.set(0, 0, 0)
      playerRoot.rotation.set(0, 0, 0)
      playerRoot.scale.set(1, 1, 1)
      playerScale.scale.setScalar(1)
    } else if (showArena) {
      const p = snap.player
      playerRoot.position.set(p.x, 0, p.z)
      displayYaw = lerpAngle(displayYaw, p.yaw, 0.22)
      playerRoot.rotation.set(0, displayYaw, 0)
      playerRoot.scale.set(1, 1, 1)
      playerScale.scale.setScalar((1.42 * Math.max(0.2, p.r / 0.55)) / AVATAR_HEIGHT)
    }

    figure.tick(dt, snap.beatPhase, {
      spectrum: snap.audioSpectrum,
      bass: snap.audioBass,
      mid: snap.audioMid,
      energy: snap.audioEnergy,
    })
    radioFigure.tick(dt)

    if (onStudio) {
      const onCodex = snap.scene === 'codex'
      allowCamPersist = !onCodex
      previewIdle += dt
      const ease = 1 - Math.exp(-dt * 7)
      if (!onCodex) {
        chestRatio += (chestGoal - chestRatio) * ease
        frameFill += (fillGoal - frameFill) * ease
        if (!zoomUser) previewOrbit.zoom += (zoomGoal - previewOrbit.zoom) * ease
        if (!previewOrbit.dragging) previewOrbit.pitch += (pitchGoal - previewOrbit.pitch) * ease
      }
      applyTitleLights(hubTheme)
      hubStage.tick(now / 1000, dt)
      const frame = figure.getFrame()
      const chestY = frame.height * chestRatio
      previewLookAxes.position.set(0, chestY, 0)
      playerRoot.updateMatrixWorld(true)
      if (onCodex) {
        applyCodexStage(snap, dt, cssW, cssH)
      } else {
        restoreHubOrbit()
        setRadioOnStage(false)
        codexFoe.root.visible = false
        figure.root.visible = true
        playerRoot.visible = true
        playerPlaceholder.visible = !playerUsesModel
        fitPreviewCamera(cssW, cssH, onCloset ? 'closet' : 'prep')
      }
      if (previewDebug) {
        syncTuneFields()
        tuneDump.textContent = [
          `景别 ${shot}  身高 ${frame.height.toFixed(2)}m  宽 ${frame.width.toFixed(2)}`,
          `胸口 ${chestY.toFixed(2)} (${chestRatio.toFixed(2)}·H)  zoom ${previewOrbit.zoom.toFixed(2)}`,
          `偏航 ${previewOrbit.yaw.toFixed(2)}  俯仰 ${previewOrbit.pitch.toFixed(2)}  FOV ${previewFov.toFixed(1)}`,
        ].join('\n')
      }
      if (!playerUsesModel) {
        playerPlaceholder.position.set(0, AVATAR_HEIGHT * 0.5, 0)
        playerPlaceholder.scale.set(0.22, AVATAR_HEIGHT / 1.2, 0.22)
      }
      figure.setOutline(0xfff1c2, 0.018)
      playerMat.opacity = 1
      playerMat.transparent = false
      for (const slot of enemyPool) slot.root.visible = false
      for (const slot of obstaclePool) slot.root.visible = false
      for (const slot of pickupPool) slot.root.visible = false
      for (const m of bulletPool) m.visible = false
      for (const m of terrainPool) m.visible = false
      combatFx.hide()
      weatherFx.hide()
      renderer.render(scene, previewCam)
    } else if (showArena) {
      restoreHubOrbit()
      setRadioOnStage(false)
      codexFoe.root.visible = false
      figure.root.visible = true
      restorePlayLights()
      applyWeatherMood(snap.weatherId)
      previewCam.clearViewOffset()
      const p = snap.player
      if (!playerUsesModel) {
        playerPlaceholder.position.set(0, AVATAR_HEIGHT * 0.5, 0)
        playerPlaceholder.scale.set(0.22, AVATAR_HEIGHT / 1.2, 0.22)
      }
      playerMat.opacity = p.invuln > 0 ? 0.55 : p.shieldOn ? 0.82 : 1
      playerMat.transparent = p.invuln > 0 || p.hurtFlash > 0.05 || p.shieldOn
      if (p.hurtFlash > 0.05) {
        playerMat.color.set(0xfb7185)
        playerMat.emissive.setHex(0x7f1d1d)
      } else if (p.shieldOn) {
        playerMat.color.set(0xe8c478)
        playerMat.emissive.setHex(0x8a5a20)
      } else {
        playerMat.color.set(p.invuln > 0 ? 0xf3ead8 : 0xd4a06a)
        playerMat.emissive.setHex(0x3a2414)
      }
      figure.setOutline(
        p.hurtFlash > 0.15
          ? 0xfb7185
          : snap.feverActive
            ? 0xfde047
            : p.shieldOn
              ? 0xfbbf24
              : starterAuraHex(snap.starterId),
        snap.feverActive ? 0.04 : p.dashing ? 0.036 : p.shieldOn ? 0.03 : 0.026,
      )

      const halfCam = snap.arenaHalf
      updateFollowCamera(p.x, p.z, halfCam, p.hurtFlash)

      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004)
      terrainMats.flame!.emissiveIntensity = 0.28 + 0.4 * pulse
      terrainMats.ice!.emissiveIntensity = 0.14 + 0.2 * pulse
      terrainMats.tide!.emissiveIntensity = 0.12 + 0.18 * pulse
      terrainMats.wind!.opacity = 0.3 + 0.16 * pulse
      terrainMats.tide!.opacity = 0.38 + 0.14 * pulse
      ensureTerrainPool(snap.terrain.length)
      for (let i = 0; i < terrainPool.length; i++) {
        const mesh = terrainPool[i]!
        const t = snap.terrain[i]
        if (!t) {
          mesh.visible = false
          continue
        }
        mesh.visible = true
        mesh.material = terrainMats[t.kind] ?? terrainMats.mud!
        mesh.position.set(t.x, 0.045, t.z)
        mesh.scale.set(t.w, t.d, 1)
      }

      ensureObstaclePool(snap.obstacles.length)
      for (let i = 0; i < obstaclePool.length; i++) {
        const slot = obstaclePool[i]!
        const o = snap.obstacles[i]
        if (!o) {
          slot.root.visible = false
          continue
        }
        slot.root.visible = true
        const kind = (o.kind === 'pillar' ? 'pillar' : 'block') as ObstacleVisualKind
        setObstacleModelKind(slot, kind)
        slot.root.position.set(o.x, o.h * 0.5, o.z)
        slot.root.scale.set(o.w, o.h, o.d)
        // Slight yaw variety from position so crates don't look identical.
        slot.root.rotation.y = kind === 'block' ? (o.x * 1.7 + o.z * 2.3) * 0.15 : 0
      }

      ensureEnemyPool(snap.enemies.length)
      for (let i = 0; i < enemyPool.length; i++) {
        const slot = enemyPool[i]!
        const e = snap.enemies[i]
        if (!e) {
          slot.root.visible = false
          continue
        }
        slot.root.visible = true
        const kind = resolveEnemyVisualKind(e.kind, e.bossId)
        setEnemyModelKind(slot, kind)
        const frozen = !!e.frozen
        const statusMat = e.hurtFlash > 0.08
          ? enemyMatFlash
          : frozen
            ? enemyMatFreeze
            : e.amped
                ? enemyMatAmp
                : e.broken
                  ? enemyMatBreak
                  : e.weak
                    ? enemyMatWeak
                    : e.slowed
                      ? enemyMatSlow
                      : null
        setEnemyModelFlash(slot, !!statusMat, statusMat ?? enemyMatFlash)
        const punch = 1 + 0.4 * e.hurtFlash
        const s =
          (e.r / 0.32) *
          punch *
          (kind === 'tyrant' || kind === 'choir' ? 1.05 : 1)
        slot.root.position.set(e.x, 0, e.z)
        slot.root.scale.setScalar(s)
        slot.root.rotation.y = Math.atan2(snap.player.x - e.x, snap.player.z - e.z)
        syncEnemyFx(
          slot,
          {
            boss: e.kind === 'boss',
            bossId: e.bossId,
            slowed: !!e.slowed,
            frozen,
            amped: !!e.amped,
            broken: !!e.broken,
            weak: !!e.weak,
            elem: e.elem ?? null,
            stacks: e.stacks ?? 0,
          },
          now * 0.001,
        )
      }

      ensurePickupPool(snap.pickups.length)
      for (let i = 0; i < pickupPool.length; i++) {
        const slot = pickupPool[i]!
        const p = snap.pickups[i]
        if (!p) {
          slot.root.visible = false
          continue
        }
        slot.root.visible = true
        const kind = p.kind as PickupVisualKind
        setPickupModelKind(slot, kind)
        const bob = 0.28 + Math.sin(performance.now() * 0.006 + i) * 0.08
        const s =
          kind === 'relic_major' ? 0.85 : kind === 'relic_minor' ? 0.7 : kind === 'xp' ? 0.58 : 0.55
        slot.root.position.set(p.x, bob, p.z)
        slot.root.scale.setScalar(s)
        slot.root.rotation.y = performance.now() * 0.0018 + i
      }

      ensurePool(bulletPool, snap.bullets.length, bulletGeo, bulletMatFriend)
      for (let i = 0; i < bulletPool.length; i++) {
        const mesh = bulletPool[i]!
        const b = snap.bullets[i]
        if (!b) {
          mesh.visible = false
          continue
        }
        mesh.visible = true
        mesh.material = b.friendly ? bulletMatFriend : bulletMatFoe
        mesh.position.set(b.x, 0.45, b.z)
        const s = b.friendly ? Math.max(0.16, b.r * 1.35) : Math.max(0.12, b.r)
        mesh.scale.setScalar(s)
      }

      combatFx.sync(snap, true)
      weatherFx.sync(snap, true)
    } else {
      for (const slot of enemyPool) slot.root.visible = false
      for (const slot of obstaclePool) slot.root.visible = false
      for (const slot of pickupPool) slot.root.visible = false
      for (const m of bulletPool) m.visible = false
      for (const m of terrainPool) m.visible = false
      combatFx.hide()
      weatherFx.hide()
      restorePlayLights()
      renderer.render(scene, playCam)
    }

    if (showArena) {
      renderer.render(scene, playCam)
      renderPlayPortrait(snap, cssW, cssH)
    }
    highway3d.sync(snap)
    highway3d.render(renderer)
    hudCtx.clearRect(0, 0, cssW, cssH)
    paintHudLayer(hudCtx, cssW, cssH, snap)
    if (showArena) {
      const toHud = (x: number, z: number, y = 0.85) => {
        floaterNdc.set(x, y, z).project(playCam)
        return {
          sx: (floaterNdc.x * 0.5 + 0.5) * cssW,
          sy: (-floaterNdc.y * 0.5 + 0.5) * cssH,
        }
      }
      drawOffscreenTrackers(hudCtx, cssW, cssH, snap, (x, z) => toHud(x, z))
      drawDamageFloaters(hudCtx, snap.floaters, (x, z) => toHud(x, z, 1.15))
      drawPlayPortraitChrome(hudCtx, cssW, cssH, snap)
    }
  }

  return {
    resize,
    draw,
    get wardrobe() {
      return wardrobe
    },
    get heroCaps() {
      return figure.capabilities
    },
    setFigure: async (id: string) => {
      if (figure.id === id) return
      heroGen += 1
      const gen = heroGen
      playerScale.remove(figure.root)
      figure.root.traverse((n) => {
        const mesh = n as THREE.Mesh
        if (mesh.geometry) mesh.geometry.dispose()
        const mat = mesh.material
        if (!mat) return
        const list = Array.isArray(mat) ? mat : [mat]
        for (const m of list) m.dispose()
      })
      playerUsesModel = false
      playerPlaceholder.visible = true
      created = createHeroFigure({
        id,
        getShot: () => shot,
        onShot: applyShot,
      })
      figure = created.figure
      wardrobe = created.wardrobe
      playerScale.add(figure.root)
      if (wardrobe) {
        void wardrobe
          .hydrate({ pose: true })
          .catch((err) => console.warn('[wardrobe] hydrate look failed', err))
          .finally(() => {
            if (gen === heroGen) refreshCombatAnim = true
          })
      }
      bindHeroReady(gen)
      try {
        await figure.ready
      } catch {
        /* placeholder stays */
      }
    },
  }
}

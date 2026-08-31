import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { firstSkeleton, restSkeleton, retargetClip } from '../figures/kernel'
import { makeSimpleClip, type SimpleClipId } from '../figures/tka-jodi/simpleClips'

const POSES = [
  { id: '', caption: '站姿 bind' },
  { id: 'simple:walk', caption: '行走' },
  { id: 'simple:cast', caption: '施法' },
  { id: 'simple:walkcast', caption: '行走+施法' },
  { id: 'Jodi_Glovetighten_Anim', caption: 'Inspect Glove（导入）' },
  { id: 'Jodi_Kneeling_Anim', caption: 'Kneeling（导入）' },
  { id: 'Jodi_Pin-up', caption: 'Pin-Up（导入）' },
  { id: 'Jodi_Dogeza_Anim', caption: 'Dogeza（导入）' },
  { id: 'Jodi_CrossedArms_Anim', caption: 'Crossed Arms（导入）' },
  { id: 'Maid_iDLE_Anim', caption: 'Maid Idle（导入）' },
]

const SKIP = /^(Cam|hand_l_socket|Prop_R2|HeadTarget)$|_end$/i

function boneColor(name: string): number {
  if (/head|neck|jaw|eye|mouth/i.test(name)) return 0xe8c040
  if (/spine|pelvis|root|clavicle/i.test(name)) return 0xe07030
  if (/_l$|Hip_L|hand_l|arm_l|thigh_l|calf_l|foot_l/i.test(name)) return 0x4080e0
  if (/_r$|Hip_R|hand_r|arm_r|thigh_r|calf_r|foot_r/i.test(name)) return 0x8040c0
  return 0x888888
}

type Seg = { parent: THREE.Bone; child: THREE.Bone; mesh: THREE.Mesh }

function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = []
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone && !SKIP.test(obj.name)) bones.push(obj as THREE.Bone)
  })
  return bones
}

function makeSegments(bones: THREE.Bone[], group: THREE.Group): Seg[] {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const segs: Seg[] = []
  const set = new Set(bones)
  for (const parent of bones) {
    for (const child of parent.children) {
      if (!(child as THREE.Bone).isBone || !set.has(child as THREE.Bone)) continue
      const mat = new THREE.MeshLambertMaterial({ color: boneColor(parent.name) })
      const mesh = new THREE.Mesh(geo, mat)
      group.add(mesh)
      segs.push({ parent, child: child as THREE.Bone, mesh })
    }
  }
  return segs
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _z = new THREE.Vector3(0, 0, 1)

function layoutSegments(segs: Seg[]) {
  for (const seg of segs) {
    seg.parent.getWorldPosition(_a)
    seg.child.getWorldPosition(_b)
    const len = _a.distanceTo(_b)
    if (len < 1e-4) {
      seg.mesh.visible = false
      continue
    }
    seg.mesh.visible = true
    seg.mesh.scale.set(0.03, 0.03, len)
    seg.mesh.position.copy(_a).add(_b).multiplyScalar(0.5)
    _b.sub(_a).normalize()
    seg.mesh.quaternion.setFromUnitVectors(_z, _b)
  }
}

function hideSkins(root: THREE.Object3D) {
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh || ((obj as THREE.Mesh).isMesh && !(obj as THREE.Bone).isBone)) {
      obj.visible = false
    }
  })
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.setSize(innerWidth, innerHeight)
renderer.setClearColor(0x141414, 1)
document.body.append(renderer.domElement)

const scene = new THREE.Scene()
scene.add(new THREE.GridHelper(2, 20, 0x333333, 0x222222))
scene.add(new THREE.AxesHelper(0.4))
scene.add(new THREE.AmbientLight(0xffffff, 0.55))
const key = new THREE.DirectionalLight(0xffffff, 1.1)
key.position.set(1.2, 2.2, 1.4)
scene.add(key)

const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 40)
camera.position.set(1.6, 1.2, 2.4)
const orbit = new OrbitControls(camera, renderer.domElement)
orbit.target.set(0, 0.9, 0)
orbit.update()

const status = document.querySelector('#status') as HTMLElement
const select = document.querySelector('#pose') as HTMLSelectElement
const restBtn = document.querySelector('#rest') as HTMLButtonElement
for (const p of POSES) {
  const opt = document.createElement('option')
  opt.value = p.id
  opt.textContent = p.caption
  select.append(opt)
}

const loader = new GLTFLoader()
let mixer: THREE.AnimationMixer | null = null
let mixerRoot: THREE.Object3D | null = null
let segs: Seg[] = []
const clipCache = new Map<string, THREE.AnimationClip>()

function play(clip: THREE.AnimationClip | null, loop: boolean) {
  if (!mixer || !mixerRoot) return
  mixer.stopAllAction()
  restSkeleton(mixerRoot)
  if (!clip) return
  const bound = retargetClip(clip, mixerRoot)
  const action = mixer.clipAction(bound)
  action.reset()
  if (loop) {
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.play()
    return
  }
  action.setLoop(THREE.LoopOnce, 1)
  action.clampWhenFinished = true
  action.play()
  if (clip.name.startsWith('simple-')) return
  action.time = Math.max(0, bound.duration - 1 / 30)
  mixer.update(0)
  action.paused = true
}

async function loadClip(id: string): Promise<THREE.AnimationClip> {
  const hit = clipCache.get(id)
  if (hit) return hit
  const gltf = await loader.loadAsync(`/figures/tka-jodi/models/Achates_Poses/${id}.glb`)
  const clip = gltf.animations[0]
  if (!clip) throw new Error(`${id} 没有 clip`)
  clipCache.set(id, clip)
  return clip
}

async function applyPose(id: string) {
  if (!id) {
    play(null, false)
    status.textContent = 'bind'
    return
  }
  status.textContent = id
  if (id.startsWith('simple:')) {
    if (!mixerRoot) return
    restSkeleton(mixerRoot)
    mixerRoot.updateMatrixWorld(true)
    const clip = makeSimpleClip(mixerRoot, id.slice('simple:'.length) as SimpleClipId)
    play(clip, true)
    return
  }
  const clip = await loadClip(id)
  play(clip, /idle|sprint/i.test(id))
}

const ready = (async () => {
  const gltf = await loader.loadAsync('/figures/tka-jodi/models/user2/user.glb')
  mixerRoot = gltf.scene
  hideSkins(mixerRoot)
  scene.add(mixerRoot)
  const bones = collectBones(mixerRoot)
  const cubegroup = new THREE.Group()
  cubegroup.name = 'bone-cubes'
  scene.add(cubegroup)
  segs = makeSegments(bones, cubegroup)
  if (!firstSkeleton(mixerRoot)) throw new Error('user2 没有骨架')
  mixer = new THREE.AnimationMixer(mixerRoot)
  restSkeleton(mixerRoot)
  const q = new URLSearchParams(location.search).get('pose')
  if (q && POSES.some((p) => p.id === q)) {
    select.value = q
    await applyPose(q)
  } else {
    status.textContent = 'bind · 选一个姿势'
  }
})()

select.addEventListener('change', () => {
  void ready.then(() => applyPose(select.value)).catch((e) => {
    status.textContent = e instanceof Error ? e.message : String(e)
  })
})
restBtn.addEventListener('click', () => {
  select.value = ''
  play(null, false)
  status.textContent = 'bind'
})

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

let last = performance.now()
function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000)
  last = now
  mixer?.update(dt)
  mixerRoot?.updateMatrixWorld(true)
  layoutSegments(segs)
  orbit.update()
  renderer.render(scene, camera)
  requestAnimationFrame(tick)
}
requestAnimationFrame(tick)

void ready.catch((e) => {
  status.textContent = e instanceof Error ? e.message : String(e)
})

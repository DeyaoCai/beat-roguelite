import * as THREE from 'three'

/** Skinned meshes under a wardrobe layer (body or one clothes slot). */
export function collectSkinnedMeshes(root: THREE.Object3D): THREE.SkinnedMesh[] {
  const out: THREE.SkinnedMesh[] = []
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) out.push(obj as THREE.SkinnedMesh)
  })
  return out
}

export function firstSkeleton(root: THREE.Object3D): THREE.Skeleton | null {
  return collectSkinnedMeshes(root)[0]?.skeleton ?? null
}

/**
 * Rebind clothing SkinnedMeshes onto the body skeleton by bone name.
 * Geometry skinIndex is remapped once (original kept on userData).
 * Returns how many meshes bound. 0 = leave layer on its own skeleton.
 */
export function rebindSkinnedMeshes(layer: THREE.Object3D, target: THREE.Skeleton): number {
  let n = 0
  for (const mesh of collectSkinnedMeshes(layer)) {
    if (mesh.skeleton === target) {
      n++
      continue
    }
    if (rebindMesh(mesh, target)) n++
  }
  return n
}

function rebindMesh(mesh: THREE.SkinnedMesh, target: THREE.Skeleton): boolean {
  const src = mesh.skeleton
  if (!src?.bones.length) return false
  if (mesh.userData.skinBound === target) return true

  const dstIndex = new Map<string, number>()
  target.bones.forEach((b, i) => dstIndex.set(b.name, i))

  const lut = new Int32Array(src.bones.length)
  let hits = 0
  for (let i = 0; i < src.bones.length; i++) {
    const name = src.bones[i]!.name
    const j = dstIndex.get(name)
    if (j == null) {
      lut[i] = -1
    } else {
      lut[i] = j
      hits++
    }
  }
  if (hits < 3) return false

  const geo = mesh.geometry
  const attr = geo.getAttribute('skinIndex')
  if (attr) {
    const orig =
      (mesh.userData.skinIndexOrig as THREE.BufferAttribute | undefined) ??
      (attr as THREE.BufferAttribute)
    if (!mesh.userData.skinIndexOrig) mesh.userData.skinIndexOrig = orig.clone()
    geo.setAttribute('skinIndex', remapSkinIndex(orig, lut))
  }

  mesh.bind(target, mesh.bindMatrix)
  mesh.userData.skinBound = target
  return true
}

function remapSkinIndex(attr: THREE.BufferAttribute, lut: Int32Array): THREE.BufferAttribute {
  const next = attr.clone()
  const size = Math.min(next.itemSize, 4)
  for (let i = 0; i < next.count; i++) {
    for (let k = 0; k < size; k++) {
      const old = component(next, i, k)
      const mapped = lut[old | 0]
      setComponent(next, i, k, mapped >= 0 ? mapped : 0)
    }
  }
  return next
}

function component(attr: THREE.BufferAttribute, i: number, k: number): number {
  if (k === 0) return attr.getX(i)
  if (k === 1) return attr.getY(i)
  if (k === 2) return attr.getZ(i)
  return attr.getW(i)
}

function setComponent(attr: THREE.BufferAttribute, i: number, k: number, v: number) {
  if (k === 0) attr.setX(i, v)
  else if (k === 1) attr.setY(i, v)
  else if (k === 2) attr.setZ(i, v)
  else attr.setW(i, v)
}

/** Map clip tracks onto bones under `root` when glTF used a path prefix. */
export function retargetClip(
  clip: THREE.AnimationClip,
  root: THREE.Object3D,
): THREE.AnimationClip {
  const bones = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) bones.set(obj.name, obj as THREE.Bone)
  })
  const tracks: THREE.KeyframeTrack[] = []
  for (const t of clip.tracks) {
    const dot = t.name.lastIndexOf('.')
    if (dot < 0) continue
    const node = t.name.slice(0, dot)
    const prop = t.name.slice(dot + 1)
    const short = bones.has(node) ? node : (node.split('/').pop()?.split(':').pop() ?? node)
    const bone = bones.get(short)
    if (!bone) continue
    // Root motion is UE cm written as meters (kneel ~26m). Poses are rotation.
    if (prop === 'scale' || prop === 'position') continue
    const next = t.clone()
    next.name = `${short}.${prop}`
    tracks.push(next)
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks)
}

export function captureBindPose(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone) return
    obj.userData.bindQuaternion = (obj as THREE.Bone).quaternion.clone()
  })
}

export function restSkeleton(root: THREE.Object3D) {
  const seen = new Set<THREE.Skeleton>()
  for (const mesh of collectSkinnedMeshes(root)) {
    const sk = mesh.skeleton
    if (!sk || seen.has(sk)) continue
    seen.add(sk)
    sk.pose()
  }
}

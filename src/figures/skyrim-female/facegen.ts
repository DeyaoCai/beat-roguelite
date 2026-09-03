import * as THREE from 'three'

function isHeadBoneName(name: string): boolean {
  if (name === 'NPC_Head_Head') return true
  return /NPC.*Head/i.test(name) && !/Magic|Prey|Target|Nub|end/i.test(name)
}

function findHeadBone(root: THREE.Object3D): THREE.Bone | null {
  let best: THREE.Bone | null = null
  root.traverse((o) => {
    if (!(o instanceof THREE.Bone)) return
    if (o.name === 'NPC_Head_Head') best = o
    else if (!best && isHeadBoneName(o.name)) best = o
  })
  return best
}

function headWeightRatio(mesh: THREE.SkinnedMesh): number {
  const sk = mesh.skeleton
  if (!sk) return 0
  const headIdx = sk.bones.findIndex((b) => isHeadBoneName(b.name))
  if (headIdx < 0) return 0
  const idx = mesh.geometry.getAttribute('skinIndex')
  const wt = mesh.geometry.getAttribute('skinWeight')
  if (!idx || !wt) return 0
  let headW = 0
  let total = 0
  const step = Math.max(1, Math.floor(idx.count / 400))
  const ia = idx.array as ArrayLike<number>
  const wa = wt.array as ArrayLike<number>
  for (let i = 0; i < idx.count; i += step) {
    const o = i * 4
    for (let k = 0; k < 4; k++) {
      const w = wa[o + k] ?? 0
      total += w
      if ((ia[o + k] ?? -1) === headIdx) headW += w
    }
  }
  return total > 1e-6 ? headW / total : 0
}

/**
 * Facegen NIFs often store verts in head-local space while vanilla
 * femalehead is body-space. Same IBM → skinned head sits in the torso.
 * Lift head-weighted meshes whose rest bbox is far below the head bone.
 */
export function fixMisplacedFacegen(root: THREE.Object3D): number {
  root.updateMatrixWorld(true)

  const headBone = findHeadBone(root)
  if (!headBone) return 0

  let bodyMaxY = -Infinity
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    if (!/^3ba$/i.test(o.name)) return
    const box = new THREE.Box3().setFromObject(o)
    if (!box.isEmpty()) bodyMaxY = Math.max(bodyMaxY, box.max.y)
  })
  if (!Number.isFinite(bodyMaxY)) return 0

  const low: THREE.SkinnedMesh[] = []
  root.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return
    if (headWeightRatio(o) < 0.25) return
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())
    if (c.y < bodyMaxY * 0.55) low.push(o)
  })
  if (low.length === 0) return 0

  const cluster = new THREE.Box3()
  for (const m of low) cluster.expandByObject(m)
  const from = cluster.getCenter(new THREE.Vector3())
  const to = new THREE.Vector3()
  headBone.getWorldPosition(to)
  const delta = to.sub(from)
  if (delta.lengthSq() < 1e-4) return 0

  for (const m of low) {
    m.geometry.translate(delta.x, delta.y, delta.z)
    m.geometry.attributes.position.needsUpdate = true
    m.geometry.computeBoundingBox()
    m.geometry.computeBoundingSphere()
    ;(m as THREE.Mesh & { boundingBox: THREE.Box3 | null }).boundingBox = null
    ;(m as THREE.Mesh & { boundingSphere: THREE.Sphere | null }).boundingSphere = null
  }
  root.updateMatrixWorld(true)
  return low.length
}

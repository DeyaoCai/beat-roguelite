import * as THREE from 'three'

export type JiggleSim = {
  tick: (dt: number) => void
  reset: () => void
}

type Spec = {
  name: string
  /** Mass offset in bone-local. Breast +X≈forward, +Y≈down; Hip −X≈back. */
  offset: THREE.Vector3
  stiff: number
  damp: number
  gravity: number
  maxAngle: number
}

const SPECS: Spec[] = [
  { name: 'Breast_L', offset: new THREE.Vector3(0.05, 0.09, 0), stiff: 240, damp: 9, gravity: 11, maxAngle: 0.42 },
  { name: 'Breast_R', offset: new THREE.Vector3(0.05, 0.09, 0), stiff: 240, damp: 9, gravity: 11, maxAngle: 0.42 },
  { name: 'Hip_L', offset: new THREE.Vector3(-0.07, 0.05, 0), stiff: 320, damp: 11, gravity: 7, maxAngle: 0.28 },
  { name: 'Hip_R', offset: new THREE.Vector3(-0.07, 0.05, 0), stiff: 320, damp: 11, gravity: 7, maxAngle: 0.28 },
]

type Node = {
  bone: THREE.Bone
  parent: THREE.Object3D
  bind: THREE.Quaternion
  offset: THREE.Vector3
  stiff: number
  damp: number
  gravity: number
  maxAngle: number
  tip: THREE.Vector3
  vel: THREE.Vector3
  prevRest: THREE.Vector3
  primed: boolean
}

const _origin = new THREE.Vector3()
const _restTip = new THREE.Vector3()
const _restDir = new THREE.Vector3()
const _simDir = new THREE.Vector3()
const _force = new THREE.Vector3()
const _axis = new THREE.Vector3()
const _pw = new THREE.Quaternion()
const _bw = new THREE.Quaternion()
const _swing = new THREE.Quaternion()
const _clampQ = new THREE.Quaternion()

/**
 * Post-mixer secondary motion on TKA physics bones (Breast / Hip).
 * Mixer pose is the kinematic parent; these bones stay at bind then lag it.
 */
export function createJiggle(root: THREE.Object3D): JiggleSim {
  const byName = new Map<string, THREE.Bone>()
  root.traverse((obj) => {
    if ((obj as THREE.Bone).isBone) byName.set(obj.name, obj as THREE.Bone)
  })

  const nodes: Node[] = []
  for (const spec of SPECS) {
    const bone = byName.get(spec.name)
    if (!bone?.parent) continue
    nodes.push({
      bone,
      parent: bone.parent,
      bind: bone.quaternion.clone(),
      offset: spec.offset.clone(),
      stiff: spec.stiff,
      damp: spec.damp,
      gravity: spec.gravity,
      maxAngle: spec.maxAngle,
      tip: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      prevRest: new THREE.Vector3(),
      primed: false,
    })
  }

  const reset = () => {
    for (const n of nodes) {
      n.primed = false
      n.vel.set(0, 0, 0)
    }
  }

  const step = (n: Node, dt: number) => {
    n.bone.getWorldPosition(_origin)
    _restTip.copy(n.offset).applyMatrix4(n.bone.matrixWorld)
    if (!n.primed || _restTip.distanceToSquared(n.prevRest) > 0.35 * 0.35) {
      n.tip.copy(_restTip)
      n.prevRest.copy(_restTip)
      n.vel.set(0, 0, 0)
      n.primed = true
      return
    }
    n.prevRest.copy(_restTip)

    _force.subVectors(_restTip, n.tip).multiplyScalar(n.stiff)
    _force.y -= n.gravity
    n.vel.addScaledVector(_force, dt)
    n.vel.multiplyScalar(Math.exp(-n.damp * dt))
    n.tip.addScaledVector(n.vel, dt)

    _restDir.subVectors(_restTip, _origin)
    const restLen = _restDir.length()
    if (restLen < 1e-5) return
    _simDir.subVectors(n.tip, _origin)
    if (_simDir.lengthSq() < 1e-10) _simDir.copy(_restDir)
    const ang = _restDir.angleTo(_simDir)
    if (ang > n.maxAngle && ang > 1e-6) {
      _axis.crossVectors(_restDir, _simDir)
      if (_axis.lengthSq() < 1e-12) _axis.set(1, 0, 0)
      else _axis.normalize()
      _simDir.copy(_restDir).applyQuaternion(_clampQ.setFromAxisAngle(_axis, n.maxAngle))
    }
    _simDir.normalize()
    _restDir.multiplyScalar(1 / restLen)
    n.tip.copy(_origin).addScaledVector(_simDir, restLen)

    n.parent.getWorldQuaternion(_pw)
    _bw.setFromRotationMatrix(n.bone.matrixWorld)
    _swing.setFromUnitVectors(_restDir, _simDir)
    n.bone.quaternion.copy(_pw).invert().multiply(_swing).multiply(_bw)
  }

  const tick = (dt: number) => {
    if (!nodes.length) return
    const clamped = Math.min(0.05, Math.max(0, dt))
    if (clamped < 1e-5) return
    for (const n of nodes) n.bone.quaternion.copy(n.bind)
    root.updateMatrixWorld(true)
    let left = clamped
    while (left > 1e-5) {
      const h = Math.min(left, 1 / 60)
      for (const n of nodes) step(n, h)
      left -= h
    }
  }

  return { tick, reset }
}

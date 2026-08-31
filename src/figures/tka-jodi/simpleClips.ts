import * as THREE from 'three'

export type SimpleClipId = 'walk' | 'cast' | 'walkcast'

type Bind = {
  local: THREE.Quaternion
  parentWorld: THREE.Quaternion
}

function captureBind(root: THREE.Object3D): Map<string, Bind> {
  root.updateMatrixWorld(true)
  const out = new Map<string, Bind>()
  const pw = new THREE.Quaternion()
  root.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone) return
    if (obj.parent) obj.parent.getWorldQuaternion(pw)
    else pw.identity()
    out.set(obj.name, {
      local: (obj as THREE.Bone).quaternion.clone(),
      parentWorld: pw.clone(),
    })
  })
  return out
}

function localSwing(bind: Bind, axis: THREE.Vector3, angle: number, target: THREE.Quaternion) {
  const bindWorld = bind.parentWorld.clone().multiply(bind.local)
  const swing = new THREE.Quaternion().setFromAxisAngle(axis, angle)
  target.copy(bind.parentWorld).invert().multiply(swing.multiply(bindWorld))
}

function track(
  name: string,
  bind: Bind,
  times: number[],
  angles: number[],
  axis: THREE.Vector3,
): THREE.QuaternionKeyframeTrack {
  const q = new THREE.Quaternion()
  const values = new Float32Array(times.length * 4)
  for (let i = 0; i < times.length; i++) {
    localSwing(bind, axis, angles[i]!, q)
    values[i * 4] = q.x
    values[i * 4 + 1] = q.y
    values[i * 4 + 2] = q.z
    values[i * 4 + 3] = q.w
  }
  return new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values)
}

const AX = new THREE.Vector3(1, 0, 0)
const AY = new THREE.Vector3(0, 1, 0)
const AZ = new THREE.Vector3(0, 0, 1)

function add(
  tracks: THREE.KeyframeTrack[],
  binds: Map<string, Bind>,
  name: string,
  times: number[],
  angles: number[],
  axis: THREE.Vector3,
) {
  const bind = binds.get(name)
  if (!bind) return
  tracks.push(track(name, bind, times, angles, axis))
}

/** In-place walk. Legs swing on world X; arms oppose. */
export function makeWalkClip(root: THREE.Object3D): THREE.AnimationClip {
  const binds = captureBind(root)
  const n = 9
  const dur = 0.8
  const times = Array.from({ length: n }, (_, i) => (i / (n - 1)) * dur)
  const wave = times.map((t) => Math.sin((t / dur) * Math.PI * 2))
  const tracks: THREE.KeyframeTrack[] = []
  add(tracks, binds, 'thigh_l', times, wave.map((s) => s * 0.55), AX)
  add(tracks, binds, 'thigh_r', times, wave.map((s) => s * -0.55), AX)
  add(tracks, binds, 'calf_l', times, wave.map((s) => Math.max(0, -s) * 0.7), AX)
  add(tracks, binds, 'calf_r', times, wave.map((s) => Math.max(0, s) * 0.7), AX)
  add(tracks, binds, 'upperarm_l', times, wave.map((s) => s * -0.4), AX)
  add(tracks, binds, 'upperarm_r', times, wave.map((s) => s * 0.4), AX)
  add(tracks, binds, 'pelvis', times, wave.map((s) => s * 0.08), AZ)
  add(tracks, binds, 'spine_01', times, wave.map((s) => s * -0.06), AZ)
  return new THREE.AnimationClip('simple-walk', dur, tracks)
}

/** Raise the right arm, hold, return — loops. */
export function makeCastClip(root: THREE.Object3D): THREE.AnimationClip {
  const binds = captureBind(root)
  const times = [0, 0.28, 0.55, 0.95, 1.25]
  const lift = [0, 0.85, 1, 1, 0]
  const tracks: THREE.KeyframeTrack[] = []
  add(tracks, binds, 'upperarm_r', times, lift.map((k) => k * -1.15), AX)
  add(tracks, binds, 'lowerarm_r', times, lift.map((k) => k * -0.55), AX)
  add(tracks, binds, 'clavicle_r', times, lift.map((k) => k * -0.25), AZ)
  add(tracks, binds, 'upperarm_l', times, lift.map((k) => k * -0.25), AX)
  add(tracks, binds, 'spine_01', times, lift.map((k) => k * 0.2), AY)
  add(tracks, binds, 'spine_02', times, lift.map((k) => k * 0.12), AY)
  add(tracks, binds, 'neck_01', times, lift.map((k) => k * 0.15), AX)
  return new THREE.AnimationClip('simple-cast', times[times.length - 1]!, tracks)
}

function addMany(
  tracks: THREE.KeyframeTrack[],
  binds: Map<string, Bind>,
  name: string,
  times: number[],
  swingsAt: { axis: THREE.Vector3; angle: number }[][],
) {
  const bind = binds.get(name)
  if (!bind) return
  const q = new THREE.Quaternion()
  const values = new Float32Array(times.length * 4)
  for (let i = 0; i < times.length; i++) {
    const bindWorld = bind.parentWorld.clone().multiply(bind.local)
    let world = bindWorld
    for (const s of swingsAt[i] ?? []) {
      if (Math.abs(s.angle) < 1e-6) continue
      world = new THREE.Quaternion().setFromAxisAngle(s.axis, s.angle).multiply(world)
    }
    q.copy(bind.parentWorld).invert().multiply(world)
    values[i * 4] = q.x
    values[i * 4 + 1] = q.y
    values[i * 4 + 2] = q.z
    values[i * 4 + 3] = q.w
  }
  tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values))
}

function castLift(t: number): number {
  const cycle = 1.25
  const u = ((t % cycle) + cycle) % cycle
  const keys = [0, 0.28, 0.55, 0.95, 1.25]
  const vals = [0, 0.85, 1, 1, 0]
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i]!) {
      const a = keys[i - 1]!, b = keys[i]!
      const k = (u - a) / (b - a)
      return vals[i - 1]! + (vals[i]! - vals[i - 1]!) * k
    }
  }
  return 0
}

/** Walk legs + looping cast on the arms. */
export function makeWalkCastClip(root: THREE.Object3D): THREE.AnimationClip {
  const binds = captureBind(root)
  const dur = 5
  const n = 41
  const times = Array.from({ length: n }, (_, i) => (i / (n - 1)) * dur)
  const tracks: THREE.KeyframeTrack[] = []
  const per = times.map((t) => {
    const s = Math.sin((t / 0.8) * Math.PI * 2)
    const k = castLift(t)
    return { s, k }
  })
  addMany(tracks, binds, 'thigh_l', times, per.map(({ s }) => [{ axis: AX, angle: s * 0.55 }]))
  addMany(tracks, binds, 'thigh_r', times, per.map(({ s }) => [{ axis: AX, angle: s * -0.55 }]))
  addMany(tracks, binds, 'calf_l', times, per.map(({ s }) => [{ axis: AX, angle: Math.max(0, -s) * 0.7 }]))
  addMany(tracks, binds, 'calf_r', times, per.map(({ s }) => [{ axis: AX, angle: Math.max(0, s) * 0.7 }]))
  addMany(tracks, binds, 'pelvis', times, per.map(({ s }) => [{ axis: AZ, angle: s * 0.08 }]))
  addMany(
    tracks,
    binds,
    'upperarm_l',
    times,
    per.map(({ s, k }) => [{ axis: AX, angle: s * -0.4 + k * -0.25 }]),
  )
  addMany(
    tracks,
    binds,
    'upperarm_r',
    times,
    per.map(({ s, k }) => [{ axis: AX, angle: s * 0.4 + k * -1.15 }]),
  )
  addMany(tracks, binds, 'lowerarm_r', times, per.map(({ k }) => [{ axis: AX, angle: k * -0.55 }]))
  addMany(tracks, binds, 'clavicle_r', times, per.map(({ k }) => [{ axis: AZ, angle: k * -0.25 }]))
  addMany(
    tracks,
    binds,
    'spine_01',
    times,
    per.map(({ s, k }) => [
      { axis: AZ, angle: s * -0.06 },
      { axis: AY, angle: k * 0.2 },
    ]),
  )
  addMany(tracks, binds, 'spine_02', times, per.map(({ k }) => [{ axis: AY, angle: k * 0.12 }]))
  addMany(tracks, binds, 'neck_01', times, per.map(({ k }) => [{ axis: AX, angle: k * 0.15 }]))
  return new THREE.AnimationClip('simple-walkcast', dur, tracks)
}

export function makeSimpleClip(root: THREE.Object3D, id: SimpleClipId): THREE.AnimationClip {
  if (id === 'walk') return makeWalkClip(root)
  if (id === 'cast') return makeCastClip(root)
  return makeWalkCastClip(root)
}

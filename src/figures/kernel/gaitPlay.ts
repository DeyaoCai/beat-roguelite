import * as THREE from 'three'
import { restSkeleton, retargetClip } from './anim'
import type { Gait } from '../types'

export type GaitPack = Partial<Record<Gait, THREE.AnimationClip>> & {
  cast?: THREE.AnimationClip
}

const CAST_MAX = 0.5

/** One looping clip at a time on a skinned root. Shared by packed-glb figures. */
export function createGaitPlayer() {
  let mixer: THREE.AnimationMixer | null = null
  let mixerRoot: THREE.Object3D | null = null
  let gaits: GaitPack = {}
  let current: Gait | null = null
  let pending: Gait | null = 'idle'
  let oneShot = false
  let castLeft = 0

  const apply = () => {
    if (!mixer || !mixerRoot || pending == null || oneShot) return
    const next: Gait = pending === 'run' && !gaits.run ? 'walk' : pending
    const clip = gaits[next] ?? gaits.walk ?? gaits.idle
    if (!clip) return
    if (current === next) return
    current = next
    mixer.stopAllAction()
    restSkeleton(mixerRoot)
    const action = mixer.clipAction(retargetClip(clip, mixerRoot))
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.play()
  }

  const endCast = () => {
    if (!oneShot) return
    oneShot = false
    castLeft = 0
    current = null
    apply()
  }

  return {
    attach(root: THREE.Object3D, next: GaitPack) {
      mixerRoot = root
      mixer = new THREE.AnimationMixer(root)
      gaits = next
      oneShot = false
      current = null
      apply()
    },
    play(gait: Gait) {
      pending = gait
      apply()
    },
    playCast() {
      const clip = gaits.cast
      if (!mixer || !mixerRoot || !clip) return
      oneShot = true
      mixer.stopAllAction()
      restSkeleton(mixerRoot)
      const bound = retargetClip(clip, mixerRoot)
      const action = mixer.clipAction(bound)
      action.reset()
      action.setLoop(THREE.LoopOnce, 1)
      action.clampWhenFinished = true
      const dur = bound.duration > CAST_MAX ? CAST_MAX : bound.duration
      if (bound.duration > CAST_MAX && bound.duration > 1e-4) {
        action.timeScale = bound.duration / CAST_MAX
      }
      castLeft = Math.max(0.12, dur)
      action.play()
    },
    tick(dt: number) {
      mixer?.update(dt)
      if (!oneShot) return
      castLeft -= dt
      if (castLeft <= 0) endCast()
    },
  }
}

import * as THREE from 'three'
import type { Gait } from '../types'
import type { GaitPack } from '../kernel/gaitPlay'

function byName(clips: THREE.AnimationClip[], name: string): THREE.AnimationClip | undefined {
  const want = name.toLowerCase()
  return clips.find((c) => c.name.toLowerCase() === want)
}

export function bindGaits(clips: THREE.AnimationClip[]): GaitPack {
  const idle = byName(clips, 'idle')
  const walk = byName(clips, 'walk')
  const run = byName(clips, 'run')
  const cast = byName(clips, 'cast')
  const pack: GaitPack = {}
  if (idle) pack.idle = idle
  if (walk) pack.walk = walk
  if (run) pack.run = run
  if (cast) pack.cast = cast
  if (!pack.walk && pack.idle) pack.walk = pack.idle
  if (!pack.idle && pack.walk) pack.idle = pack.walk
  return pack
}

export function pickClip(clips: THREE.AnimationClip[], want: Gait): THREE.AnimationClip | null {
  return bindGaits(clips)[want] ?? null
}

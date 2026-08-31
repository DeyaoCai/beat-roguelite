import type * as THREE from 'three'
import { loadGltfClips } from '../kernel/clips'
import { tkaModelsUrl, resolveFigureRel } from '../pack'
import type { FigureManifest, Gait } from '../types'

async function clipAt(url: string): Promise<THREE.AnimationClip | null> {
  try {
    const pack = await loadGltfClips(url)
    return pack.clips[0] ?? null
  } catch {
    return null
  }
}

async function fromTkaAnim(want: 'walk' | 'idle'): Promise<THREE.AnimationClip | null> {
  try {
    const res = await fetch(tkaModelsUrl('TKA_Anim', 'files.json'))
    if (!res.ok) return null
    const data = (await res.json()) as { files?: string[] }
    const prefer = want === 'walk' ? /walk|jog|run|sprint/i : /idle/i
    const skip = /zombie|mutant|boss|enemy/i
    const hit = (data.files ?? []).find((f) => prefer.test(f) && !skip.test(f))
    if (!hit) return null
    return clipAt(tkaModelsUrl(...hit.split('/')))
  } catch {
    return null
  }
}

export type CombatGaits = Record<Gait, THREE.AnimationClip | null>

export async function loadCombatLocomotion(manifest: FigureManifest): Promise<CombatGaits | null> {
  const walkUrl = manifest.gaits.walk ? resolveFigureRel(manifest.id, manifest.gaits.walk) : null
  const idleUrl = manifest.gaits.idle ? resolveFigureRel(manifest.id, manifest.gaits.idle) : null
  const runUrl = manifest.gaits.run ? resolveFigureRel(manifest.id, manifest.gaits.run) : null

  const walk =
    (walkUrl ? await clipAt(walkUrl) : null) ?? (await fromTkaAnim('walk'))
  if (!walk) return null
  const idle =
    (idleUrl ? await clipAt(idleUrl) : null) ?? (await fromTkaAnim('idle')) ?? walk
  const run = runUrl ? await clipAt(runUrl) : null
  return { walk, idle, run }
}

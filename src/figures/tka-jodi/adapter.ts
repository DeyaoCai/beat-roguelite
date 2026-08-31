import * as THREE from 'three'
import { restSkeleton } from '../kernel'
import { createWardrobeApi } from '../../wardrobe/preview'
import { loadFigureManifest } from '../manifest'
import { resolveFigureRel, TKA_JODI_ID } from '../pack'
import type { CreatedHero, FigureManifest, Gait, WardrobeHooks } from '../types'
import { loadCombatLocomotion, type CombatGaits } from './combatLocomotion'
import { createModularAvatar } from './modularAvatar'
import { makeCastClip, makeWalkCastClip } from './simpleClips'

export const TKA_JODI_DEFAULT: FigureManifest = {
  id: TKA_JODI_ID,
  caption: 'Jodi（致命解药）',
  body: 'models/user2/user.glb',
  height: 1.7,
  gaits: {
    idle: 'models/Achates_Poses/Maid_iDLE_Anim.glb',
    walk: 'models/Achates_Sprint/JodiSprint6_bake.glb',
  },
  capabilities: { wardrobe: true, poses: true, jiggle: true },
}

async function loadManifest(): Promise<FigureManifest> {
  return loadFigureManifest(TKA_JODI_DEFAULT)
}

function simpleFallback(skin: THREE.Object3D): CombatGaits {
  return {
    walk: makeWalkCastClip(skin),
    idle: makeCastClip(skin),
    run: null,
  }
}

export function createTkaJodiFigure(hooks: WardrobeHooks = {}): CreatedHero {
  const seed = TKA_JODI_DEFAULT
  const avatar = createModularAvatar({
    body: {
      url: resolveFigureRel(seed.id, seed.body),
      shading: 'lit',
      material: { roughness: 0.72, metalness: 0 },
    },
    targetHeight: seed.height,
    jiggle: seed.capabilities.jiggle,
  })
  const wardrobe = createWardrobeApi(avatar, hooks)

  let gaits: CombatGaits | null = null
  let current: Gait | null = null
  let pending: Gait | null = null
  let castClip: THREE.AnimationClip | null = null
  let castLeft = 0

  const applyGait = () => {
    if (!gaits || pending == null || castLeft > 0) return
    const next: Gait = pending === 'run' && !gaits.run ? 'walk' : pending
    if (current === next) return
    current = next
    const clip = gaits[next] ?? gaits.walk
    if (clip) avatar.playClip(clip, true)
  }

  const ready = (async () => {
    const manifest = await loadManifest()
    await avatar.ready
    const loaded = await loadCombatLocomotion(manifest)
    const skin = avatar.getSkinRoot()
    if (skin) castClip = makeCastClip(skin)
    if (loaded) {
      gaits = loaded
    } else {
      const skin = avatar.getSkinRoot()
      if (skin) {
        const saved: { bone: THREE.Bone; q: THREE.Quaternion; p: THREE.Vector3; s: THREE.Vector3 }[] =
          []
        skin.traverse((obj) => {
          if (!(obj as THREE.Bone).isBone) return
          const bone = obj as THREE.Bone
          saved.push({
            bone,
            q: bone.quaternion.clone(),
            p: bone.position.clone(),
            s: bone.scale.clone(),
          })
        })
        restSkeleton(skin)
        skin.updateMatrixWorld(true)
        gaits = simpleFallback(skin)
        castClip = makeCastClip(skin)
        for (const row of saved) {
          row.bone.quaternion.copy(row.q)
          row.bone.position.copy(row.p)
          row.bone.scale.copy(row.s)
        }
        skin.updateMatrixWorld(true)
      }
    }
    applyGait()
  })()

  const playGait = (gait: Gait) => {
    pending = gait
    applyGait()
  }

  const playCast = () => {
    const skin = avatar.getSkinRoot()
    const clip = castClip ?? (skin ? makeCastClip(skin) : null)
    if (!clip) return
    castClip = clip
    castLeft = 0.45
    current = null
    avatar.playClip(clip, true)
  }

  return {
    figure: {
      id: TKA_JODI_ID,
      root: avatar.root,
      ready,
      capabilities: seed.capabilities,
      getFrame: () => avatar.getFrame(),
      playGait,
      playCast,
      tick: (dt, beatPhase, audio) => {
        if (castLeft > 0) {
          castLeft -= dt
          if (castLeft <= 0) {
            castLeft = 0
            current = null
            applyGait()
          }
        }
        avatar.tick(dt, beatPhase, audio)
      },
      setOutline: (color, width) => avatar.setOutline(color, width),
    },
    wardrobe,
  }
}

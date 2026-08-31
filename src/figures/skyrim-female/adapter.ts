import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createGaitPlayer, fitGroupToHeight, restSkeleton, setAvatarOutline } from '../kernel'
import { resolveFigureRel, SKYRIM_FEMALE_ID } from '../pack'
import type { CreatedHero, HeroFrame } from '../types'
import { bindGaits } from './gaits'
import { hardenSkinMaterials } from './materials'
import { loadSkyrimManifest, SKYRIM_FEMALE_DEFAULT } from './manifest'
import { faceCamera, maybeUpright } from './pose'

export { SKYRIM_FEMALE_DEFAULT }

export function createSkyrimFemaleFigure(): CreatedHero {
  const fit = new THREE.Group()
  fit.name = 'fit'
  let frame: HeroFrame = {
    height: SKYRIM_FEMALE_DEFAULT.height,
    width: SKYRIM_FEMALE_DEFAULT.height * 0.3,
  }
  let fitted = false
  const gaits = createGaitPlayer()

  const ready = (async () => {
    const manifest = await loadSkyrimManifest()
    const rel = manifest.body || SKYRIM_FEMALE_DEFAULT.body
    const gltf = await new GLTFLoader().loadAsync(resolveFigureRel(SKYRIM_FEMALE_ID, rel))
    const body = gltf.scene
    body.name = 'body'
    maybeUpright(body)
    faceCamera(body)
    hardenSkinMaterials(body)
    restSkeleton(body)
    fit.add(body)
    frame = fitGroupToHeight(fit, manifest.height, 0)
    fitted = true
    gaits.attach(body, bindGaits(gltf.animations ?? []))
  })()

  return {
    figure: {
      id: SKYRIM_FEMALE_ID,
      root: fit,
      ready,
      capabilities: SKYRIM_FEMALE_DEFAULT.capabilities,
      getFrame: () => frame,
      playGait: (gait) => gaits.play(gait),
      playCast: () => gaits.playCast(),
      tick: (dt) => gaits.tick(dt),
      setOutline: (color, width) => {
        if (!fitted) return
        setAvatarOutline(fit, color, width)
      },
    },
  }
}

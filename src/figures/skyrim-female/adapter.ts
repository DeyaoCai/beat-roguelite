import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import {
  createGaitPlayer,
  fitGroupToHeight,
  restSkeleton,
  setAvatarOutline,
  tickAvatarAura,
} from '../kernel'
import { hubFigureCaption } from '../catalog'
import { resolveFigureRel, SKYRIM_FEMALE_ID } from '../pack'
import type { CreatedHero, FigureManifest, HeroFrame } from '../types'
import { bindGaits } from './gaits'
import { hardenSkinMaterials } from './materials'
import { loadFigureManifest } from '../manifest'
import { faceCamera, maybeUpright } from './pose'

export function skyrimPackDefault(id: string): FigureManifest {
  return {
    id,
    caption: hubFigureCaption(id) || 'Skyrim',
    body: 'models/body.glb',
    height: 1.7,
    gaits: {},
    capabilities: { wardrobe: false, poses: false, jiggle: false },
    voices: 'voices/voices.json',
  }
}

export const SKYRIM_FEMALE_DEFAULT = skyrimPackDefault(SKYRIM_FEMALE_ID)

export function createSkyrimFemaleFigure(packId: string = SKYRIM_FEMALE_ID): CreatedHero {
  const fallback = skyrimPackDefault(packId)
  const fit = new THREE.Group()
  fit.name = 'fit'
  let frame: HeroFrame = {
    height: fallback.height,
    width: fallback.height * 0.3,
  }
  let fitted = false
  const gaits = createGaitPlayer()

  const ready = (async () => {
    const manifest = await loadFigureManifest(fallback)
    const rel = manifest.body || fallback.body
    const gltf = await new GLTFLoader().loadAsync(resolveFigureRel(packId, rel))
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
      id: packId,
      root: fit,
      ready,
      capabilities: fallback.capabilities,
      getFrame: () => frame,
      playGait: (gait) => gaits.play(gait),
      playCast: () => gaits.playCast(),
      tick: (dt, beatPhase, audio) => {
        gaits.tick(dt)
        if (fitted) tickAvatarAura(fit, dt, beatPhase, audio)
      },
      setOutline: (color, width) => {
        if (!fitted) return
        setAvatarOutline(fit, color, width)
      },
    },
  }
}

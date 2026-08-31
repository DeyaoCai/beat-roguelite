import { SKYRIM_FEMALE_ID } from '../pack'
import { loadFigureManifest } from '../manifest'
import type { FigureManifest } from '../types'

export const SKYRIM_FEMALE_DEFAULT: FigureManifest = {
  id: SKYRIM_FEMALE_ID,
  caption: 'Skyrim 3BA',
  body: 'models/body.glb',
  height: 1.7,
  gaits: {},
  capabilities: { wardrobe: false, poses: false, jiggle: false },
  voices: 'voices/voices.json',
}

export function loadSkyrimManifest(): Promise<FigureManifest> {
  return loadFigureManifest(SKYRIM_FEMALE_DEFAULT)
}

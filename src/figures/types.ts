import type * as THREE from 'three'
import type { WardrobeApi } from '../wardrobe/preview'

export type Gait = 'idle' | 'walk' | 'run'

/** Beat / spectrum drive for outline aura. Owned by Figure BC, not presentation. */
export type AuraAudio = {
  spectrum?: Float32Array
  bass?: number
  mid?: number
  energy?: number
}

export type HeroFrame = { height: number; width: number }

export type HeroCaps = {
  wardrobe: boolean
  poses: boolean
  jiggle: boolean
}

export type HeroFigure = {
  id: string
  root: THREE.Object3D
  ready: Promise<void>
  capabilities: HeroCaps
  getFrame(): HeroFrame
  playGait(gait: Gait): void
  /** One-shot attack/cast. No-op if the pack has no clip. */
  playCast(): void
  tick(dt: number, beatPhase?: number, audio?: AuraAudio): void
  setOutline(color: number, width: number): void
}

export type FigureManifest = {
  id: string
  caption: string
  body: string
  height: number
  gaits: {
    idle?: string
    walk?: string
    run?: string
  }
  capabilities: HeroCaps
  /** Optional bark catalog, relative to pack root. */
  voices?: string
}

export type ActiveFigureFile = { id: string }

export type WardrobeHooks = {
  onShot?: (shot: import('../wardrobe/preview').PreviewShot) => void
  getShot?: () => import('../wardrobe/preview').PreviewShot
}

export type CreatedHero = {
  figure: HeroFigure
  wardrobe?: WardrobeApi
}

import * as THREE from 'three'
import { CLOTHES_TYPE_NAMES, type ClothesTypeName } from '../../wardrobe/catalog'
import {
  captureBindPose,
  firstSkeleton,
  fitGroupToHeight,
  rebindSkinnedMeshes,
  restSkeleton,
  retargetClip,
  setAvatarOutline,
  syncAvatarOutlines,
  tickAvatarAura,
  type FittedFrame,
} from '../kernel'
import type { AuraAudio } from '../types'
import {
  applyHairDye,
  collectDyeParts,
  isFaceFeatureName,
  isHiddenDyePart,
  isLensMaterialName,
  loadOutfitLayer,
  type HairDye,
  type OutfitPart,
} from '../../presentation/render/gltfModel'
import { createJiggle, type JiggleSim } from './jiggle'

export type ModularAvatar = {
  root: THREE.Group
  ready: Promise<void>
  /** Body frame after height-fit. Clothes swaps do not change this. */
  getFrame(): FittedFrame
  setSlot(slot: ClothesTypeName, part: OutfitPart | null): Promise<void>
  setSlotColor(slot: ClothesTypeName, hex: number): void
  setSlotPartColor(slot: ClothesTypeName, matName: string, hex: number): void
  listSlotParts(slot: ClothesTypeName): string[]
  /** @deprecated use setSlotPartColor on lens materials */
  setLensColor(hex: number): void
  setHairDye(dye: HairDye): void
  getSkinRoot(): THREE.Object3D | null
  /** Play a clip on the shared body skeleton. Null = bind pose. */
  playClip(
    clip: THREE.AnimationClip | null,
    loop: boolean,
    rest?: Map<string, THREE.Quaternion>,
  ): void
  tick(dt: number, beatPhase?: number, audio?: AuraAudio): void
  /** Super-Saiyan style aura tint + intensity (width≈0.01 quiet, 0.02 fever). */
  setOutline(color: number, width: number): void
}

/**
 * Layers (parent → child):
 *   playerRoot (play: xz on the arena; title: identity at world origin)
 *     avatarScale (play pawn scale only)
 *       fit  ← this `root`: height-fit once, feet at local y=0
 *         slot:Skin | Hair | Dress | Skirt | …
 *
 * Clothes share the body's skeleton. Swapping a slot rebinds skins; no re-fit.
 */
export function createModularAvatar(opts: {
  body: OutfitPart
  /** Canonical height in meters (glTF / UE-after-cm). */
  targetHeight: number
  yLift?: number
  jiggle?: boolean
}): ModularAvatar {
  const fit = new THREE.Group()
  fit.name = 'fit'
  const useJiggle = opts.jiggle !== false

  const holders = {} as Record<ClothesTypeName, THREE.Group>
  const cache = new Map<string, THREE.Group>()
  const inflight = new Map<string, Promise<THREE.Group>>()
  let canonicalBody: THREE.Group | null = null

  for (const slot of CLOTHES_TYPE_NAMES) {
    const g = new THREE.Group()
    g.name = `slot:${slot}`
    fit.add(g)
    holders[slot] = g
  }

  const partKey = (part: OutfitPart) =>
    [
      part.url,
      part.shading ?? 'lit',
      part.textures?.map ?? '',
      part.textures?.ormMap ?? '',
      part.hair?.rootMap ?? '',
      part.hair?.opacityMap ?? '',
      part.mapsTarget ?? 'all',
    ].join('|')

  const slotColor: Partial<Record<ClothesTypeName, number>> = {}
  const slotPartColor: Partial<Record<ClothesTypeName, Record<string, number>>> = {}
  let lensColor: number | null = null
  let hairDye: HairDye = { root: 0xffffff, tip: 0xffffff }
  let bodySkeleton: THREE.Skeleton | null = null
  let mixer: THREE.AnimationMixer | null = null
  let mixerRoot: THREE.Object3D | null = null
  let lastClip: {
    clip: THREE.AnimationClip
    loop: boolean
    rest?: Map<string, THREE.Quaternion>
  } | null = null
  let jiggle: JiggleSim | null = null

  const captureBodyRig = (layer: THREE.Object3D) => {
    mixer?.stopAllAction()
    mixerRoot = layer
    bodySkeleton = firstSkeleton(layer)
    mixer = new THREE.AnimationMixer(layer)
    restSkeleton(layer)
    captureBindPose(layer)
    jiggle = useJiggle ? createJiggle(layer) : null
    if (lastClip) playClip(lastClip.clip, lastClip.loop, lastClip.rest)
  }

  const bindLayer = (layer: THREE.Object3D) => {
    if (!bodySkeleton) return
    rebindSkinnedMeshes(layer, bodySkeleton)
  }

  const tintHolder = (slot: ClothesTypeName) => {
    if (slot === 'Hair') {
      applyHairDye(holders.Hair, hairDye)
      return
    }
    const hex = slotColor[slot]
    const parts = slotPartColor[slot] ?? {}
    holders[slot].traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue
        const name = m.name ?? ''
        if (isHiddenDyePart(name)) continue
        const partHex = parts[name]
        if (partHex != null) {
          m.color.setHex(partHex)
          continue
        }
        if (isLensMaterialName(name) && lensColor != null) {
          m.color.setHex(lensColor)
          continue
        }
        if (hex == null) continue
        if (slot === 'Skin' && (isFaceFeatureName(name) || isFaceFeatureName(obj.name))) continue
        m.color.setHex(hex)
      }
    })
  }

  let frame: FittedFrame = {
    scale: 1,
    height: opts.targetHeight,
    width: opts.targetHeight * 0.3,
  }
  let fitted = false

  let fade: { root: THREE.Object3D; t: number } | null = null

  const applyFade = (root: THREE.Object3D, k: number) => {
    const env = 0.18 + 0.82 * k
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (m instanceof THREE.MeshStandardMaterial) m.envMapIntensity = env
      }
    })
  }

  const tick = (dt: number, beatPhase?: number, audio?: AuraAudio) => {
    mixer?.update(dt)
    jiggle?.tick(dt)
    if (fitted) tickAvatarAura(fit, dt, beatPhase, audio)
    if (!fade) return
    fade.t = Math.min(1, fade.t + dt / 0.2)
    applyFade(fade.root, fade.t)
    if (fade.t >= 1) fade = null
  }

  const playClip = (
    clip: THREE.AnimationClip | null,
    loop: boolean,
    rest?: Map<string, THREE.Quaternion>,
  ) => {
    if (!mixer || !mixerRoot) return
    mixer.stopAllAction()
    jiggle?.reset()
    if (!clip) {
      lastClip = null
      restSkeleton(mixerRoot)
      return
    }
    lastClip = { clip, loop, rest }
    restSkeleton(mixerRoot)
    const bound = retargetClip(clip, mixerRoot)
    const action = mixer.clipAction(bound)
    action.reset()
    if (loop) {
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.clampWhenFinished = false
      action.paused = false
      action.play()
      return
    }
    action.setLoop(THREE.LoopOnce, 1)
    action.clampWhenFinished = true
    action.play()
    action.time = Math.max(0, bound.duration - 1 / 30)
    mixer.update(0)
    action.paused = true
  }

  const rebindClothes = () => {
    if (!bodySkeleton) return
    for (const slot of CLOTHES_TYPE_NAMES) {
      if (slot === 'Skin') continue
      const layer = holders[slot].children[0]
      if (layer) rebindSkinnedMeshes(layer, bodySkeleton)
    }
  }

  const restoreCanonicalBody = () => {
    if (!canonicalBody) return
    const holder = holders.Skin
    const current = holder.children[0]
    if (current === canonicalBody) return
    while (holder.children.length) holder.remove(holder.children[0]!)
    holder.add(canonicalBody)
    captureBodyRig(canonicalBody)
    rebindClothes()
  }

  const setSlot = async (slot: ClothesTypeName, part: OutfitPart | null) => {
    await ready
    if (slot === 'Skin' && (!part || part.url === opts.body.url)) {
      restoreCanonicalBody()
      tintHolder(slot)
      syncAvatarOutlines(fit)
      return
    }
    const holder = holders[slot]
    const current = holder.children[0]
    if (!part) {
      while (holder.children.length) holder.remove(holder.children[0]!)
      return
    }
    const key = partKey(part)
    let layer = cache.get(key)
    if (!layer) {
      let pending = inflight.get(key)
      if (!pending) {
        pending = loadOutfitLayer(part)
        inflight.set(key, pending)
      }
      layer = await pending
      cache.set(key, layer)
      inflight.delete(key)
    }
    if (current === layer) {
      tintHolder(slot)
      return
    }
    while (holder.children.length) holder.remove(holder.children[0]!)
    holder.add(layer)
    if (slot === 'Skin') {
      captureBodyRig(layer)
      rebindClothes()
    } else {
      bindLayer(layer)
    }
    tintHolder(slot)
    fade = { root: layer, t: 0 }
    applyFade(layer, 0)
    syncAvatarOutlines(fit)
  }

  const setSlotColor = (slot: ClothesTypeName, hex: number) => {
    slotColor[slot] = hex & 0xffffff
    tintHolder(slot)
  }

  const setSlotPartColor = (slot: ClothesTypeName, matName: string, hex: number) => {
    const bag = slotPartColor[slot] ?? (slotPartColor[slot] = {})
    bag[matName] = hex & 0xffffff
    tintHolder(slot)
  }

  const listSlotParts = (slot: ClothesTypeName) => collectDyeParts(holders[slot])

  const setLensColor = (hex: number) => {
    lensColor = hex & 0xffffff
    tintHolder('Face')
  }

  const setHairDye = (dye: HairDye) => {
    hairDye = { root: dye.root & 0xffffff, tip: dye.tip & 0xffffff }
    applyHairDye(holders.Hair, hairDye)
  }

  const getSkinRoot = () =>
    (holders.Skin.children[0] as THREE.Object3D | undefined) ?? canonicalBody

  const ready = (async () => {
    const body = await loadOutfitLayer(opts.body)
    body.name = 'body'
    canonicalBody = body
    holders.Skin.add(body)
    cache.set(partKey(opts.body), body)
    captureBodyRig(body)
    frame = fitGroupToHeight(fit, opts.targetHeight, opts.yLift ?? 0)
    fitted = true
    syncAvatarOutlines(fit)
  })()

  return {
    root: fit,
    ready,
    getFrame: () => frame,
    setSlot,
    setSlotColor,
    setSlotPartColor,
    listSlotParts,
    setLensColor,
    setHairDye,
    getSkinRoot,
    playClip,
    tick,
    setOutline: (color, width) => {
      if (!fitted) return
      setAvatarOutline(fit, color, width)
    },
  }
}

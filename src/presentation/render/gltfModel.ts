import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { HairCardMaps, ShadingModel } from '../../content/shading'
import { applyHairDye, loadHairCardTextures, patchHairCardMaterial, type HairDye } from './hairCard'

export { applyHairDye }
export type { HairDye }

import { TKA_MODELS_PUBLIC_ROOT, tkaModelsUrl } from '../../figures/pack'
import {
  fitGroupToHeight,
  fitGroupToRadius,
  loadGltfClips,
  type FittedFrame,
  type GltfClipPack,
} from '../../figures/kernel'

export { fitGroupToHeight, fitGroupToRadius, loadGltfClips }
export type { FittedFrame, GltfClipPack }

/** TKA figure pack models (`public/figures/tka-jodi/models`). */
export const MODELS_PUBLIC_ROOT = TKA_MODELS_PUBLIC_ROOT

export function modelUrl(...parts: string[]): string {
  return tkaModelsUrl(...parts)
}

export type ModelTextureMaps = {
  /** Albedo / base color (sRGB). */
  map?: string
  normalMap?: string
  /** UE/glTF packed ORM: R=AO, G=Roughness, B=Metallic. */
  ormMap?: string
  roughnessMap?: string
  metalnessMap?: string
  aoMap?: string
  emissiveMap?: string
}

export type ModelMaterialOpts = {
  color?: number
  roughness?: number
  metalness?: number
  emissive?: number
  emissiveIntensity?: number
  /** Multiply onto existing materials; default true. */
  preserveEmbeddedMaps?: boolean
}

export type LoadFittedGltfOpts = {
  targetRadius?: number
  yLift?: number
  /** Optional external maps when the GLB has none / incomplete materials. */
  textures?: ModelTextureMaps
  material?: ModelMaterialOpts
}

export type FittedModel = {
  root: THREE.Group
  /** Uniform scale applied so footprint ≈ targetRadius. */
  baseScale: number
}

const textureLoader = new THREE.TextureLoader()

export async function loadTexture(
  url: string,
  colorSpace: typeof THREE.SRGBColorSpace | typeof THREE.LinearSRGBColorSpace,
  wrap: THREE.Wrapping = THREE.RepeatWrapping,
): Promise<THREE.Texture> {
  const tex = await textureLoader.loadAsync(url)
  tex.colorSpace = colorSpace
  tex.flipY = false
  tex.wrapS = wrap
  tex.wrapT = wrap
  return tex
}

export async function resolveTextureMaps(
  maps: ModelTextureMaps | undefined,
  wrap: THREE.Wrapping = THREE.RepeatWrapping,
): Promise<Partial<Record<keyof ModelTextureMaps, THREE.Texture>>> {
  if (!maps) return {}
  const entries = Object.entries(maps).filter(([, u]) => !!u) as [keyof ModelTextureMaps, string][]
  const out: Partial<Record<keyof ModelTextureMaps, THREE.Texture>> = {}
  await Promise.all(
    entries.map(async ([key, url]) => {
      const space =
        key === 'map' || key === 'emissiveMap'
          ? THREE.SRGBColorSpace
          : THREE.LinearSRGBColorSpace
      out[key] = await loadTexture(url, space, wrap)
    }),
  )
  return out
}

export function fallbackAlbedo(matName: string): number | null {
  const n = matName.toLowerCase()
  if (n.includes('skin')) return 0xe2b496
  if (n.includes('mouth')) return 0xc47a86
  if (n.includes('lash')) return 0x1c1412
  if (n.includes('eye')) return 0xeef2f6
  return null
}

export function isFaceFeatureName(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.includes('lash') ||
    n.includes('eye') ||
    n.includes('iris') ||
    n.includes('pupil') ||
    n.includes('sclera') ||
    n.includes('cornea') ||
    n.includes('mouth') ||
    n.includes('teeth') ||
    n.includes('tongue') ||
    n.includes('oral')
  )
}

/** Glasses GLB material slots: `lens` / `lensColorable`, not the frame. */
export function isLensMaterialName(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('lens') || /(^|[^a-z])glass([^a-z]|$)/.test(n)
}

function isExplicitBodySkinName(name: string): boolean {
  const n = name.toLowerCase()
  if (isFaceFeatureName(n)) return false
  return (
    n.includes('skin') ||
    n.includes('body') ||
    n.includes('jodi') ||
    n.includes('female') ||
    n.includes('nude') ||
    n.includes('flesh') ||
    n.includes('torso')
  )
}

export function pickSkinPass(root: THREE.Object3D): { anyNamed: boolean; largest: THREE.Mesh | null } {
  let anyNamed = false
  let largest: THREE.Mesh | null = null
  let largestCount = 0
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      const label = `${obj.name} ${m?.name ?? ''}`
      if (isExplicitBodySkinName(label) || isExplicitBodySkinName(m?.name ?? '')) anyNamed = true
    }
    const n = obj.geometry?.getAttribute('position')?.count ?? 0
    const meshLabel = `${obj.name} ${mats.map((m) => m?.name ?? '').join(' ')}`
    if (n > largestCount && !isFaceFeatureName(meshLabel)) {
      largestCount = n
      largest = obj
    }
  })
  return { anyNamed, largest }
}

export function matGetsSkinMap(
  matName: string,
  meshName: string,
  anyNamed: boolean,
  isLargestMesh: boolean,
): boolean {
  const label = `${meshName} ${matName}`
  if (isFaceFeatureName(label) || isFaceFeatureName(matName) || isFaceFeatureName(meshName)) {
    return false
  }
  if (isExplicitBodySkinName(label) || isExplicitBodySkinName(matName) || isExplicitBodySkinName(meshName)) {
    return true
  }
  if (anyNamed) return false
  return isLargestMesh
}

function isClothProxyName(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('clothsimu') || n.includes('cloth_sim')
}

/** Physics / hidden slots — not rendered, not a dyeable part. */
export function isHiddenDyePart(name: string): boolean {
  const n = name.toLowerCase()
  if (isClothProxyName(n)) return true
  if (n.includes('invisible')) return true
  if (n === 'm_phy' || n.endsWith('_phy')) return true
  if (n.endsWith('_sim')) return true
  if (n.includes('collision') || n.includes('colmesh')) return true
  return false
}

/** Unique visible material names on a wardrobe layer (order = glTF slot order). */
export function collectDyeParts(root: THREE.Object3D): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj.visible === false) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      const name = (m?.name ?? '').trim()
      if (!name || isHiddenDyePart(name) || seen.has(name)) continue
      seen.add(name)
      out.push(name)
    }
  })
  return out
}

function applyMapsAndMaterial(
  root: THREE.Object3D,
  maps: Partial<Record<keyof ModelTextureMaps, THREE.Texture>>,
  matOpts: ModelMaterialOpts | undefined,
  hair?: {
    maps: Awaited<ReturnType<typeof loadHairCardTextures>>
    dye: HairDye
  },
  mapsTarget: 'skin' | 'all' = 'all',
) {
  const hasExternal = Object.keys(maps).length > 0
  const skinOnly = mapsTarget === 'skin' && hasExternal
  const skinPass = skinOnly ? pickSkinPass(root) : null
  const rebuild =
    (!skinOnly && hasExternal) || matOpts?.preserveEmbeddedMaps === false || !!hair

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    obj.castShadow = true
    obj.receiveShadow = true
    obj.frustumCulled = false

    const geo = obj.geometry
    if (geo && !geo.getAttribute('normal')) geo.computeVertexNormals()
    const uv = geo?.getAttribute('uv')
    if (uv && !geo.getAttribute('uv2')) geo.setAttribute('uv2', uv)

    if (obj instanceof THREE.SkinnedMesh) {
      obj.skeleton?.pose()
      obj.normalizeSkinWeights()
    }

    const src = obj.material
    const mats = Array.isArray(src) ? src : [src]
    const junkMesh = isHiddenDyePart(obj.name)
    const junkAll = mats.length > 0 && mats.every((m) => isHiddenDyePart(m?.name ?? obj.name))
    if (junkMesh || junkAll) {
      obj.visible = false
      return
    }

    const orm = maps.ormMap
    const next = mats.map((m) => {
      if (isHiddenDyePart(m?.name ?? '')) {
        return new THREE.MeshBasicMaterial({ visible: false, name: m?.name ?? 'hidden' })
      }
      const patchSkin =
        !skinPass ||
        matGetsSkinMap(
          m?.name ?? '',
          obj.name,
          skinPass.anyNamed,
          obj === skinPass.largest,
        )
      const std =
        !rebuild && m instanceof THREE.MeshStandardMaterial
          ? m.clone()
          : new THREE.MeshStandardMaterial()
      std.name = m?.name ?? std.name

      const lens = isLensMaterialName(std.name)
      if (rebuild) {
        std.metalnessMap = null
        std.roughnessMap = null
        std.envMap = null
      } else {
        std.metalnessMap = null
        if (!lens && 'transmission' in std) {
          ;(std as THREE.MeshPhysicalMaterial).transmission = 0
        }
      }

      if (patchSkin && maps.map) std.map = maps.map
      else if (m && 'map' in m && m.map) std.map = m.map as THREE.Texture
      if (patchSkin && maps.normalMap) {
        std.normalMap = maps.normalMap
        std.normalScale = new THREE.Vector2(1, -1)
      }
      if (patchSkin && orm) {
        std.aoMap = orm
        std.roughnessMap = orm
        std.metalnessMap = orm
        std.aoMapIntensity = 1
      } else if (patchSkin) {
        if (maps.roughnessMap) std.roughnessMap = maps.roughnessMap
        if (maps.metalnessMap) std.metalnessMap = maps.metalnessMap
        if (maps.aoMap) {
          std.aoMap = maps.aoMap
          std.aoMapIntensity = 1
        }
      }
      if (patchSkin && maps.emissiveMap) std.emissiveMap = maps.emissiveMap

      std.vertexColors = false
      if (patchSkin) {
        const named = !std.map ? fallbackAlbedo(std.name) : null
        std.color.setHex(matOpts?.color ?? named ?? 0xffffff)
        std.roughness = orm ? 1 : (matOpts?.roughness ?? 0.7)
        std.metalness = orm ? 1 : (matOpts?.metalness ?? 0)
        if (matOpts?.emissive != null) std.emissive.setHex(matOpts.emissive)
        if (matOpts?.emissiveIntensity != null) std.emissiveIntensity = matOpts.emissiveIntensity
        std.envMapIntensity = 1
      }
      const isSkin = !!fallbackAlbedo(std.name) || (skinOnly && patchSkin)
      if (lens) {
        const phys = new THREE.MeshPhysicalMaterial()
        phys.name = std.name
        phys.map = std.map
        phys.color.copy(std.color)
        phys.transparent = true
        phys.opacity = 0.38
        phys.roughness = 0.08
        phys.metalness = 0
        phys.transmission = 0.85
        phys.ior = 1.52
        phys.thickness = 0.02
        phys.depthWrite = false
        phys.side = THREE.DoubleSide
        phys.envMapIntensity = 1.15
        phys.needsUpdate = true
        return phys
      }
      if (!skinOnly && (std.map || hair) && !isSkin) {
        std.alphaTest = 0.33
        std.transparent = false
        std.depthWrite = true
      }
      if (skinOnly && patchSkin) {
        std.alphaTest = 0
        std.transparent = false
        std.depthWrite = true
      }
      std.side = hair ? THREE.DoubleSide : THREE.FrontSide
      if (hair) patchHairCardMaterial(std, hair.maps, hair.dye)
      std.needsUpdate = true
      return std
    })

    obj.material = Array.isArray(src) ? next : next[0]!
  })
}

/** Drop GPU skinning. Geometry is already bind-pose; follow parent transforms. */
function freezeBindPose(root: THREE.Object3D) {
  const skinned: THREE.SkinnedMesh[] = []
  root.traverse((obj) => {
    if ((obj as THREE.SkinnedMesh).isSkinnedMesh) skinned.push(obj as THREE.SkinnedMesh)
  })
  for (const mesh of skinned) {
    const baked = new THREE.Mesh(mesh.geometry, mesh.material)
    baked.name = mesh.name
    baked.castShadow = mesh.castShadow
    baked.receiveShadow = mesh.receiveShadow
    baked.frustumCulled = false
    baked.visible = mesh.visible
    baked.position.copy(mesh.position)
    baked.quaternion.copy(mesh.quaternion)
    baked.scale.copy(mesh.scale)
    mesh.parent?.add(baked)
    mesh.removeFromParent()
  }
}

export type OutfitPart = {
  url: string
  shading?: ShadingModel
  textures?: ModelTextureMaps
  hair?: HairCardMaps
  material?: ModelMaterialOpts
  hairDye?: HairDye
  /** Skin table: albedo only hits body materials, not eyes/lashes. */
  mapsTarget?: 'skin' | 'all'
}

/**
 * Load a GLB/GLTF from a public URL, optionally overlay external textures,
 * and fit it to a planar footprint radius.
 */
export async function loadFittedGltf(
  url: string,
  opts: LoadFittedGltfOpts = {},
): Promise<FittedModel> {
  return loadFittedOutfit([{ url, textures: opts.textures, material: opts.material }], opts)
}

/**
 * Layer several GLBs in the same bind-pose space (body + clothes), then fit once.
 */
export async function loadFittedOutfit(
  parts: OutfitPart[],
  opts: Pick<LoadFittedGltfOpts, 'targetRadius' | 'yLift'> = {},
): Promise<FittedModel> {
  const targetRadius = opts.targetRadius ?? 0.55
  const yLift = opts.yLift ?? 0
  const loader = new GLTFLoader()
  const root = new THREE.Group()

  await Promise.all(
    parts.map(async (part) => {
      const [gltf, maps, hairMaps] = await Promise.all([
        loader.loadAsync(part.url),
        resolveTextureMaps(part.textures),
        part.shading === 'hairCard'
          ? loadHairCardTextures(part.hair, loadTexture)
          : Promise.resolve({}),
      ])
      applyMapsAndMaterial(
        gltf.scene,
        maps,
        part.material,
        part.shading === 'hairCard'
          ? { maps: hairMaps, dye: part.hairDye ?? { root: 0xffffff, tip: 0xffffff } }
          : undefined,
        part.mapsTarget ?? 'all',
      )
      freezeBindPose(gltf.scene)
      root.add(gltf.scene)
    }),
  )

  const baseScale = fitGroupToRadius(root, targetRadius, yLift)
  return { root, baseScale }
}

export type LoadOutfitLayerOpts = {
  /** Play pawn / stacked extras. Preview wardrobe keeps SkinnedMesh. */
  freezeBindPose?: boolean
}

/**
 * Load one GLB as a wardrobe layer (no fit). Preview keeps GPU skinning.
 */
export async function loadOutfitLayer(
  part: OutfitPart,
  opts: LoadOutfitLayerOpts = {},
): Promise<THREE.Group> {
  const loader = new GLTFLoader()
  const wrap = part.mapsTarget === 'skin' ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  const [gltf, maps, hairMaps] = await Promise.all([
    loader.loadAsync(part.url),
    resolveTextureMaps(part.textures, wrap),
    part.shading === 'hairCard' ? loadHairCardTextures(part.hair, loadTexture) : Promise.resolve({}),
  ])
  applyMapsAndMaterial(
    gltf.scene,
    maps,
    part.material,
    part.shading === 'hairCard'
      ? { maps: hairMaps, dye: part.hairDye ?? { root: 0xffffff, tip: 0xffffff } }
      : undefined,
    part.mapsTarget ?? 'all',
  )
  if (opts.freezeBindPose) freezeBindPose(gltf.scene)
  const g = new THREE.Group()
  g.add(gltf.scene)
  return g
}

export function forceOpaqueSkinMat(std: THREE.MeshStandardMaterial) {
  std.transparent = false
  std.opacity = 1
  std.alphaTest = 0
  std.alphaMap = null
  std.vertexColors = false
  std.depthWrite = true
  std.metalness = 0
  std.roughness = 0.72
  if ('transmission' in std) (std as THREE.MeshPhysicalMaterial).transmission = 0
  std.needsUpdate = true
}


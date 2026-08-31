import * as THREE from 'three'
import {
  forceOpaqueSkinMat,
  loadTexture,
  matGetsSkinMap,
  pickSkinPass,
  resolveTextureMaps,
  type ModelTextureMaps,
} from '../../presentation/render/gltfModel'

export type FaceLookKind = 'eye' | 'lash'

export type MakeupDecal = {
  map?: string
  screenRect?: number[] | Record<string, number> | null
}

function faceLookMatch(kind: FaceLookKind, name: string): boolean {
  const n = name.toLowerCase()
  if (kind === 'lash') return n.includes('lash') && !n.includes('blend')
  if (
    n.includes('blend') ||
    n.includes('occlu') ||
    n.includes('wet') ||
    n.includes('shadow') ||
    n.includes('liner') ||
    n.includes('brow') ||
    n.includes('lash') ||
    n.includes('glass') ||
    n.includes('eyelid')
  ) {
    return false
  }
  return (
    n.includes('iris') ||
    n.includes('pupil') ||
    n.includes('sclera') ||
    n.includes('cornea') ||
    /(^|[^a-z])eyes?([^a-z]|$)/.test(n)
  )
}

/**
 * TKA Mod_EyesTable: swap iris / lash maps on the live body. No extra mesh.
 * `tint`: RGB multiply; `a` → emissiveIntensity (may be >1).
 */
export async function applyNamedFaceMaps(
  root: THREE.Object3D,
  kind: FaceLookKind,
  textures: ModelTextureMaps | undefined,
  tint?: { r: number; g: number; b: number; a: number } | null,
): Promise<void> {
  const key = `faceMaps:${kind}`
  const origKey = `faceMapsOrig:${kind}`
  type Orig = {
    mat: THREE.MeshStandardMaterial
    map: THREE.Texture | null
    emissiveMap: THREE.Texture | null
    emissive: THREE.Color
    emissiveIntensity: number
    color: THREE.Color
    side: THREE.Side
    transparent: boolean
    alphaTest: number
  }
  let orig = root.userData[origKey] as Orig[] | undefined
  if (!orig) {
    orig = []
    root.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        if (!(m instanceof THREE.MeshStandardMaterial)) continue
        const label = `${obj.name} ${m.name}`
        if (!faceLookMatch(kind, label) && !faceLookMatch(kind, m.name) && !faceLookMatch(kind, obj.name)) {
          continue
        }
        orig!.push({
          mat: m,
          map: m.map,
          emissiveMap: m.emissiveMap,
          emissive: m.emissive.clone(),
          emissiveIntensity: m.emissiveIntensity,
          color: m.color.clone(),
          side: m.side,
          transparent: m.transparent,
          alphaTest: m.alphaTest,
        })
      }
    })
    root.userData[origKey] = orig
  }
  const prev = root.userData[key] as THREE.Texture[] | undefined
  if (prev) {
    for (const t of prev) t.dispose()
    root.userData[key] = undefined
  }
  const hasMaps = !!(textures?.map || textures?.emissiveMap)
  const hasTint = !!(tint && (tint.r !== 1 || tint.g !== 1 || tint.b !== 1 || tint.a !== 1))
  if (!hasMaps && !hasTint) {
    for (const o of orig) {
      o.mat.map = o.map
      o.mat.emissiveMap = o.emissiveMap
      o.mat.emissive.copy(o.emissive)
      o.mat.emissiveIntensity = o.emissiveIntensity
      o.mat.color.copy(o.color)
      o.mat.side = o.side
      o.mat.transparent = o.transparent
      o.mat.alphaTest = o.alphaTest
      o.mat.needsUpdate = true
    }
    return
  }
  const maps = hasMaps
    ? await resolveTextureMaps(textures, THREE.ClampToEdgeWrapping)
    : ({} as Partial<Record<keyof ModelTextureMaps, THREE.Texture>>)
  root.userData[key] = Object.values(maps).filter(Boolean)
  for (const o of orig) {
    if (maps.map) {
      o.mat.map = maps.map
    }
    if (tint) {
      o.mat.color.setRGB(tint.r, tint.g, tint.b)
    } else if (maps.map) {
      o.mat.color.setHex(0xffffff)
    }
    if (maps.emissiveMap) {
      o.mat.emissiveMap = maps.emissiveMap
      o.mat.emissive.setHex(0xffffff)
      o.mat.emissiveIntensity = tint ? Math.max(0, tint.a) : Math.max(o.mat.emissiveIntensity, 1)
    } else if (tint && tint.a > 0 && tint.a !== 1) {
      o.mat.emissiveMap = null
      o.mat.emissive.setRGB(tint.r, tint.g, tint.b)
      o.mat.emissiveIntensity = Math.max(0, tint.a)
    }
    if (kind === 'lash') {
      o.mat.side = THREE.DoubleSide
      if (o.mat.alphaTest < 0.05) o.mat.alphaTest = 0.33
    }
    o.mat.needsUpdate = true
  }
}

type SkinOrig = {
  mat: THREE.MeshStandardMaterial
  map: THREE.Texture | null
  normalMap: THREE.Texture | null
  color: number
}

function skinOrigList(root: THREE.Object3D): SkinOrig[] {
  let orig = root.userData.skinMapsOrig as SkinOrig[] | undefined
  if (orig) return orig
  orig = []
  const skinPass = pickSkinPass(root)
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      if (!(m instanceof THREE.MeshStandardMaterial)) continue
      if (!matGetsSkinMap(m.name, obj.name, skinPass.anyNamed, obj === skinPass.largest)) continue
      orig!.push({
        mat: m,
        map: m.map,
        normalMap: m.normalMap,
        color: m.color.getHex(),
      })
    }
  })
  root.userData.skinMapsOrig = orig
  return orig
}

/**
 * TKA Skin table: albedo on the live body. Do not replace the mesh.
 * Empty textures restore the embedded body maps.
 */
export async function applyBodySkinMaps(
  root: THREE.Object3D,
  textures: ModelTextureMaps | undefined,
): Promise<void> {
  const orig = skinOrigList(root)
  const prev = root.userData.skinMaps as THREE.Texture[] | undefined
  if (prev) {
    for (const t of prev) t.dispose()
    root.userData.skinMaps = undefined
  }
  if (!textures?.map && !textures?.normalMap) {
    for (const o of orig) {
      o.mat.map = o.map
      o.mat.normalMap = o.normalMap
      o.mat.color.setHex(o.color)
      o.mat.userData.skinBaseMap = o.map
      o.mat.needsUpdate = true
    }
    return
  }
  const maps = await resolveTextureMaps(textures, THREE.ClampToEdgeWrapping)
  root.userData.skinMaps = Object.values(maps).filter(Boolean)
  for (const o of orig) {
    if (maps.map) {
      o.mat.map = maps.map
      o.mat.color.setHex(0xffffff)
    }
    o.mat.userData.skinBaseMap = o.mat.map
    if (maps.normalMap) {
      o.mat.normalMap = maps.normalMap
      o.mat.normalScale = new THREE.Vector2(1, -1)
    }
    forceOpaqueSkinMat(o.mat)
  }
}

/** ScreenRect: texel XYWH if any component > 2, else 0–1 UV. Nested [[x,y,w,h]] unwrapped. */
export function rectToXYWH(raw: MakeupDecal['screenRect']): [number, number, number, number] | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    if (raw.length === 1 && Array.isArray(raw[0])) return rectToXYWH(raw[0] as number[])
    const n = raw.filter((v): v is number => typeof v === 'number')
    if (n.length >= 4) return [n[0]!, n[1]!, n[2]!, n[3]!]
    return null
  }
  const minX = raw.x ?? raw.X ?? raw.Left ?? raw.minX
  const minY = raw.y ?? raw.Y ?? raw.Top ?? raw.minY
  const maxX = raw.z ?? raw.Z ?? raw.Right ?? raw.maxX
  const maxY = raw.w ?? raw.W ?? raw.Bottom ?? raw.maxY
  const w = raw.W ?? raw.width ?? raw.Width
  const h = raw.h ?? raw.H ?? raw.height ?? raw.Height
  if (typeof minX === 'number' && typeof minY === 'number' && typeof w === 'number' && typeof h === 'number') {
    return [minX, minY, w, h]
  }
  if (
    typeof minX === 'number' &&
    typeof minY === 'number' &&
    typeof maxX === 'number' &&
    typeof maxY === 'number'
  ) {
    return [minX, minY, maxX - minX, maxY - minY]
  }
  return null
}

function stampDecal(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  rect: [number, number, number, number],
  canvasW: number,
  canvasH: number,
) {
  let [x, y, w, h] = rect
  if (Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 2) {
    x *= canvasW
    y *= canvasH
    w *= canvasW
    h *= canvasH
  }
  const tw = Math.max(1, Math.round(w))
  const th = Math.max(1, Math.round(h))
  const tmp = document.createElement('canvas')
  tmp.width = tw
  tmp.height = th
  const tctx = tmp.getContext('2d')
  if (!tctx) return
  tctx.drawImage(src, 0, 0, tw, th)
  const data = tctx.getImageData(0, 0, tw, th)
  const px = data.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i]! + px[i + 1]! + px[i + 2]! < 28) px[i + 3] = 0
  }
  tctx.putImageData(data, 0, 0)
  ctx.drawImage(tmp, x, y, w, h)
}

function atlasSizeFromDecals(decals: MakeupDecal[]): number {
  let max = 2048
  for (const d of decals) {
    const r = rectToXYWH(d.screenRect)
    if (!r) continue
    const [x, y, w, h] = r
    if (Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 2) continue
    max = Math.max(max, x + w, y + h)
  }
  const pow = 2 ** Math.ceil(Math.log2(Math.max(1, max)))
  return Math.min(4096, Math.max(2048, pow))
}

type DecalHook = {
  origCompile: THREE.Material['onBeforeCompile']
  origCacheKey: THREE.Material['customProgramCacheKey']
  shader?: { uniforms: Record<string, { value: unknown }> }
}

function unhookDecal(mat: THREE.MeshStandardMaterial) {
  const hook = mat.userData.decalHook as DecalHook | undefined
  if (!hook) return
  mat.onBeforeCompile = hook.origCompile
  mat.customProgramCacheKey = hook.origCacheKey
  mat.userData.decalHook = undefined
  mat.userData.decalMap = undefined
  mat.needsUpdate = true
}

function hookDecal(mat: THREE.MeshStandardMaterial, overlay: THREE.Texture) {
  mat.userData.decalMap = overlay
  const existing = mat.userData.decalHook as DecalHook | undefined
  if (existing?.shader) {
    existing.shader.uniforms.uDecalMap.value = overlay
    return
  }
  const origCompile = mat.onBeforeCompile
  const origCacheKey = mat.customProgramCacheKey
  const hook: DecalHook = { origCompile, origCacheKey }
  mat.userData.decalHook = hook
  mat.onBeforeCompile = (shader, renderer) => {
    origCompile.call(mat, shader, renderer)
    shader.uniforms.uDecalMap = { value: mat.userData.decalMap }
    hook.shader = shader
    // Default Jodi has no albedo, so Three never defines vMapUv / USE_UV.
    // Vertex always has `attribute vec2 uv` — pass it ourselves.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDecalUv;')
      .replace('void main() {', 'void main() {\n	vDecalUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vDecalUv;\nuniform sampler2D uDecalMap;',
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
	vec4 decalCol = texture2D( uDecalMap, vDecalUv );
	diffuseColor.rgb = mix( diffuseColor.rgb, decalCol.rgb, decalCol.a );
`,
      )
  }
  mat.customProgramCacheKey = () => 'tkaDecalUvOverlay'
  mat.needsUpdate = true
}

function restoreSkinAlbedo(orig: SkinOrig[]) {
  for (const o of orig) {
    const base =
      o.mat.userData.skinBaseMap !== undefined
        ? (o.mat.userData.skinBaseMap as THREE.Texture | null)
        : o.map
    o.mat.map = base
    if (!base) o.mat.color.setHex(o.color)
    unhookDecal(o.mat)
    o.mat.needsUpdate = true
  }
}

/**
 * TKA Mod_MakeupTable: stamp Texture_d into ScreenRect as a transparent overlay.
 * Do not replace body albedo — a lips PNG must not become the skin map.
 */
export async function applyMakeupDecals(
  root: THREE.Object3D,
  decals: MakeupDecal[],
): Promise<void> {
  const prev = root.userData.makeupMaps as THREE.Texture[] | undefined
  if (prev) {
    for (const t of prev) t.dispose()
    root.userData.makeupMaps = undefined
  }
  const orig = skinOrigList(root)
  restoreSkinAlbedo(orig)
  const live = decals.filter((d) => d.map && rectToXYWH(d.screenRect))
  if (live.length === 0) return
  const atlas = atlasSizeFromDecals(live)
  const canvas = document.createElement('canvas')
  canvas.width = atlas
  canvas.height = atlas
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, atlas, atlas)
  for (const d of live) {
    const rect = rectToXYWH(d.screenRect)
    if (!d.map || !rect) continue
    const tex = await loadTexture(d.map, THREE.SRGBColorSpace, THREE.ClampToEdgeWrapping)
    stampDecal(ctx, tex.image as CanvasImageSource, rect, atlas, atlas)
    tex.dispose()
  }
  const overlay = new THREE.CanvasTexture(canvas)
  overlay.colorSpace = THREE.SRGBColorSpace
  overlay.flipY = false
  overlay.wrapS = THREE.ClampToEdgeWrapping
  overlay.wrapT = THREE.ClampToEdgeWrapping
  overlay.needsUpdate = true
  root.userData.makeupMaps = [overlay]
  for (const o of orig) hookDecal(o.mat, overlay)
}

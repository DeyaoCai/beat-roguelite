import * as THREE from 'three'
import type { HairCardMaps } from '../../content/shading'
import { tkaModelsUrl } from '../../figures/pack'

export type HairDye = {
  root: number
  tip: number
}

type HairUniforms = {
  hairRootColor: { value: THREE.Color }
  hairTipColor: { value: THREE.Color }
  hairRootMap: { value: THREE.Texture | null }
  hairIdMap: { value: THREE.Texture | null }
  hairOpacityMap: { value: THREE.Texture | null }
  hairFlowMap: { value: THREE.Texture | null }
  hairDepthMap: { value: THREE.Texture | null }
  hairHasRoot: { value: number }
  hairHasId: { value: number }
  hairHasOpacity: { value: number }
  hairHasFlow: { value: number }
  hairHasDepth: { value: number }
}

function uniformsOf(mat: THREE.Material): HairUniforms | undefined {
  return mat.userData.hairCard as HairUniforms | undefined
}

/** 1×1 white so MeshStandardMaterial always emits `vMapUv` (Three r185). */
let white1x1: THREE.DataTexture | undefined
function ensureUvMap(mat: THREE.MeshStandardMaterial) {
  if (mat.map) return
  if (!white1x1) {
    white1x1 = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    white1x1.colorSpace = THREE.SRGBColorSpace
    white1x1.needsUpdate = true
  }
  mat.map = white1x1
}

/** UE hair-card dye: mix(root, tip, Root.r) * ID, clip Opacity. */
export function patchHairCardMaterial(
  mat: THREE.MeshStandardMaterial,
  maps: {
    root?: THREE.Texture
    id?: THREE.Texture
    opacity?: THREE.Texture
    flow?: THREE.Texture
    depth?: THREE.Texture
  },
  dye: HairDye,
) {
  ensureUvMap(mat)
  mat.roughness = Math.min(mat.roughness, 0.42)
  const u: HairUniforms = {
    hairRootColor: { value: new THREE.Color(dye.root) },
    hairTipColor: { value: new THREE.Color(dye.tip) },
    hairRootMap: { value: maps.root ?? null },
    hairIdMap: { value: maps.id ?? null },
    hairOpacityMap: { value: maps.opacity ?? null },
    hairFlowMap: { value: maps.flow ?? null },
    hairDepthMap: { value: maps.depth ?? null },
    hairHasRoot: { value: maps.root ? 1 : 0 },
    hairHasId: { value: maps.id ? 1 : 0 },
    hairHasOpacity: { value: maps.opacity ? 1 : 0 },
    hairHasFlow: { value: maps.flow ? 1 : 0 },
    hairHasDepth: { value: maps.depth ? 1 : 0 },
  }
  mat.userData.hairCard = u
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
varying vec2 vHairUv;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
#ifdef USE_MAP
vHairUv = vMapUv;
#elif defined( USE_UV )
vHairUv = vUv;
#else
vHairUv = vec2(0.5);
#endif`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform vec3 hairRootColor;
uniform vec3 hairTipColor;
uniform sampler2D hairRootMap;
uniform sampler2D hairIdMap;
uniform sampler2D hairOpacityMap;
uniform sampler2D hairFlowMap;
uniform sampler2D hairDepthMap;
uniform float hairHasRoot;
uniform float hairHasId;
uniform float hairHasOpacity;
uniform float hairHasFlow;
uniform float hairHasDepth;
varying vec2 vHairUv;`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
float hairT = vHairUv.y;
if (hairHasRoot > 0.5) hairT = texture2D(hairRootMap, vHairUv).r;
vec3 hairDye = mix(hairRootColor, hairTipColor, clamp(hairT, 0.0, 1.0));
float hairId = hairHasId > 0.5 ? texture2D(hairIdMap, vHairUv).r : 1.0;
vec3 hairRgb = hairDye * mix(0.45, 1.0, hairId);
if (hairHasDepth > 0.5) {
  float hairD = texture2D(hairDepthMap, vHairUv).r;
  hairRgb *= mix(0.7, 1.0, hairD);
}
if (hairHasFlow > 0.5) {
  vec2 flow = texture2D(hairFlowMap, vHairUv).rg * 2.0 - 1.0;
  vec3 hairTan = normalize(vec3(flow.x, 0.18, flow.y));
  vec3 hairV = normalize(-vViewPosition);
  float aniso = pow(clamp(1.0 - abs(dot(hairTan, hairV)), 0.0, 1.0), 3.0);
  hairRgb += hairDye * aniso * 0.32;
}
if (hairHasRoot > 0.5) diffuseColor.rgb = hairRgb;
else diffuseColor.rgb *= hairRgb;
if (hairHasOpacity > 0.5) {
  float hairA = texture2D(hairOpacityMap, vHairUv).r;
  if (hairA < 0.33) discard;
}`,
    )
  }
  mat.customProgramCacheKey = () => 'hair-card-v3'
}

export function applyHairDye(root: THREE.Object3D, dye: HairDye) {
  const rootC = new THREE.Color(dye.root)
  const tipC = new THREE.Color(dye.tip)
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    for (const m of mats) {
      const u = uniformsOf(m)
      if (!u) continue
      u.hairRootColor.value.copy(rootC)
      u.hairTipColor.value.copy(tipC)
    }
  })
}

export async function loadHairCardTextures(
  hair: HairCardMaps | undefined,
  load: (
    url: string,
    space: typeof THREE.SRGBColorSpace | typeof THREE.LinearSRGBColorSpace,
  ) => Promise<THREE.Texture>,
): Promise<{
  root?: THREE.Texture
  id?: THREE.Texture
  opacity?: THREE.Texture
  flow?: THREE.Texture
  depth?: THREE.Texture
}> {
  if (!hair) return {}
  const out: {
    root?: THREE.Texture
    id?: THREE.Texture
    opacity?: THREE.Texture
    flow?: THREE.Texture
    depth?: THREE.Texture
  } = {}
  const jobs: Promise<void>[] = []
  const add = (key: keyof typeof out, rel: string | undefined, srgb: boolean) => {
    if (!rel) return
    jobs.push(
      load(rel.startsWith('/') ? rel : tkaModelsUrl(...rel.split('/')), srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace)
        .then((t) => {
          out[key] = t
        })
        .catch(() => undefined),
    )
  }
  add('root', hair.rootMap, false)
  add('id', hair.idMap, false)
  add('opacity', hair.opacityMap, false)
  add('flow', hair.flowMap, false)
  add('depth', hair.depthMap, false)
  await Promise.all(jobs)
  return out
}

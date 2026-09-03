import * as THREE from 'three'

const SKIN = 0xd4a88a

function pickAlbedoMap(m: THREE.Material): THREE.Texture | null {
  const std = m as THREE.MeshStandardMaterial
  if (std.map instanceof THREE.Texture) return std.map
  const ud = m.userData as { map?: THREE.Texture }
  if (ud.map instanceof THREE.Texture) return ud.map
  return null
}

/**
 * Skyrim facegen often wires:
 * - head → facetint (makeup, ≈transparent) as if it were diffuse → white / empty face
 * - eyes / brows / mouth → alpha cards drawn opaque → black ribbons
 *
 * Fix is material flags + base color, not more mesh surgery.
 */
function matKind(name: string): 'head' | 'alpha' | 'body' | 'gear' {
  const n = name.toLowerCase()
  if (/eye|brow|mouth|lash/.test(n)) return 'alpha'
  if (/hairline|hair/.test(n)) return 'alpha'
  if (/(femalehead|_xcxfemalehead|head\.mat)/.test(n) && !/hair|band|line/.test(n)) {
    return 'head'
  }
  if (/^3ba|hands?|feet|foot|body/.test(n)) return 'body'
  return 'gear'
}

function prepMap(map: THREE.Texture | null): THREE.Texture | null {
  if (!map) return null
  map.colorSpace = THREE.SRGBColorSpace
  map.flipY = false
  map.needsUpdate = true
  return map
}

/** Drop chrome specular; correct head/eye alpha. */
export function hardenSkinMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const list = (Array.isArray(obj.material) ? obj.material : [obj.material]).filter(
      (m): m is THREE.Material => !!m,
    )
    const next = list.map((m) => {
      const kind = matKind(m.name || obj.name)
      const map = prepMap(pickAlbedoMap(m))

      if (kind === 'head') {
        // Facetint must not be the only albedo (nearly empty alpha → white face).
        return new THREE.MeshStandardMaterial({
          name: m.name,
          map: null,
          color: SKIN,
          metalness: 0,
          roughness: 0.62,
          envMapIntensity: 0.2,
          side: THREE.DoubleSide,
          transparent: false,
          depthWrite: true,
        })
      }

      if (kind === 'alpha') {
        return new THREE.MeshStandardMaterial({
          name: m.name,
          map,
          color: 0xffffff,
          metalness: 0,
          roughness: 0.75,
          envMapIntensity: 0.08,
          side: THREE.DoubleSide,
          transparent: true,
          alphaTest: 0.12,
          depthWrite: false,
          opacity: 1,
        })
      }

      return new THREE.MeshStandardMaterial({
        name: m.name,
        map,
        color: map ? 0xffffff : kind === 'body' ? SKIN : 0xffffff,
        metalness: 0,
        roughness: kind === 'body' ? 0.68 : 0.55,
        envMapIntensity: kind === 'body' ? 0.2 : 0.35,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
      })
    })
    obj.material = next.length === 1 ? next[0]! : next
    obj.castShadow = true
    obj.receiveShadow = true
  })
}

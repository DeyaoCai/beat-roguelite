import * as THREE from 'three'

/** Drop Skyrim _s specular / _msn so IBL does not read as chrome. */
export function hardenSkinMaterials(root: THREE.Object3D) {
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const list = (Array.isArray(obj.material) ? obj.material : [obj.material]).filter(
      (m): m is THREE.Material => !!m,
    )
    const next = list.map((m) => {
      if (!(m instanceof THREE.MeshStandardMaterial)) return m
      return new THREE.MeshStandardMaterial({
        name: m.name,
        map: m.map,
        color: m.map ? 0xffffff : 0xc4a07a,
        metalness: 0,
        roughness: 0.62,
        envMapIntensity: 0.35,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
        depthWrite: true,
      })
    })
    obj.material = next.length === 1 ? next[0]! : next
  })
}

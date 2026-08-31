import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

/** Animation clips + armature rest. Do not add the anim glTF scene to the avatar. */
export type GltfClipPack = {
  clips: THREE.AnimationClip[]
  rest: Map<string, THREE.Quaternion>
}

export async function loadGltfClips(url: string): Promise<GltfClipPack> {
  const loader = new GLTFLoader()
  const gltf = await loader.loadAsync(url)
  const rest = new Map<string, THREE.Quaternion>()
  gltf.scene.updateMatrixWorld(false)
  gltf.scene.traverse((obj) => {
    if (!obj.name || obj.name === 'Armature' || obj.name.startsWith('anim_')) return
    rest.set(obj.name, obj.quaternion.clone())
  })
  return { clips: gltf.animations ?? [], rest }
}

import * as THREE from 'three'

/** Skyrim nif is Z-up. After glTF Y-up, leftover Z-tall meshes still need this. */
export function maybeUpright(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) return
  const size = new THREE.Vector3()
  box.getSize(size)
  if (size.z > size.y * 1.25 && size.z > size.x * 1.1) {
    root.rotation.x = -Math.PI / 2
    root.updateMatrixWorld(true)
  }
}

/** Skyrim +Y forward becomes -Z after Z-up→Y-up; camera / TKA expect +Z face. */
export function faceCamera(root: THREE.Object3D) {
  root.rotation.y = Math.PI
}

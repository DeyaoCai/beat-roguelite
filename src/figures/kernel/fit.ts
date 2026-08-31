import * as THREE from 'three'

export type FittedFrame = {
  scale: number
  /** World height after fit (meters). */
  height: number
  /** Max XZ span after fit. */
  width: number
}

/** Detach foot FX so Box3 / fit only sees the body. */
function withAuraDetached<T>(root: THREE.Object3D, fn: () => T): T {
  const aura = root.getObjectByName('ssjAuraFx')
  const parent = aura?.parent ?? null
  if (aura && parent) parent.remove(aura)
  try {
    return fn()
  } finally {
    if (aura && parent) parent.add(aura)
  }
}

/**
 * Wardrobe / lookdev frame: Y-up meters, feet on y=0, XZ centered.
 * Scale by height, not XZ footprint — A-pose arm span must not change height.
 */
export function fitGroupToHeight(
  root: THREE.Group,
  targetHeight: number,
  yLift = 0,
): FittedFrame {
  return withAuraDetached(root, () => {
    root.position.set(0, 0, 0)
    root.scale.set(1, 1, 1)
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    if (box.isEmpty()) return { scale: 1, height: targetHeight, width: targetHeight * 0.3 }
    box.getSize(size)
    const scale = targetHeight / Math.max(size.y, 1e-3)
    root.scale.setScalar(scale)
    root.updateMatrixWorld(true)
    box.setFromObject(root)
    const center = new THREE.Vector3()
    box.getCenter(center)
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y
    root.position.y += yLift
    root.updateMatrixWorld(true)
    box.setFromObject(root)
    box.getSize(size)
    return { scale, height: size.y, width: Math.max(size.x, size.z) }
  })
}

/** @deprecated footprint fit; play extras / old loaders. Prefer `fitGroupToHeight`. */
export function fitGroupToRadius(root: THREE.Group, targetRadius: number, yLift = 0): number {
  return withAuraDetached(root, () => {
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    if (box.isEmpty()) return 1
    const size = new THREE.Vector3()
    box.getSize(size)
    const footprint = Math.max(size.x, size.z, 1e-3)
    const baseScale = (targetRadius * 2) / footprint
    root.scale.setScalar(baseScale)
    root.updateMatrixWorld(true)
    box.setFromObject(root)
    const center = new THREE.Vector3()
    box.getCenter(center)
    root.position.x -= center.x
    root.position.z -= center.z
    root.position.y -= box.min.y
    root.position.y += yLift
    return baseScale
  })
}

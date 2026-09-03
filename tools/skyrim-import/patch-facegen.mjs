/**
 * In-place facegen lift for holysee GLBs + strip Sofia specular flag in JSON.
 * Does NOT re-encode images (avoids texture loss from stubbed Image in Node).
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { readFileSync, writeFileSync } from 'fs'

globalThis.self = globalThis
globalThis.URL = URL
globalThis.Image = class {
  set src(_v) {
    queueMicrotask(() => this.onload?.())
  }
}
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} })

function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12)
  const jsonStart = 20
  const json = JSON.parse(buf.slice(jsonStart, jsonStart + jsonLen).toString('utf8'))
  let binHeader = jsonStart + jsonLen
  binHeader += (4 - (binHeader % 4)) % 4
  const binLen = buf.readUInt32LE(binHeader)
  const binStart = binHeader + 8
  const bin = Buffer.from(buf.slice(binStart, binStart + binLen))
  return { json, jsonLen, jsonStart, binHeader, binStart, binLen, bin, buf }
}

function writeGlb(json, bin) {
  const jsonStr = JSON.stringify(json)
  let jsonPad = (4 - (jsonStr.length % 4)) % 4
  const jsonBytes = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8')
  let binPad = (4 - (bin.length % 4)) % 4
  const binBytes = binPad ? Buffer.concat([bin, Buffer.alloc(binPad, 0)]) : bin
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0) // glTF
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonBytes.length, 12)
  out.writeUInt32LE(0x4e4f534a, 16) // JSON
  jsonBytes.copy(out, 20)
  const bh = 20 + jsonBytes.length
  out.writeUInt32LE(binBytes.length, bh)
  out.writeUInt32LE(0x004e4942, bh + 4) // BIN
  binBytes.copy(out, bh + 8)
  return out
}

function isHeadBoneName(name) {
  if (name === 'NPC_Head_Head') return true
  return /NPC.*Head/i.test(name) && !/Magic|Prey|Target|Nub|end/i.test(name)
}

function headWeightRatio(mesh) {
  const sk = mesh.skeleton
  const headIdx = sk.bones.findIndex((b) => isHeadBoneName(b.name))
  if (headIdx < 0) return 0
  const idx = mesh.geometry.getAttribute('skinIndex')
  const wt = mesh.geometry.getAttribute('skinWeight')
  let headW = 0
  let total = 0
  const step = Math.max(1, Math.floor(idx.count / 400))
  for (let i = 0; i < idx.count; i += step) {
    for (let k = 0; k < 4; k++) {
      const w = wt.array[i * 4 + k]
      total += w
      if (idx.array[i * 4 + k] === headIdx) headW += w
    }
  }
  return total ? headW / total : 0
}

function computeLift(scene) {
  scene.updateMatrixWorld(true)
  let headBone = null
  scene.traverse((o) => {
    if (!o.isBone) return
    if (o.name === 'NPC_Head_Head') headBone = o
    else if (!headBone && isHeadBoneName(o.name)) headBone = o
  })
  if (!headBone) return null
  let bodyMaxY = -Infinity
  scene.traverse((o) => {
    if (o.isMesh && /^3ba$/i.test(o.name)) {
      const b = new THREE.Box3().setFromObject(o)
      bodyMaxY = Math.max(bodyMaxY, b.max.y)
    }
  })
  const low = []
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return
    if (headWeightRatio(o) < 0.25) return
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())
    if (c.y < bodyMaxY * 0.55) low.push(o)
  })
  if (!low.length) return { names: [], delta: new THREE.Vector3() }
  const cluster = new THREE.Box3()
  for (const m of low) cluster.expandByObject(m)
  const from = cluster.getCenter(new THREE.Vector3())
  const to = new THREE.Vector3()
  headBone.getWorldPosition(to)
  return { names: low.map((m) => m.name), delta: to.sub(from) }
}

function translateAccessor(json, bin, accessorIndex, dx, dy, dz) {
  const acc = json.accessors[accessorIndex]
  const bv = json.bufferViews[acc.bufferView]
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0)
  const count = acc.count
  const stride = bv.byteStride || 12
  for (let i = 0; i < count; i++) {
    const o = start + i * stride
    bin.writeFloatLE(bin.readFloatLE(o) + dx, o)
    bin.writeFloatLE(bin.readFloatLE(o + 4) + dy, o + 4)
    bin.writeFloatLE(bin.readFloatLE(o + 8) + dz, o + 8)
  }
  if (acc.min) {
    acc.min[0] += dx
    acc.min[1] += dy
    acc.min[2] += dz
  }
  if (acc.max) {
    acc.max[0] += dx
    acc.max[1] += dy
    acc.max[2] += dz
  }
}

async function loadScene(path) {
  const buf = readFileSync(path)
  return new GLTFLoader().parseAsync(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    '',
  )
}

async function patchSister(path) {
  const file = readFileSync(path)
  const { json, bin } = parseGlb(file)
  const gltf = await loadScene(path)
  const lift = computeLift(gltf.scene)
  if (!lift || !lift.names.length) {
    console.log('skip (no lift)', path)
    return
  }
  const { delta, names } = lift
  console.log(
    'lift',
    path,
    names,
    delta.toArray().map((x) => +x.toFixed(2)),
  )

  const nameSet = new Set(names)
  for (let mi = 0; mi < (json.meshes || []).length; mi++) {
    const mesh = json.meshes[mi]
    if (!nameSet.has(mesh.name)) continue
    for (const prim of mesh.primitives || []) {
      const pos = prim.attributes?.POSITION
      if (pos == null) continue
      translateAccessor(json, bin, pos, delta.x, delta.y, delta.z)
    }
  }

  // Also patch mesh nodes that use mesh by index with matching name via nodes
  writeFileSync(path, writeGlb(json, bin))
  console.log('wrote', path)
}

function stripSpecularJson(path) {
  const file = readFileSync(path)
  const { json, bin } = parseGlb(file)
  let n = 0
  for (const mat of json.materials || []) {
    if (mat.extensions?.KHR_materials_specular) {
      delete mat.extensions.KHR_materials_specular
      n++
      if (mat.extensions && Object.keys(mat.extensions).length === 0) {
        delete mat.extensions
      }
    }
    // force dielectric
    if (mat.pbrMetallicRoughness) {
      mat.pbrMetallicRoughness.metallicFactor = 0
      mat.pbrMetallicRoughness.roughnessFactor = 0.68
    }
  }
  if (json.extensionsUsed) {
    json.extensionsUsed = json.extensionsUsed.filter((e) => e !== 'KHR_materials_specular')
    if (!json.extensionsUsed.length) delete json.extensionsUsed
  }
  writeFileSync(path, writeGlb(json, bin))
  console.log('sofia strip specular', n, 'mats')
}

const sisters = [
  '../co_der-resource/beat-roguelite/figures/holysee-vie/models/body.glb',
  '../co_der-resource/beat-roguelite/figures/holysee-lite/models/body.glb',
  '../co_der-resource/beat-roguelite/figures/holysee-iru/models/body.glb',
]

for (const p of sisters) await patchSister(p)
stripSpecularJson('../co_der-resource/beat-roguelite/figures/skyrim-female/models/body.glb')

// verify
for (const p of sisters) {
  const gltf = await loadScene(p)
  const rows = []
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return
    if (!/Head|HairFemale|Mouth|Eyes|Brows/i.test(o.name)) return
    const c = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())
    rows.push([o.name, +c.y.toFixed(1)])
  })
  console.log('verify', p.split('/').slice(-3).join('/'), rows)
}
{
  const { json } = parseGlb(readFileSync('../co_der-resource/beat-roguelite/figures/skyrim-female/models/body.glb'))
  console.log(
    'sofia mats',
    json.materials.map((m) => ({
      name: m.name,
      metal: m.pbrMetallicRoughness?.metallicFactor,
      hasBase: !!m.pbrMetallicRoughness?.baseColorTexture,
      ext: m.extensions,
    })),
  )
}

/**
 * Fix sister faces:
 * 1) Head albedo was facetint (≈transparent makeup) → swap to femalehead skin from Sofia GLB
 * 2) Snap head to neck bone; place eyes/brows/mouth on the face (not in the neck gap)
 * 3) Mark eye/brow/hair mats for alpha in a tiny extras JSON consumed at runtime (optional)
 */
import { readFileSync, writeFileSync } from 'fs'

function parseGlb(buf) {
  const jsonLen = buf.readUInt32LE(12)
  const jsonStart = 20
  const json = JSON.parse(buf.slice(jsonStart, jsonStart + jsonLen).toString('utf8'))
  let binHeader = jsonStart + jsonLen
  binHeader += (4 - (binHeader % 4)) % 4
  const binLen = buf.readUInt32LE(binHeader)
  const binStart = binHeader + 8
  const bin = Buffer.from(buf.slice(binStart, binStart + binLen))
  return { json, bin }
}

function writeGlb(json, bin) {
  const jsonStr = JSON.stringify(json)
  const jsonPad = (4 - (jsonStr.length % 4)) % 4
  const jsonBytes = Buffer.from(jsonStr + ' '.repeat(jsonPad), 'utf8')
  const binPad = (4 - (bin.length % 4)) % 4
  const binBytes = binPad ? Buffer.concat([bin, Buffer.alloc(binPad, 0)]) : bin
  const total = 12 + 8 + jsonBytes.length + 8 + binBytes.length
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonBytes.length, 12)
  out.writeUInt32LE(0x4e4f534a, 16)
  jsonBytes.copy(out, 20)
  const bh = 20 + jsonBytes.length
  out.writeUInt32LE(binBytes.length, bh)
  out.writeUInt32LE(0x004e4942, bh + 4)
  binBytes.copy(out, bh + 8)
  return out
}

function getImageBytes(json, bin, pred) {
  const i = json.images.findIndex(pred)
  if (i < 0) return null
  const im = json.images[i]
  const bv = json.bufferViews[im.bufferView]
  return {
    index: i,
    name: im.name,
    mimeType: im.mimeType || 'image/png',
    bytes: Buffer.from(bin.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)),
  }
}

function appendImage(json, bin, name, mimeType, bytes) {
  const byteOffset = bin.length
  const nextBin = Buffer.concat([bin, bytes])
  const pad = (4 - (bytes.length % 4)) % 4
  const padded = pad ? Buffer.concat([nextBin, Buffer.alloc(pad, 0)]) : nextBin
  const bvIndex = json.bufferViews.length
  json.bufferViews.push({
    buffer: 0,
    byteOffset,
    byteLength: bytes.length,
  })
  const imgIndex = json.images.length
  json.images.push({ name, mimeType, bufferView: bvIndex })
  const texIndex = json.textures.length
  json.textures.push({ source: imgIndex, sampler: json.samplers?.[0] != null ? 0 : undefined })
  if (json.textures[texIndex].sampler === undefined) delete json.textures[texIndex].sampler
  return { bin: padded, texIndex, imgIndex }
}

function translateMeshPositions(json, bin, meshName, dx, dy, dz) {
  const mesh = (json.meshes || []).find((m) => m.name === meshName)
  if (!mesh) return false
  for (const prim of mesh.primitives || []) {
    const pos = prim.attributes?.POSITION
    if (pos == null) continue
    const acc = json.accessors[pos]
    const bv = json.bufferViews[acc.bufferView]
    const start = (bv.byteOffset || 0) + (acc.byteOffset || 0)
    const stride = bv.byteStride || 12
    for (let i = 0; i < acc.count; i++) {
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
  return true
}

function meshCenterY(json, bin, meshName) {
  const mesh = (json.meshes || []).find((m) => m.name === meshName)
  if (!mesh) return null
  const prim = mesh.primitives?.[0]
  const pos = prim?.attributes?.POSITION
  if (pos == null) return null
  const acc = json.accessors[pos]
  return {
    minY: acc.min?.[1],
    maxY: acc.max?.[1],
    cy: ((acc.min?.[1] ?? 0) + (acc.max?.[1] ?? 0)) / 2,
    minZ: acc.min?.[2],
    maxZ: acc.max?.[2],
    cz: ((acc.min?.[2] ?? 0) + (acc.max?.[2] ?? 0)) / 2,
    cx: ((acc.min?.[0] ?? 0) + (acc.max?.[0] ?? 0)) / 2,
  }
}

function retargetHeadMat(json, headTexIndex) {
  for (const mat of json.materials || []) {
    if (!/head/i.test(mat.name) || /hair|line|band/i.test(mat.name)) continue
    if (!mat.pbrMetallicRoughness) mat.pbrMetallicRoughness = {}
    mat.pbrMetallicRoughness.baseColorTexture = { index: headTexIndex }
    mat.pbrMetallicRoughness.baseColorFactor = [1, 1, 1, 1]
    mat.alphaMode = 'OPAQUE'
    delete mat.alphaCutoff
  }
}

function markAlphaMats(json) {
  for (const mat of json.materials || []) {
    const n = mat.name.toLowerCase()
    if (/eye|brow|hair|mouth|lash/.test(n) && !/head/.test(n.replace('hair', ''))) {
      // hair contains 'hair' - include; head mesh excluded above poorly
    }
    if (/eye|brow|mouth/.test(n) || (/hair/i.test(mat.name) && !/head/i.test(mat.name))) {
      mat.alphaMode = 'MASK'
      mat.alphaCutoff = 0.05
      if (mat.pbrMetallicRoughness?.baseColorFactor) {
        mat.pbrMetallicRoughness.baseColorFactor[3] = 1
      }
    }
    if (/hair/i.test(mat.name)) {
      mat.alphaMode = 'MASK'
      mat.alphaCutoff = 0.15
    }
  }
}

const sofia = parseGlb(readFileSync('../co_der-resource/beat-roguelite/figures/skyrim-female/models/body.glb'))
const femalehead = getImageBytes(
  sofia.json,
  sofia.bin,
  (im) => /femalehead/i.test(im.name || ''),
)
if (!femalehead) throw new Error('femalehead not in sofia glb')
console.log('source skin', femalehead.name, femalehead.bytes.length)

const sisters = [
  '../co_der-resource/beat-roguelite/figures/holysee-vie/models/body.glb',
  '../co_der-resource/beat-roguelite/figures/holysee-lite/models/body.glb',
  '../co_der-resource/beat-roguelite/figures/holysee-iru/models/body.glb',
]

/** NPC_Head_Head rest Y from earlier inspect (Skyrim cm). */
const HEAD_BONE_Y = 120.3
const HEAD_BONE_Z = 1.5

for (const path of sisters) {
  let { json, bin } = parseGlb(readFileSync(path))

  // Inject femalehead if missing
  let headTex = json.textures.findIndex((_, ti) => {
    const src = json.textures[ti]?.source
    return src != null && /femalehead/i.test(json.images[src]?.name || '')
  })
  if (headTex < 0) {
    const appended = appendImage(json, bin, 'femalehead', femalehead.mimeType, femalehead.bytes)
    bin = appended.bin
    headTex = appended.texIndex
    console.log(path, 'injected femalehead tex', headTex)
  }
  retargetHeadMat(json, headTex)
  markAlphaMats(json)

  const headName = (json.meshes || []).find((m) => /FemaleHead|_XCXFemaleHead/i.test(m.name))?.name
  if (!headName) {
    console.log('no head mesh', path)
    writeFileSync(path, writeGlb(json, bin))
    continue
  }

  const head = meshCenterY(json, bin, headName)
  // 1) Snap head mesh center to bone
  const dyHead = HEAD_BONE_Y - head.cy
  const dzHead = HEAD_BONE_Z - head.cz
  const faceParts = (json.meshes || [])
    .map((m) => m.name)
    .filter((n) =>
      /FemaleHead|_XCXFemale|Mouth|HairFemale|HairLine|HAIRLINE|Brows|Eyes/i.test(n),
    )

  for (const n of faceParts) translateMeshPositions(json, bin, n, 0, dyHead, dzHead)
  console.log(path, 'snap head', { dyHead: +dyHead.toFixed(2), dzHead: +dzHead.toFixed(2) })

  // 2) Place eyes / brows / mouth onto the face (head-local heuristics)
  const head2 = meshCenterY(json, bin, headName)
  const headH = (head2.maxY ?? 0) - (head2.minY ?? 0)
  const headD = (head2.maxZ ?? 0) - (head2.minZ ?? 0)
  // Forward: Skyrim face often -Z in this export (head minZ is front-ish from earlier bboxes)
  const faceZ = head2.cz - headD * 0.12

  const place = (pred, yMul, zExtra = 0) => {
    for (const m of json.meshes || []) {
      if (!pred(m.name)) continue
      const c = meshCenterY(json, bin, m.name)
      if (!c) continue
      const ty = head2.minY + headH * yMul
      const tz = faceZ + zExtra
      translateMeshPositions(json, bin, m.name, head2.cx - c.cx, ty - c.cy, tz - c.cz)
      console.log('  place', m.name, '-> y', +ty.toFixed(1))
    }
  }

  place((n) => /Eyes/i.test(n), 0.58, -0.4)
  place((n) => /Brows/i.test(n), 0.68, -0.2)
  place((n) => /Mouth/i.test(n), 0.38, 0.2)

  writeFileSync(path, writeGlb(json, bin))
  const h3 = meshCenterY(json, bin, headName)
  console.log('  head cy', +h3.cy.toFixed(1), 'range', +h3.minY.toFixed(1), '..', +h3.maxY.toFixed(1))
}

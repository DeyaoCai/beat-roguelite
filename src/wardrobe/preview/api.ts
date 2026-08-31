import { allAnims, animById, type AnimRow } from '../../content/anims'
import { isHairCard, type HairCardMaps, type LitMaps } from '../../content/shading'
import {
  loadGltfClips,
  type ModelTextureMaps,
  type OutfitPart,
} from '../../presentation/render/gltfModel'
import type { ModularAvatar } from '../../figures/tka-jodi/modularAvatar'
import { modelUrl } from '../assets'
import {
  BODY_MESH,
  DEFAULT_LOADOUT,
  MAKEUP_TYPE_NAMES,
  clothesById,
  dyePartLabel,
  makeupById,
  type ClothesTypeName,
  type MakeupRow,
  type MakeupTypeName,
} from '../catalog'
import {
  createWardrobeSession,
  type MakeupLoadout,
  type WardrobeLoadout,
} from '../session'
import {
  applyBodySkinMaps,
  applyMakeupDecals,
  applyNamedFaceMaps,
  type MakeupDecal,
} from './looks'
import { SLOT_SHOT, shotForMakeup, type PreviewShot } from './shots'

export type { PreviewShot, WardrobeLoadout }

export type DyePart = { id: string; label: string }

export type WardrobeApi = {
  ready: Promise<void>
  getLoadout(): WardrobeLoadout
  getError(): string
  getTint(slot: ClothesTypeName): string
  setTint(slot: ClothesTypeName, cssHex: string): void
  listSlotParts(slot: ClothesTypeName): DyePart[]
  getPartTint(slot: ClothesTypeName, matName: string): string
  setPartTint(slot: ClothesTypeName, matName: string, cssHex: string): void
  getHairRoot(): string
  getHairTip(): string
  setHairRoot(cssHex: string): void
  setHairTip(cssHex: string): void
  setHairColor(cssHex: string): void
  getShot(): PreviewShot
  setShot(shot: PreviewShot): void
  focusSlot(slot: ClothesTypeName): void
  getPoses(): AnimRow[]
  getPoseId(): string | null
  setPose(id: string | null): Promise<void>
  equip(itemId: string | null, typeName: ClothesTypeName): Promise<void>
  getMakeup(): MakeupLoadout
  equipMakeup(itemId: string | null, typeName: MakeupTypeName): Promise<void>
  hydrate(opts?: { pose?: boolean }): Promise<void>
  subscribe(fn: () => void): () => void
}

const BODY_PART: OutfitPart = {
  url: modelUrl(...BODY_MESH.split('/')),
  shading: 'lit',
  material: { roughness: 0.72, metalness: 0 },
}

function toUrl(rel: string | undefined): string | undefined {
  if (!rel) return undefined
  return modelUrl(...rel.split('/'))
}

function litUrls(tex: LitMaps | undefined): ModelTextureMaps | undefined {
  if (!tex) return undefined
  const out: ModelTextureMaps = {
    map: toUrl(tex.map),
    normalMap: toUrl(tex.normalMap),
    ormMap: toUrl(tex.ormMap),
    roughnessMap: toUrl(tex.roughnessMap),
    metalnessMap: toUrl(tex.metalnessMap),
    aoMap: toUrl(tex.aoMap),
  }
  return Object.values(out).some(Boolean) ? out : undefined
}

function hairUrls(hair: HairCardMaps | undefined): HairCardMaps | undefined {
  if (!hair) return undefined
  const out: HairCardMaps = {
    rootMap: toUrl(hair.rootMap),
    idMap: toUrl(hair.idMap),
    flowMap: toUrl(hair.flowMap),
    opacityMap: toUrl(hair.opacityMap),
    depthMap: toUrl(hair.depthMap),
  }
  return Object.values(out).some(Boolean) ? out : undefined
}

function parseCssHex(cssHex: string) {
  const n = Number.parseInt(cssHex.replace('#', ''), 16)
  return Number.isFinite(n) ? n : 0xffffff
}

function flattenEquipRect(v: MakeupRow['screenRect']): MakeupDecal['screenRect'] {
  if (v == null) return null
  if (Array.isArray(v) && v.length === 1 && Array.isArray(v[0])) {
    const inner = v[0]
    if (inner.every((n) => typeof n === 'number')) return inner
  }
  if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return v
  if (!Array.isArray(v)) return v
  return null
}

function rowToPart(itemId: string, hairDye: { root: number; tip: number }): OutfitPart | null {
  const row = clothesById(itemId)
  if (!row?.mesh) return null
  const shading = isHairCard(row.typeName, row.shading) ? 'hairCard' : 'lit'
  const textures = shading === 'lit' ? litUrls(row.textures) : undefined
  return {
    url: modelUrl(...row.mesh.split('/')),
    shading,
    textures,
    hair: shading === 'hairCard' ? hairUrls(row.hair) : undefined,
    hairDye: shading === 'hairCard' ? hairDye : undefined,
    mapsTarget: row.typeName === 'Skin' ? 'skin' : 'all',
    material: {
      roughness: 0.72,
      metalness: 0,
      preserveEmbeddedMaps: row.typeName === 'Skin' ? true : !textures,
    },
  }
}

export function createWardrobeApi(
  avatar: ModularAvatar,
  hooks: {
    onShot?: (shot: PreviewShot) => void
    getShot?: () => PreviewShot
  } = {},
): WardrobeApi {
  const session = createWardrobeSession({
    clothesById,
    makeupById,
    animById,
    defaultLoadout: DEFAULT_LOADOUT,
  })
  let seq = 0
  const clipCache = new Map<string, Awaited<ReturnType<typeof loadGltfClips>>>()
  const makeupDecals = new Map<string, MakeupDecal>()

  const hairDye = () => ({
    root: parseCssHex(session.getHairRoot()),
    tip: parseCssHex(session.getHairTip()),
  })

  const applySlotTint = (typeName: ClothesTypeName) => {
    if (typeName === 'Hair') {
      avatar.setHairDye(hairDye())
      return
    }
    const tint = session.getTint(typeName)
    if (tint && tint !== '#ffffff') avatar.setSlotColor(typeName, parseCssHex(tint))
    const lens = session.getLensTint()
    if (lens && lens !== '#ffffff') avatar.setLensColor(parseCssHex(lens))
    for (const name of avatar.listSlotParts(typeName)) {
      const stored = session.peekPartTint(typeName, name)
      if (stored) avatar.setSlotPartColor(typeName, name, parseCssHex(stored))
    }
  }

  const paintDecals = async () => {
    const root = avatar.getSkinRoot()
    if (root) await applyMakeupDecals(root, [...makeupDecals.values()])
  }

  const applyMakeup = async (itemId: string | null, typeName: MakeupTypeName) => {
    const root = avatar.getSkinRoot()
    if (!root) return
    if (!itemId) {
      if (typeName === 'Eye') await applyNamedFaceMaps(root, 'eye', undefined)
      else if (typeName === 'Eyelashes') await applyNamedFaceMaps(root, 'lash', undefined)
      else {
        makeupDecals.delete(typeName)
        await paintDecals()
      }
      return
    }
    const row = makeupById(itemId)
    if (!row) return
    if (typeName === 'Eye') await applyNamedFaceMaps(root, 'eye', litUrls(row.textures), row.color)
    else if (typeName === 'Eyelashes') await applyNamedFaceMaps(root, 'lash', litUrls(row.textures), row.color)
    else {
      makeupDecals.set(typeName, {
        map: toUrl(row.textures?.map),
        screenRect: flattenEquipRect(row.screenRect),
      })
      await paintDecals()
    }
  }

  const replayLooks = async () => {
    for (const kind of MAKEUP_TYPE_NAMES) {
      await applyMakeup(session.getMakeup()[kind] ?? null, kind)
    }
  }

  const applySkinMaps = async (textures: ModelTextureMaps | undefined) => {
    const root = avatar.getSkinRoot()
    if (!root) return
    await applyBodySkinMaps(root, textures)
    await replayLooks()
  }

  const applyClothes = async (itemId: string | null, typeName: ClothesTypeName) => {
    if (!itemId || (typeName === 'Skin' && itemId === 'jodi')) {
      if (typeName === 'Skin') {
        await avatar.setSlot('Skin', BODY_PART)
        applySlotTint('Skin')
        await applySkinMaps(undefined)
      } else await avatar.setSlot(typeName, null)
      return
    }
    const part = rowToPart(itemId, hairDye())
    if (!part) throw new Error(`${clothesById(itemId)?.caption ?? itemId} 没有网格`)
    await avatar.setSlot(typeName, part)
    applySlotTint(typeName)
    if (typeName === 'Skin') await applySkinMaps(part.textures)
  }

  const applyPose = async (id: string | null) => {
    if (!id) {
      avatar.playClip(null, false)
      return
    }
    const row = animById(id)
    if (!row) throw new Error(`未知姿势 ${id}`)
    const url = modelUrl(...row.url.split('/'))
    let pack = clipCache.get(url)
    if (!pack) {
      pack = await loadGltfClips(url)
      clipCache.set(url, pack)
    }
    const clip = pack.clips[row.clip] ?? pack.clips[0]
    if (!clip) throw new Error(`${row.caption} 没有动画轨道`)
    avatar.playClip(clip, row.loop, pack.rest)
  }

  const equip = async (itemId: string | null, typeName: ClothesTypeName) => {
    const token = ++seq
    const prev = session.getLoadout()[typeName] ?? null
    const r = session.equip(itemId, typeName)
    if (!r.ok) {
      session.setError(r.error)
      return
    }
    try {
      await applyClothes(itemId, typeName)
      if (token !== seq) return
      session.clearError()
    } catch (e) {
      if (token !== seq) return
      session.equip(prev, typeName)
      try {
        await applyClothes(prev, typeName)
      } catch {
        /* keep the original 3D error */
      }
      session.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const setPose = async (id: string | null) => {
    const token = ++seq
    const prev = session.getPoseId()
    const r = session.setPose(id)
    if (!r.ok) {
      session.setError(r.error)
      return
    }
    try {
      await applyPose(id)
      if (token !== seq) return
      session.clearError()
    } catch (e) {
      if (token !== seq) return
      session.setPose(prev)
      try {
        await applyPose(prev)
      } catch {
        /* keep the original 3D error */
      }
      session.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const equipMakeup = async (itemId: string | null, typeName: MakeupTypeName) => {
    const prev = session.getMakeup()[typeName] ?? null
    const r = session.equipMakeup(itemId, typeName)
    if (!r.ok) {
      session.setError(r.error)
      return
    }
    try {
      if (itemId) {
        const row = makeupById(itemId)
        const shot = shotForMakeup(typeName, row?.cameraPosition)
        session.setShot(shot)
        hooks.onShot?.(shot)
      }
      await applyMakeup(itemId, typeName)
      session.clearError()
    } catch (e) {
      session.equipMakeup(prev, typeName)
      try {
        await applyMakeup(prev, typeName)
      } catch {
        /* keep the original 3D error */
      }
      session.setError(e instanceof Error ? e.message : String(e))
    }
  }

  const setHairRoot = (cssHex: string) => {
    session.setHairRoot(cssHex)
    avatar.setHairDye(hairDye())
  }
  const setHairTip = (cssHex: string) => {
    session.setHairTip(cssHex)
    avatar.setHairDye(hairDye())
  }
  const setHairColor = (cssHex: string) => {
    session.setHairColor(cssHex)
    avatar.setHairDye(hairDye())
  }
  const setTint = (slot: ClothesTypeName, cssHex: string) => {
    session.setTint(slot, cssHex)
    if (slot === 'Hair') avatar.setHairDye(hairDye())
    else {
      avatar.setSlotColor(slot, parseCssHex(cssHex.startsWith('#') ? cssHex : `#${cssHex}`))
      applySlotTint(slot)
    }
  }
  const setPartTint = (slot: ClothesTypeName, matName: string, cssHex: string) => {
    session.setPartTint(slot, matName, cssHex)
    avatar.setSlotPartColor(slot, matName, parseCssHex(cssHex.startsWith('#') ? cssHex : `#${cssHex}`))
  }
  const listSlotParts = (slot: ClothesTypeName): DyePart[] => {
    const names = avatar.listSlotParts(slot)
    const counts = new Map<string, number>()
    for (const name of names) {
      const label = dyePartLabel(name)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    return names.map((id) => {
      const label = dyePartLabel(id)
      return { id, label: (counts.get(label) ?? 0) > 1 ? `${label} · ${id}` : label }
    })
  }

  const ready = avatar.ready.then(() => undefined)

  const hydrate = async (opts: { pose?: boolean } = {}) => {
    const withPose = opts.pose !== false
    await avatar.ready
    session.restore()
    const loadout = session.getLoadout()
    await applyClothes(loadout.Skin ?? 'jodi', 'Skin')
    for (const [slot, id] of Object.entries(loadout) as [ClothesTypeName, string | null][]) {
      if (slot === 'Skin' || !id) continue
      await applyClothes(id, slot)
    }
    for (const [kind, id] of Object.entries(session.getMakeup()) as [MakeupTypeName, string | null][]) {
      if (id) await applyMakeup(id, kind)
    }
    if (withPose) {
      const pose = session.getPoseId()
      if (pose) await applyPose(pose)
    }
    session.enablePersist()
  }

  return {
    ready,
    hydrate,
    getLoadout: () => session.getLoadout(),
    getError: () => session.getError(),
    getTint: (slot) => session.getTint(slot),
    setTint,
    listSlotParts,
    getPartTint: (slot, matName) => session.getPartTint(slot, matName),
    setPartTint,
    getHairRoot: () => session.getHairRoot(),
    getHairTip: () => session.getHairTip(),
    setHairRoot,
    setHairTip,
    setHairColor,
    getShot: () => hooks.getShot?.() ?? session.getShot(),
    setShot: (shot) => {
      session.setShot(shot)
      hooks.onShot?.(shot)
    },
    focusSlot: (slot) => {
      hooks.onShot?.(SLOT_SHOT[slot])
    },
    getPoses: () => allAnims(),
    getPoseId: () => session.getPoseId(),
    setPose,
    equip,
    getMakeup: () => session.getMakeup(),
    equipMakeup,
    subscribe: (fn) => session.subscribe(fn),
  }
}

export { BODY_PART }

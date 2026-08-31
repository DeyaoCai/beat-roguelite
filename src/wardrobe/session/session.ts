import type { ClothesTypeName, MakeupTypeName } from '../catalog/types'
import { isClothesType } from '../catalog/types'
import { looksLikeLensPart } from '../catalog/guess'
import { loadWardrobePersist, saveWardrobePersist } from './persist'
import type { PersistShot } from './persist'
import { DEFAULT_LOOK, LOOKS, type LookId } from '../../content/looks'

export type WardrobeLoadout = Partial<Record<ClothesTypeName, string | null>>
export type MakeupLoadout = Partial<Record<MakeupTypeName, string | null>>

export type SessionResult = { ok: true } | { ok: false; error: string }

export type WardrobeSessionPorts = {
  clothesById(id: string): { typeName: ClothesTypeName; caption: string } | undefined
  makeupById(id: string): { typeName: MakeupTypeName; caption: string } | undefined
  animById(id: string): { caption: string } | undefined
  defaultLoadout: WardrobeLoadout
}

function normHex(cssHex: string) {
  return cssHex.startsWith('#') ? cssHex : `#${cssHex}`
}

function partKey(slot: ClothesTypeName, matName: string) {
  return `${slot}::${matName}`
}

/**
 * Appearance + persist. No Three / DOM.
 */
export function createWardrobeSession(ports: WardrobeSessionPorts) {
  const loadout: WardrobeLoadout = {}
  const makeup: MakeupLoadout = {}
  const tints: Partial<Record<ClothesTypeName, string>> = {}
  const partTints: Record<string, string> = {}
  const listeners = new Set<() => void>()
  let error = ''
  let hairRoot = '#ffffff'
  let hairTip = '#ffffff'
  let lensTint = '#ffffff'
  let poseId: string | null = null
  let allowSave = false
  let shot: PersistShot = 'full'
  let lookId: LookId = DEFAULT_LOOK

  const notify = () => {
    for (const fn of listeners) fn()
  }

  const persist = () => {
    if (!allowSave) return
    saveWardrobePersist({
      lookId,
      loadout: { ...loadout },
      makeup: { ...makeup },
      tints: { ...tints },
      partTints: { ...partTints },
      hairRoot,
      hairTip,
      lensTint,
      shot,
      poseId,
    })
  }

  const setError = (msg: string) => {
    error = msg
    notify()
  }

  const clearError = () => {
    error = ''
    notify()
  }

  const equip = (itemId: string | null, typeName: ClothesTypeName): SessionResult => {
    clearError()
    if (itemId) {
      const row = ports.clothesById(itemId)
      if (!row) return { ok: false, error: `未知衣服 ${itemId}` }
      if (row.typeName !== typeName) {
        return { ok: false, error: `${row.caption} 属于 ${row.typeName}，不是 ${typeName}` }
      }
      loadout[typeName] = itemId
      persist()
      notify()
      return { ok: true }
    }
    if (typeName === 'Skin') {
      loadout.Skin = 'jodi'
      persist()
      notify()
      return { ok: true }
    }
    loadout[typeName] = null
    persist()
    notify()
    return { ok: true }
  }

  const equipMakeup = (itemId: string | null, typeName: MakeupTypeName): SessionResult => {
    clearError()
    if (!itemId) {
      makeup[typeName] = null
      persist()
      notify()
      return { ok: true }
    }
    const row = ports.makeupById(itemId)
    if (!row) return { ok: false, error: `未知化妆 ${itemId}` }
    if (row.typeName !== typeName) {
      return { ok: false, error: `${row.caption} 属于 ${row.typeName}，不是 ${typeName}` }
    }
    makeup[typeName] = itemId
    persist()
    notify()
    return { ok: true }
  }

  const setPose = (id: string | null): SessionResult => {
    clearError()
    if (!id) {
      poseId = null
      persist()
      notify()
      return { ok: true }
    }
    const row = ports.animById(id)
    if (!row) return { ok: false, error: `未知姿势 ${id}` }
    poseId = id
    persist()
    notify()
    return { ok: true }
  }

  const restore = () => {
    const saved = loadWardrobePersist()
    if (saved?.lookId && saved.lookId in LOOKS) lookId = saved.lookId
    if (saved?.hairRoot) hairRoot = saved.hairRoot
    if (saved?.hairTip) hairTip = saved.hairTip
    if (saved?.lensTint) lensTint = saved.lensTint
    if (saved?.partTints) Object.assign(partTints, saved.partTints)
    if (saved?.tints) Object.assign(tints, saved.tints)
    if (saved?.shot) shot = saved.shot
    const initial: WardrobeLoadout = { ...ports.defaultLoadout }
    if (saved?.loadout) {
      for (const [slot, id] of Object.entries(saved.loadout)) {
        if (!isClothesType(slot)) continue
        initial[slot] = id as string | null
      }
    }
    for (const [slot, id] of Object.entries(initial) as [ClothesTypeName, string | null][]) {
      if (!id) {
        loadout[slot] = null
        continue
      }
      if (slot === 'Skin' && id === 'jodi') {
        loadout.Skin = 'jodi'
        continue
      }
      const row = ports.clothesById(id)
      if (row && row.typeName === slot) loadout[slot] = id
      else if (slot === 'Skin') loadout.Skin = 'jodi'
    }
    if (saved?.poseId && ports.animById(saved.poseId)) poseId = saved.poseId
    if (saved?.makeup) {
      for (const [kind, id] of Object.entries(saved.makeup)) {
        if (!id) continue
        const row = ports.makeupById(id)
        if (row && row.typeName === kind) makeup[row.typeName] = id
      }
    }
    notify()
  }

  const enablePersist = () => {
    allowSave = true
    persist()
  }

  return {
    restore,
    enablePersist,
    persist,
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    getError: () => error,
    setError,
    clearError,
    getLoadout: (): WardrobeLoadout => ({ ...loadout }),
    getMakeup: (): MakeupLoadout => ({ ...makeup }),
    getTint: (slot: ClothesTypeName) => tints[slot] ?? '#ffffff',
    setTint: (slot: ClothesTypeName, cssHex: string) => {
      const h = normHex(cssHex)
      tints[slot] = h
      if (slot === 'Hair') {
        hairRoot = h
        hairTip = h
      }
      persist()
      notify()
    },
    getPartTint: (slot: ClothesTypeName, matName: string) => {
      const stored = partTints[partKey(slot, matName)]
      if (stored) return stored
      if (looksLikeLensPart(matName) && lensTint && lensTint !== '#ffffff') return lensTint
      return tints[slot] ?? '#ffffff'
    },
    peekPartTint: (slot: ClothesTypeName, matName: string) => partTints[partKey(slot, matName)] ?? null,
    setPartTint: (slot: ClothesTypeName, matName: string, cssHex: string) => {
      partTints[partKey(slot, matName)] = normHex(cssHex)
      persist()
      notify()
    },
    getHairRoot: () => hairRoot,
    getHairTip: () => hairTip,
    getLensTint: () => lensTint,
    setHairRoot: (cssHex: string) => {
      hairRoot = normHex(cssHex)
      persist()
      notify()
    },
    setHairTip: (cssHex: string) => {
      hairTip = normHex(cssHex)
      persist()
      notify()
    },
    setLensTint: (cssHex: string) => {
      lensTint = normHex(cssHex)
      persist()
      notify()
    },
    setHairColor: (cssHex: string) => {
      const h = normHex(cssHex)
      hairRoot = h
      hairTip = h
      persist()
      notify()
    },
    getPoseId: () => poseId,
    getShot: () => shot,
    setShot: (next: PersistShot) => {
      shot = next
      persist()
      notify()
    },
    equip,
    equipMakeup,
    setPose,
  }
}

export type WardrobeSession = ReturnType<typeof createWardrobeSession>

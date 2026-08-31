import type { ClothesTypeName } from '../catalog/types'
import { isClothesType } from '../catalog/types'
import { DEFAULT_LOOK, LOOKS, type LookId } from '../../content/looks'

const KEY = 'beat-roguelite.wardrobe.v1'

export type PersistShot = 'full' | 'bust' | 'face'

export type WardrobePersist = {
  v: 1
  /** 这坨衣服就是该 Look；不含 HP / 伤害。 */
  lookId: LookId
  loadout: Partial<Record<ClothesTypeName, string | null>>
  tints: Partial<Record<ClothesTypeName, string>>
  hairRoot: string
  hairTip: string
  lensTint: string
  partTints: Record<string, string>
  shot: PersistShot
  yaw: number
  pitch: number
  zoom: number
  fov: number
  activeSlot: ClothesTypeName
  activeMod: string | null
  poseId: string | null
  makeup: Partial<Record<string, string | null>>
}

const SHOTS: PersistShot[] = ['full', 'bust', 'face']

function isShot(v: unknown): v is PersistShot {
  return typeof v === 'string' && (SHOTS as string[]).includes(v)
}

function isLookId(v: unknown): v is LookId {
  return typeof v === 'string' && v in LOOKS
}

function stripClothesLoadout(
  raw: Partial<Record<string, string | null>> | undefined,
): Partial<Record<ClothesTypeName, string | null>> {
  const out: Partial<Record<ClothesTypeName, string | null>> = {}
  if (!raw) return out
  for (const [slot, id] of Object.entries(raw)) {
    if (!isClothesType(slot)) continue
    out[slot] = id
  }
  return out
}

export function loadWardrobePersist(): Partial<WardrobePersist> | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<WardrobePersist>
    if (p?.v !== 1) return null
    if (p.loadout) p.loadout = stripClothesLoadout(p.loadout)
    if (p.activeSlot && !isClothesType(p.activeSlot)) p.activeSlot = 'Skin'
    return p
  } catch {
    return null
  }
}

export function saveWardrobePersist(patch: Partial<WardrobePersist>): void {
  try {
    const prev = loadWardrobePersist() ?? { v: 1 as const }
    const next: WardrobePersist = {
      v: 1,
      lookId: patch.lookId ?? (isLookId(prev.lookId) ? prev.lookId : DEFAULT_LOOK),
      loadout: stripClothesLoadout({ ...prev.loadout, ...patch.loadout }),
      tints: stripClothesLoadout({ ...prev.tints, ...patch.tints }) as WardrobePersist['tints'],
      hairRoot: patch.hairRoot ?? prev.hairRoot ?? '#ffffff',
      hairTip: patch.hairTip ?? prev.hairTip ?? '#ffffff',
      lensTint: patch.lensTint ?? prev.lensTint ?? '#ffffff',
      partTints: { ...prev.partTints, ...patch.partTints },
      shot: patch.shot ?? (isShot(prev.shot) ? prev.shot : 'full'),
      yaw: patch.yaw ?? prev.yaw ?? 0.55,
      pitch: patch.pitch ?? prev.pitch ?? 0.1,
      zoom: patch.zoom ?? prev.zoom ?? 1,
      fov: patch.fov ?? prev.fov ?? 32,
      activeSlot:
        patch.activeSlot && isClothesType(patch.activeSlot)
          ? patch.activeSlot
          : prev.activeSlot && isClothesType(prev.activeSlot)
            ? prev.activeSlot
            : 'Skin',
      activeMod: patch.activeMod !== undefined ? patch.activeMod : (prev.activeMod ?? null),
      poseId: patch.poseId !== undefined ? patch.poseId : (prev.poseId ?? null),
      makeup: { ...prev.makeup, ...patch.makeup },
    }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota */
  }
}

let saveTimer = 0
export function saveWardrobePersistSoon(patch: Partial<WardrobePersist>, ms = 280): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => saveWardrobePersist(patch), ms)
}

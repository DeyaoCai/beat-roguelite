import type { ClothesTypeName, MakeupTypeName } from '../catalog'

export type PreviewShot = 'full' | 'bust' | 'face'

export const PREVIEW_SHOT_LABEL: Record<PreviewShot, string> = {
  full: '全身',
  bust: '半身',
  face: '头',
}

export const PREVIEW_SHOTS: Record<
  PreviewShot,
  { chestRatio: number; fill: number; zoom: number; pitch: number }
> = {
  full: { chestRatio: 0.52, fill: 0.82, zoom: 1, pitch: 0.1 },
  bust: { chestRatio: 0.64, fill: 0.74, zoom: 0.52, pitch: 0.06 },
  face: { chestRatio: 0.84, fill: 0.7, zoom: 0.3, pitch: 0.03 },
}

export const SLOT_SHOT: Record<ClothesTypeName, PreviewShot> = {
  Skin: 'full',
  Hair: 'face',
  Face: 'face',
  Ears: 'face',
  Neck: 'bust',
  Dress: 'bust',
  Skirt: 'full',
  Bra: 'bust',
  Briefs: 'full',
  Socks: 'full',
  Shoes: 'full',
  Gloves: 'bust',
  Wrist: 'bust',
  Backpack: 'bust',
  Tail: 'full',
}

/** Default preview when Makeup row has no CameraPosition. */
export const MAKEUP_SHOT: Partial<Record<MakeupTypeName, PreviewShot>> = {
  Eye: 'face',
  Eyelashes: 'face',
  Eyebrow: 'face',
  Eyeshadow: 'face',
  Eyeliner: 'face',
  Lips: 'face',
  Cheeks: 'face',
  Nose: 'face',
  Nails: 'bust',
  Tattoo: 'full',
}

/**
 * TKA CameraPosition RFHH → coarse preview shot.
 * R=orbit 1–8, F=focal 0–9 (closer = higher), HH=height 00–99.
 */
export function shotFromCameraPosition(raw: string | null | undefined): PreviewShot | null {
  if (!raw) return null
  const s = raw.trim()
  if (s === 'full' || s === 'bust' || s === 'face') return s
  const m = s.match(/^([1-8])([0-9])([0-9]{2})$/)
  if (!m) return null
  const focal = Number(m[2])
  const height = Number(m[3])
  if (focal >= 7 || height >= 70) return 'face'
  if (focal >= 4 || height >= 40) return 'bust'
  return 'full'
}

export function shotForMakeup(
  typeName: MakeupTypeName,
  cameraPosition?: string | null,
): PreviewShot {
  return shotFromCameraPosition(cameraPosition) ?? MAKEUP_SHOT[typeName] ?? 'face'
}

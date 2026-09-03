import type { FrameSnapshot } from './types'

export type FxMix = FrameSnapshot['fxMix']

/** 嫁接主色：雷 > 火裂 > 冰 > 多发 > 风。没嫁接则用主手底色。 */
export function graftAccentHex(mix: FxMix, fallback: number): number {
  if (mix.thunder) return 0x7dd3fc
  if (mix.split) return 0xfbbf24
  if (mix.slow) return 0x67e8f9
  if (mix.volley) return 0xa78bfa
  if (mix.knock) return 0x5eead4
  return fallback
}

export function graftSparkHex(mix: FxMix, i: number, fallback: number): number {
  const cols: number[] = []
  if (mix.split) cols.push(0xfbbf24, 0xfb923c)
  if (mix.slow) cols.push(0x67e8f9, 0xe0f2fe)
  if (mix.thunder) cols.push(0x7dd3fc, 0xf0f9ff)
  if (mix.knock) cols.push(0x5eead4, 0xecfeff)
  if (mix.volley) cols.push(0xa78bfa, 0xfde68a)
  if (!cols.length) return fallback
  return cols[i % cols.length]!
}

export function hexRgba(hex: number, a: number): string {
  return `rgba(${(hex >> 16) & 255},${(hex >> 8) & 255},${hex & 255},${a})`
}

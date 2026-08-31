import type { FrameSnapshot } from './types'

const KIND_RGB: Record<string, [number, number, number]> = {
  slash: [94, 234, 212],
  flame: [94, 234, 212],
  orb: [249, 115, 22],
  aura: [125, 211, 252],
  chain: [56, 189, 248],
  star: [180, 83, 9],
  orbit: [251, 191, 36],
  fever: [253, 224, 71],
  hit: [254, 240, 138],
}

function formatAmount(n: number): string {
  if (n >= 10) return String(Math.round(n))
  const t = Math.round(n * 10) / 10
  return Number.isInteger(t) ? String(t) : t.toFixed(1)
}

/** Screen-space damage popups. `toScreen` maps world XZ → CSS pixels. */
export function drawDamageFloaters(
  ctx: CanvasRenderingContext2D,
  items: FrameSnapshot['floaters'],
  toScreen: (x: number, z: number) => { sx: number; sy: number },
): void {
  if (!items.length) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const f of items) {
    const { sx, sy } = toScreen(f.x, f.z)
    const u = f.lifeRatio
    const rise = (1 - u) * 46
    const x = sx + f.drift * 16
    const y = sy - 26 - rise
    const fade = u < 0.28 ? u / 0.28 : 1
    const punch = 1 + 0.4 * Math.max(0, (u - 0.72) / 0.28)
    const base = f.kill ? 22 : f.kind === 'aura' ? 13 : f.kind === 'fever' ? 20 : 16
    const size = base * punch
    ctx.font = `800 ${size}px Segoe UI, sans-serif`
    ctx.lineJoin = 'round'
    ctx.miterLimit = 2
    ctx.lineWidth = f.kill ? 5 : 3.5
    ctx.strokeStyle = `rgba(8, 10, 16, ${0.72 * fade})`
    const rgb = f.kill
      ? [255, 255, 255]
      : f.crit
        ? [253, 224, 71]
        : (KIND_RGB[f.kind] ?? KIND_RGB.hit)!
    ctx.fillStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.95 * fade})`
    const text = f.crit ? `${formatAmount(f.amount)}!` : formatAmount(f.amount)
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
  }
  ctx.restore()
}

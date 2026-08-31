import { highwayLayout } from './highwayLayout'
import { playCamLayout } from './playPortrait'
import type { FrameSnapshot } from './types'

export type ScreenPt = { sx: number; sy: number }

type TrackKind = 'boss' | 'elite' | 'relic_major' | 'relic_minor'

type TrackTarget = {
  kind: TrackKind
  x: number
  z: number
  hpRatio: number
}

const STYLE: Record<
  TrackKind,
  { fill: string; glow: string; rgb: [number, number, number]; size: number; label: string | null }
> = {
  boss: { fill: '#fb7185', glow: '#fecaca', rgb: [251, 113, 133], size: 16, label: 'BOSS' },
  elite: { fill: '#fbbf24', glow: '#fef3c7', rgb: [251, 191, 36], size: 13, label: '精' },
  relic_major: { fill: '#c4b5fd', glow: '#ede9fe', rgb: [196, 181, 253], size: 12, label: '遗' },
  relic_minor: { fill: '#a78bfa', glow: '#ddd6fe', rgb: [167, 139, 250], size: 10, label: null },
}

const INNER = 36

function collect(snap: FrameSnapshot): TrackTarget[] {
  const out: TrackTarget[] = []
  for (const e of snap.enemies) {
    if (e.kind === 'boss') {
      out.push({ kind: 'boss', x: e.x, z: e.z, hpRatio: e.hpRatio })
    } else if (e.kind === 'elite') {
      out.push({ kind: 'elite', x: e.x, z: e.z, hpRatio: e.hpRatio })
    }
  }
  for (const p of snap.pickups) {
    if (p.kind === 'relic_major') {
      out.push({ kind: 'relic_major', x: p.x, z: p.z, hpRatio: 1 })
    } else if (p.kind === 'relic_minor') {
      out.push({ kind: 'relic_minor', x: p.x, z: p.z, hpRatio: 1 })
    }
  }
  return out
}

function inside(sx: number, sy: number, left: number, top: number, right: number, bottom: number) {
  return sx >= left && sx <= right && sy >= top && sy <= bottom
}

/** Ray from origin (inside) through target, first hit on the inset frame. */
function edgeHit(
  ox: number,
  oy: number,
  tx: number,
  ty: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): ScreenPt {
  const dx = tx - ox
  const dy = ty - oy
  let t = Infinity
  if (dx > 1e-6) t = Math.min(t, (right - ox) / dx)
  if (dx < -1e-6) t = Math.min(t, (left - ox) / dx)
  if (dy > 1e-6) t = Math.min(t, (bottom - oy) / dy)
  if (dy < -1e-6) t = Math.min(t, (top - oy) / dy)
  if (!Number.isFinite(t) || t <= 0) {
    return { sx: (left + right) / 2, sy: top }
  }
  return {
    sx: Math.max(left, Math.min(right, ox + dx * t)),
    sy: Math.max(top, Math.min(bottom, oy + dy * t)),
  }
}

function nudgeOffHighway(
  sx: number,
  sy: number,
  w: number,
  h: number,
  left: number,
  top: number,
  right: number,
  bottom: number,
): ScreenPt {
  const hw = highwayLayout(w, h)
  const pad = 10
  const hx0 = hw.x0 - pad
  const hy0 = hw.y0 - pad
  const hx1 = hw.x0 + hw.panelW + pad
  const hy1 = hw.y0 + hw.panelH + pad
  if (sx < hx0 || sx > hx1 || sy < hy0 || sy > hy1) return { sx, sy }

  const toL = sx - hx0
  const toR = hx1 - sx
  if (toL <= toR) sx = Math.max(left, hx0)
  else sx = Math.min(right, hx1)
  return { sx, sy: Math.max(top, Math.min(bottom, sy)) }
}

function drawChevron(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  fill: string,
  glow: string,
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.shadowColor = glow
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.moveTo(size * 1.05, 0)
  ctx.lineTo(-size * 0.62, size * 0.72)
  ctx.lineTo(-size * 0.28, 0)
  ctx.lineTo(-size * 0.62, -size * 0.72)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.strokeStyle = glow
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.restore()
}

function drawHpArc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  ratio: number,
  rgb: [number, number, number],
) {
  const start = -Math.PI * 0.75
  const span = Math.PI * 1.5
  ctx.beginPath()
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.7)'
  ctx.lineWidth = 3
  ctx.arc(x, y, r, start, start + span)
  ctx.stroke()
  ctx.beginPath()
  ctx.strokeStyle = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.95)`
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.arc(x, y, r, start, start + span * Math.max(0.04, Math.min(1, ratio)))
  ctx.stroke()
  ctx.lineCap = 'butt'
}

/**
 * Edge chevrons for off-screen elites, bosses, and relics.
 * `toScreen` maps world XZ → CSS pixels (may lie outside the canvas).
 */
export function drawOffscreenTrackers(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
  toScreen: (x: number, z: number) => ScreenPt,
): void {
  if (snap.scene !== 'play' && snap.scene !== 'pick') return
  const targets = collect(snap)
  if (!targets.length) return

  const lay = playCamLayout(w, h, snap)
  const left = Math.max(INNER, lay.panel.x + lay.panel.w + 10)
  const top = snap.boss ? 46 : 22
  const right = Math.min(w - INNER, lay.full.x - 10)
  const bottom = Math.min(h - 86, lay.bust.y - 10)
  if (right - left < 80 || bottom - top < 80) return

  const origin = toScreen(snap.player.x, snap.player.z)
  let ox = Number.isFinite(origin.sx) ? origin.sx : w * 0.5
  let oy = Number.isFinite(origin.sy) ? origin.sy : h * 0.5
  if (!inside(ox, oy, left, top, right, bottom)) {
    ox = (left + right) / 2
    oy = (top + bottom) / 2
  }
  const pulse = 1 + 0.1 * Math.sin(performance.now() * 0.007)

  ctx.save()
  for (const t of targets) {
    const p = toScreen(t.x, t.z)
    if (!Number.isFinite(p.sx) || !Number.isFinite(p.sy)) continue
    if (inside(p.sx, p.sy, left, top, right, bottom)) continue

    let hit = edgeHit(ox, oy, p.sx, p.sy, left, top, right, bottom)
    hit = nudgeOffHighway(hit.sx, hit.sy, w, h, left, top, right, bottom)
    const ang = Math.atan2(p.sy - oy, p.sx - ox)
    const st = STYLE[t.kind]
    const size = st.size * (t.kind === 'boss' ? pulse : 1)
    const [r, g, b] = st.rgb
    ctx.beginPath()
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`
    ctx.arc(hit.sx, hit.sy, size * 1.55, 0, Math.PI * 2)
    ctx.fill()
    drawChevron(ctx, hit.sx, hit.sy, ang, size, st.fill, st.glow)
    if (t.kind === 'boss' || t.kind === 'elite') {
      drawHpArc(ctx, hit.sx, hit.sy, size * 0.92, t.hpRatio, st.rgb)
    }
    if (st.label) {
      ctx.font = '800 9px Segoe UI, Microsoft YaHei, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      const lx = hit.sx - Math.cos(ang) * (size + 11)
      const ly = hit.sy - Math.sin(ang) * (size + 11)
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(8, 12, 20, 0.75)'
      ctx.strokeText(st.label, lx, ly)
      ctx.fillStyle = st.glow
      ctx.fillText(st.label, lx, ly)
    }
  }
  ctx.restore()
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
}

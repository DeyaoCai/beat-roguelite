import type { FrameSnapshot } from './types'
import { drawHudIcon, offerFace } from './hudIcons'
import { C, UI_FONT, roundRect } from './hudChrome'

/**
 * Chrome uses grade color. Skill / group color stays on the icons.
 * Card size does not change with grade.
 */
function offerAccent(u: NonNullable<FrameSnapshot['offer']>[number]): {
  border: string
  borderW: number
  fill: string
  name: string
  detail: string
  key: string
  tag: string
  glow: boolean
  scale: number
} {
  const special = (
    border: string,
    tag: string,
  ): ReturnType<typeof offerAccent> => ({
    border,
    borderW: 2,
    fill: 'rgba(18, 12, 8, 0.92)',
    name: '#f3ead8',
    detail: '#c9a882',
    key: border,
    tag,
    glow: true,
    scale: 1,
  })
  if (u.id.startsWith('fuse_')) return special('#e07a3a', '融')
  if (u.id.startsWith('elem_')) return special('#a78bfa', '元')
  if (u.id.startsWith('rhythm_') || u.id === 'beat_bonus') return special('#facc15', '拍')
  if (u.kind === 'special') return special('#e07a3a', '专')
  if (u.grade >= 3) {
    return {
      border: '#fbbf24',
      borderW: 2.4,
      fill: 'rgba(18, 12, 8, 0.92)',
      name: '#f3ead8',
      detail: '#c9a882',
      key: '#fbbf24',
      tag: 'Ⅲ',
      glow: true,
      scale: 1,
    }
  }
  if (u.grade === 2) {
    return {
      border: '#4ade80',
      borderW: 1.8,
      fill: 'rgba(18, 12, 8, 0.92)',
      name: '#f3ead8',
      detail: '#c9a882',
      key: '#4ade80',
      tag: 'Ⅱ',
      glow: false,
      scale: 1,
    }
  }
  return {
    border: '#5a4636',
    borderW: 1.4,
    fill: 'rgba(18, 12, 8, 0.92)',
    name: '#f3ead8',
    detail: '#c9a882',
    key: '#5c4e40',
    tag: 'Ⅰ',
    glow: false,
    scale: 1,
  }
}

let waveOfferAnimKey = ''
let waveOfferAnimT0 = 0

function waveOfferExpand(snap: FrameSnapshot): number {
  const ids = snap.offer?.map((o) => o.id).join(',') ?? ''
  const key = `w${snap.wave}:${ids}`
  if (key !== waveOfferAnimKey) {
    waveOfferAnimKey = key
    waveOfferAnimT0 = performance.now()
  }
  const t = Math.min(1, (performance.now() - waveOfferAnimT0) / 320)
  return 1 - (1 - t) * (1 - t)
}

/** Wave-end: large cards center-screen. Mid-run: compact top band. */
export function drawCenterOffer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  const offer = snap.offer
  if (!offer?.length) return

  const wavePick = snap.pickReason === 'wave' || snap.scene === 'pick'
  if (wavePick) {
    drawWaveOffer(ctx, w, h, snap, offer)
    return
  }

  const baseW = Math.min(148, Math.max(124, w * 0.14))
  const baseH = Math.min(112, Math.max(96, h * 0.125))
  const gap = 12
  const y0 = snap.boss ? 52 : 44

  const widths = offer.map((u) => baseW * offerAccent(u).scale)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (offer.length - 1)
  let x = (w - total) / 2

  ctx.textAlign = 'center'
  ctx.fillStyle = C.accent
  ctx.font = `700 11px ${UI_FONT}`
  const title =
    snap.pickReason === 'drop_major'
      ? 'Boss'
      : snap.pickReason === 'drop_minor'
        ? '精英'
        : snap.pickReason === 'chest'
          ? '宝箱'
          : `升级 Lv${snap.level}`
  ctx.fillText(title, w / 2, y0 - 6)

  drawOfferRow(ctx, offer, x, y0, baseW, baseH, gap, 1)
  ctx.textAlign = 'left'
}

function drawWaveOffer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
  offer: NonNullable<FrameSnapshot['offer']>,
) {
  const ease = waveOfferExpand(snap)

  ctx.fillStyle = `rgba(6, 4, 2, ${0.52 * ease})`
  ctx.fillRect(0, 0, w, h)

  const baseW = Math.min(188, Math.max(140, w * 0.16))
  const baseH = Math.min(210, Math.max(168, h * 0.24))
  const gap = Math.min(28, Math.max(16, w * 0.02))
  const widths = offer.map((u) => baseW * offerAccent(u).scale)
  const total = widths.reduce((a, b) => a + b, 0) + gap * (offer.length - 1)
  const scale = 0.86 + 0.14 * ease
  const cx = w / 2
  const cy = h * 0.5 + 10

  ctx.save()
  ctx.globalAlpha = 0.35 + 0.65 * ease
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f3ead8'
  ctx.font = `800 ${Math.round(22 + 4 * ease)}px ${UI_FONT}`
  ctx.fillText('关卡完成', cx, cy - (baseH * scale) / 2 - 36)
  ctx.fillStyle = C.accent
  ctx.font = `600 13px ${UI_FONT}`
  const fusePick = offer.some((u) => u.id.startsWith('fuse_'))
  ctx.fillText(fusePick ? '选择融合 · 1 / 2 / 3' : '选择属性 · 1 / 2 / 3', cx, cy - (baseH * scale) / 2 - 14)

  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-total / 2, -baseH / 2)
  drawOfferRow(ctx, offer, 0, 0, baseW, baseH, gap, 1.15)
  ctx.restore()
  ctx.textAlign = 'left'
}

function hexAlpha(hex: string, a: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function drawPlate(
  ctx: CanvasRenderingContext2D,
  icon: ReturnType<typeof offerFace>['mainIcon'],
  fill: string,
  cx: number,
  cy: number,
  size: number,
) {
  const r = size * 0.18
  ctx.fillStyle = fill
  roundRect(ctx, cx - size / 2, cy - size / 2, size, size, r)
  ctx.fill()
  drawHudIcon(ctx, icon, cx, cy, size * 0.72, '#1a1008')
}

function drawOfferRow(
  ctx: CanvasRenderingContext2D,
  offer: NonNullable<FrameSnapshot['offer']>,
  x0: number,
  y0: number,
  baseW: number,
  baseH: number,
  gap: number,
  textScale: number,
) {
  let x = x0
  offer.forEach((u, i) => {
    const a = offerAccent(u)
    const face = offerFace(u.id)
    const cardW = baseW * a.scale
    const cardH = baseH * a.scale
    const y = y0 + (baseH - cardH) / 2
    const ts = textScale
    const cx = x + cardW / 2
    const tall = cardH >= 150 * ts
    const wash = face.dirInk || face.mainInk

    if (a.glow) {
      ctx.shadowColor = a.border
      ctx.shadowBlur = u.grade >= 3 ? 14 * ts : 8 * ts
    } else {
      ctx.shadowBlur = 0
    }

    ctx.fillStyle = a.fill
    ctx.strokeStyle = a.border
    ctx.lineWidth = a.borderW
    roundRect(ctx, x, y, cardW, cardH, 10 + 2 * ts)
    ctx.fill()
    ctx.fillStyle = hexAlpha(wash, 0.2)
    roundRect(ctx, x, y, cardW, cardH, 10 + 2 * ts)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = a.border
    ctx.globalAlpha = 0.85
    ctx.fillRect(x, y + 12 * ts, 3, cardH - 24 * ts)
    ctx.globalAlpha = 1

    ctx.fillStyle = a.key
    ctx.beginPath()
    ctx.arc(x + 14 * ts, y + 14 * ts, 9 * ts, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1008'
    ctx.font = `800 ${Math.round(11 * ts)}px ${UI_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, x + 14 * ts, y + 18 * ts)

    if (a.tag) {
      ctx.fillStyle = u.grade >= 3 ? '#fde68a' : u.grade === 2 ? '#e8ddd0' : '#7a6a58'
      ctx.font = `800 ${Math.round((tall ? 16 : 13) * ts)}px ${UI_FONT}`
      ctx.textAlign = 'right'
      ctx.fillText(a.tag, x + cardW - 12 * ts, y + cardH - 12 * ts)
    }

    const footer = tall ? 32 * ts : 24 * ts
    const plate = tall
      ? Math.min(84 * ts, cardW * 0.5)
      : Math.min(52 * ts, cardH - footer - 28 * ts)
    const nameH = tall ? 22 * ts : 18 * ts
    const blockH = plate + nameH + 4 * ts
    const plateY = y + 8 * ts + (cardH - footer - 16 * ts - blockH) / 2 + plate / 2
    drawPlate(ctx, face.dirIcon, face.dirInk, cx, plateY, plate)

    ctx.textAlign = 'center'
    ctx.fillStyle = '#f3ead8'
    ctx.font = `800 ${Math.round((tall ? 20 : 16) * ts)}px ${UI_FONT}`
    ctx.fillText(face.dirLabel, cx, plateY + plate / 2 + (tall ? 22 : 17) * ts)

    const chip = tall ? 26 * ts : 20 * ts
    const chipX = x + 12 * ts + chip / 2
    const chipY = y + cardH - 10 * ts - chip / 2
    drawPlate(ctx, face.mainIcon, face.mainInk, chipX, chipY, chip)
    ctx.textAlign = 'left'
    ctx.fillStyle = face.mainInk
    ctx.font = `700 ${Math.round((tall ? 12 : 10) * ts)}px ${UI_FONT}`
    ctx.fillText(face.mainLabel, chipX + chip / 2 + 5 * ts, chipY + 4 * ts)

    x += cardW + gap
  })
}

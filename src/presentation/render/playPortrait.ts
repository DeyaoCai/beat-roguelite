import type { FrameSnapshot } from './types'

export type CamWell = {
  x: number
  y: number
  w: number
  h: number
}

export type PlayCamLayout = {
  panel: CamWell
  face: CamWell
  /** Sofia radio operator — right of the HP/XP/HEAT cluster. */
  radio: CamWell
  bars: { x: number; y: number; w: number }
  bust: CamWell
  full: CamWell
  /** Fever swaps the bottom-right well to full-body. */
  featured: 'bust' | 'full'
  /** Touch: Y above which kit / hints should stay (thumb zone below). */
  thumbTop: number
}

export function playCamLayout(w: number, h: number, snap: FrameSnapshot): PlayCamLayout {
  const touch = snap.touchUi
  const landscape = touch && w > h
  const pad = Math.max(touch ? 10 : 14, w * 0.018)
  const safeTop = touch ? Math.max(10, Math.round(h * 0.012)) : 14
  const thumbTop = touch ? Math.round(h * (landscape ? 0.62 : 0.7)) : h
  const hasStatus =
    snap.player.slowT > 0 ||
    snap.player.poisonT > 0 ||
    snap.player.bleedT > 0 ||
    snap.player.shieldOn
  const face = Math.round(
    Math.min(touch ? 96 : 112, Math.max(touch ? 72 : 88, Math.min(w, h) * (touch ? 0.09 : 0.11))),
  )
  const gap = touch ? 8 : 10
  const barsW = Math.min(touch ? 168 : 200, Math.max(touch ? 128 : 152, w * (touch ? 0.28 : 0.175)))
  const barsH = (touch ? 88 : 96) + (hasStatus ? 16 : 0)
  const inset = touch ? 8 : 10
  const panelH = Math.max(inset * 2 + face, inset + barsH + 6)
  const panelW = inset + face + gap + barsW + inset
  const panelX = pad
  const panelY = safeTop
  const faceX = panelX + inset
  const faceY = panelY + Math.round((panelH - face) / 2)
  const barsX = faceX + face + gap
  const radioX = panelX + panelW + gap

  const featured: 'bust' | 'full' = snap.feverActive ? 'full' : 'bust'
  const hideWell = touch && (w < 520 || landscape)
  const wellW = hideWell ? 0 : Math.round(Math.min(176, Math.max(132, w * 0.145)))
  const wellH = wellW <= 0 ? 0 : featured === 'full' ? Math.round(wellW * 1.32) : wellW
  const well: CamWell = {
    x: w - pad - wellW,
    y: wellW <= 0 ? 0 : Math.min(h - pad - wellH, thumbTop - wellH - 8),
    w: wellW,
    h: wellH,
  }
  const hidden: CamWell = { x: 0, y: 0, w: 0, h: 0 }
  const radioW = hideWell ? 0 : Math.min(face, Math.max(0, w - radioX - pad))

  return {
    panel: { x: panelX, y: panelY, w: panelW, h: panelH },
    face: { x: faceX, y: faceY, w: face, h: face },
    radio: radioW > 0 ? { x: radioX, y: faceY, w: radioW, h: face } : hidden,
    bars: { x: barsX, y: panelY + inset, w: barsW },
    full: featured === 'full' && wellW > 0 ? well : hidden,
    bust: featured === 'bust' && wellW > 0 ? well : hidden,
    featured,
    thumbTop,
  }
}

export function drawPlayPortraitChrome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
): void {
  if (snap.scene !== 'play' && snap.scene !== 'pick') return
  const lay = playCamLayout(w, h, snap)
  const hurt = snap.player.hurtFlash
  const fever = snap.feverActive

  drawWell(ctx, lay.face, '特写', 'face', hurt, fever)
  if (lay.radio.w > 0) drawWell(ctx, lay.radio, '通讯', 'idle', 0, false)
  if (fever) drawLightningFrame(ctx, lay.face)
  if (lay.featured === 'bust') {
    if (lay.bust.w > 0) drawWell(ctx, lay.bust, '半身', 'live', hurt, fever)
  } else if (lay.full.w > 0) {
    drawWell(ctx, lay.full, fever ? 'FEVER' : '全身', 'live', hurt, fever)
  }
}

function drawWell(
  ctx: CanvasRenderingContext2D,
  well: CamWell,
  label: string,
  mode: 'live' | 'face' | 'idle',
  hurt: number,
  fever: boolean,
) {
  const live = mode === 'live' || (mode === 'face' && fever)
  const hot = hurt > 0.12 && (mode === 'face' || live)
  const border = live ? '#fde047' : hot ? '#fb7185' : 'rgba(232, 160, 74, 0.55)'
  const { x, y, w, h } = well

  ctx.save()
  ctx.fillStyle = 'rgba(22, 14, 10, 0.9)'
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 10)
  ctx.fill()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  ctx.fillRect(x, y, w, h)
  ctx.globalCompositeOperation = 'source-over'

  if (!(mode === 'face' && fever)) {
    ctx.strokeStyle = border
    ctx.lineWidth = live ? 2.4 : hot ? 2.1 : 1.4
    if (live) {
      ctx.shadowColor = 'rgba(253, 224, 71, 0.5)'
      ctx.shadowBlur = 12
    } else if (hot) {
      ctx.shadowColor = 'rgba(251, 113, 133, 0.4)'
      ctx.shadowBlur = 8
    } else {
      ctx.shadowColor = 'rgba(232, 160, 74, 0.32)'
      ctx.shadowBlur = 6
    }
    roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 10)
    ctx.stroke()
    ctx.shadowBlur = 0
  }

  ctx.font = '700 9px Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'
  ctx.fillStyle = live ? '#fde047' : hot ? '#fda4af' : '#e8a04a'
  ctx.textAlign = 'left'
    ctx.fillText(label, x + 7, y + h - 7)
  ctx.restore()
  ctx.textAlign = 'left'
}

function drawLightningFrame(ctx: CanvasRenderingContext2D, well: CamWell) {
  const pad = 5
  const x = well.x - pad
  const y = well.y - pad
  const w = well.w + pad * 2
  const h = well.h + pad * 2
  const t = performance.now() * 0.001
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (let e = 0; e < 4; e++) {
    const a = corners[e]!
    const b = corners[(e + 1) % 4]!
    const segs = 9
    ctx.beginPath()
    for (let i = 0; i <= segs; i++) {
      const u = i / segs
      const jig =
        i === 0 || i === segs
          ? 0
          : Math.sin(t * 22 + e * 3.1 + i * 1.7) * (5 + (i % 3) * 3)
      const dx = b[0] - a[0]
      const dy = b[1] - a[1]
      const len = Math.hypot(dx, dy) || 1
      const nx = -dy / len
      const ny = dx / len
      const px = a[0] + dx * u + nx * jig
      const py = a[1] + dy * u + ny * jig
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.95)'
    ctx.shadowColor = 'rgba(253, 224, 71, 0.9)'
    ctx.shadowBlur = 10
    ctx.lineWidth = 3.2
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(254, 252, 232, 0.95)'
    ctx.lineWidth = 1.15
    ctx.stroke()
  }
  ctx.restore()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

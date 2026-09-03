import type { FrameSnapshot } from './types'
import { highwayLayout } from './highwayLayout'
import { C, UI_FONT, roundRect } from './hudChrome'

/** Canvas fallback highway (Three path uses `highway3d.ts`). Single rail. */
export function drawHighway(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  const hw = snap.highway
  const { x0, y0, panelW, panelH, cx, topY, judgeY } = highwayLayout(w, h)
  const grooveW = panelW * 0.58

  ctx.fillStyle = 'rgba(22, 14, 10, 0.7)'
  ctx.strokeStyle = 'rgba(232, 160, 74, 0.32)'
  ctx.lineWidth = 1.5
  roundRect(ctx, x0, y0, panelW, panelH, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = C.accent
  ctx.fillRect(x0, y0 + 12, 3, panelH - 24)

  ctx.fillStyle = C.mute
  ctx.font = `11px ${UI_FONT}`
  ctx.textAlign = 'center'
  ctx.fillText(hw.songTitle || 'TRACK', cx, y0 + 16)

  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.fillRect(x0 + 7, y0 + 26, panelW - 14, 3.5)
  ctx.fillStyle = '#e8a04a'
  ctx.fillRect(x0 + 7, y0 + 26, (panelW - 14) * hw.songProgress, 3.5)

  const pulse = hw.judgePulse
  const jr = hw.judgeResult

  ctx.fillStyle = 'rgba(28, 18, 12, 0.9)'
  ctx.fillRect(cx - grooveW / 2, topY - 8, grooveW, judgeY - topY + 24)

  if (pulse > 0.05) {
    const a = 0.12 + 0.4 * pulse
    ctx.fillStyle =
      jr === 'miss'
        ? `rgba(248,113,113,${a})`
        : jr === 'perfect'
          ? `rgba(253,224,71,${a})`
          : `rgba(232,160,74,${a})`
    ctx.fillRect(cx - grooveW / 2, topY, grooveW, judgeY - topY + 16)
  }

  ctx.fillStyle = '#3a2414'
  roundRect(ctx, cx - grooveW * 0.52, judgeY - 7, grooveW * 1.04, 14, 6)
  ctx.fill()

  const lineGlow =
    pulse > 0.05
      ? jr === 'miss'
        ? '#fb7185'
        : jr === 'perfect'
          ? '#fde047'
          : '#e8a04a'
      : '#c4783a'
  ctx.strokeStyle = lineGlow
  ctx.lineWidth = 3 + 4 * pulse
  ctx.globalAlpha = 0.8 + 0.2 * pulse
  ctx.beginPath()
  ctx.moveTo(cx - grooveW * 0.42, judgeY)
  ctx.lineTo(cx + grooveW * 0.42, judgeY)
  ctx.stroke()
  ctx.globalAlpha = 1

  ctx.fillStyle = C.ink
  ctx.font = `700 12px ${UI_FONT}`
  ctx.fillText(hw.labels[0] ?? 'Space', cx, judgeY + 32)

  if (pulse > 0.05 && jr) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.translate(cx, judgeY - 24)
    const s = 1 + 0.22 * pulse
    ctx.scale(s, s)
    ctx.font = `800 12px ${UI_FONT}`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'
    const tip = hw.timingHint
    const label = tip
      ? `${jr.toUpperCase()} · ${tip.toUpperCase()}`
      : jr.toUpperCase()
    ctx.strokeText(label, 0, 0)
    ctx.fillStyle = tip
      ? tip === 'early'
        ? '#c9a882'
        : '#fb923c'
      : jr === 'miss'
        ? '#fb7185'
        : jr === 'perfect'
          ? '#fde047'
          : '#e8a04a'
    ctx.fillText(label, 0, 0)
    ctx.restore()
  }

  for (const n of hw.notes) {
    const yy = topY + (1 - Math.max(0, n.y)) * (judgeY - topY)
    let fill = '#e8a04a'
    let alpha = 0.95
    let rw = grooveW * 0.78
    let rh = 12
    if (n.judged) {
      if (n.result === 'miss') {
        fill = '#fb7185'
        alpha = 0.55
      } else if (n.result === 'perfect') {
        fill = '#fde047'
        alpha = 0.75
        rw *= 1.2
        rh *= 1.35
      } else {
        fill = '#e8a04a'
        alpha = 0.6
        rw *= 1.1
      }
    }
    ctx.globalAlpha = alpha
    ctx.fillStyle = fill
    roundRect(ctx, cx - rw / 2, yy - rh / 2, rw, rh, rh / 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}

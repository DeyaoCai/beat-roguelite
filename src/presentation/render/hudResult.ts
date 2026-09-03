import type { FrameSnapshot } from './types'
import { C, UI_FONT, drawCard } from './hudChrome'

export function drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, snap: FrameSnapshot) {
  ctx.fillStyle = 'rgba(7, 10, 16, 0.62)'
  ctx.fillRect(0, 0, w, h)
  const r = snap.result!
  const cardW = Math.min(460, w * 0.52)
  const cardH = snap.contractMul > 1.001 ? 268 : 244
  const cx = (w - cardW) / 2
  const cy = (h - cardH) / 2
  drawCard(ctx, cx, cy, cardW, cardH, r.won ? 'mint' : 'idle')
  ctx.textAlign = 'center'
  ctx.fillStyle = r.won ? C.accent : '#fb7185'
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText(r.won ? 'CLEAR' : 'DOWN', w / 2, cy + 32)
  ctx.font = `700 36px ${UI_FONT}`
  ctx.fillText(r.won ? '通关' : '阵亡', w / 2, cy + 72)
  ctx.fillStyle = C.mute
  ctx.font = `14px ${UI_FONT}`
  ctx.fillText(r.won ? `标准 · 第 ${r.waves} 波` : `撑到第 ${r.waves} 波`, w / 2, cy + 98)
  ctx.fillStyle = C.ink
  ctx.font = `16px ${UI_FONT}`
  ctx.fillText(`得分 ${r.score}    击杀 ${r.kills}    连击 ${r.maxCombo}`, w / 2, cy + 132)
  ctx.fillStyle = C.gold
  ctx.font = `700 18px ${UI_FONT}`
  ctx.fillText(`入袋 +${r.banked}`, w / 2, cy + 164)
  if (snap.contractMul > 1.001) {
    ctx.fillStyle = '#fde68a'
    ctx.font = `13px ${UI_FONT}`
    ctx.fillText(`含契约 ×${snap.contractMul.toFixed(2)}`, w / 2, cy + 188)
  }
  ctx.fillStyle = C.mute
  ctx.font = `15px ${UI_FONT}`
  ctx.fillText('Enter 回枢纽', w / 2, cy + cardH - 28)
  ctx.textAlign = 'left'
}

import type { FrameSnapshot } from './types'
import {
  C,
  UI_FONT,
  drawCard,
  drawHintLine,
  drawKicker,
  drawPageTitle,
  drawPill,
  drawVeil,
} from './hudChrome'

export function drawShop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  drawVeil(ctx, w, h, 0.58)
  const x = Math.max(28, w * 0.05)
  drawKicker(ctx, x, h * 0.1, 'SHOP')
  drawPageTitle(ctx, x, h * 0.1 + 34, '商店')
  const pw = drawPill(
    ctx,
    x,
    h * 0.1 + 48,
    `钱袋 ${snap.purse}`,
    'rgba(42, 32, 12, 0.85)',
    C.goldLine,
    C.gold,
  )
  drawHintLine(ctx, x + pw + 12, h * 0.1 + 64, '永久人物属性 · WASD 选择 · Enter 购买')

  if (snap.shopRows.length === 0) {
    ctx.fillStyle = C.dim
    ctx.font = `15px ${UI_FONT}`
    ctx.fillText('现在没有可买的东西。', x, h * 0.38)
  }

  const listTop = h * 0.22
  const listBot = h * 0.88
  const rowH = 40
  const gap = 5
  const rowW = Math.min(520, w * 0.52)
  const vis = Math.max(
    4,
    Math.min(snap.shopRows.length, Math.floor((listBot - listTop) / (rowH + gap))),
  )
  let start = 0
  if (snap.shopRows.length > vis) {
    start = Math.max(0, Math.min(snap.shopIndex - ((vis / 2) | 0), snap.shopRows.length - vis))
  }
  if (start > 0) {
    ctx.fillStyle = C.mute
    ctx.font = `12px ${UI_FONT}`
    ctx.fillText('▲', x + 8, listTop - 6)
  }
  for (let visI = 0; visI < vis; visI++) {
    const i = start + visI
    const row = snap.shopRows[i]
    if (!row) break
    const y = listTop + visI * (rowH + gap)
    const selected = i === snap.shopIndex
    const can = row.status === 'ok'
    drawCard(
      ctx,
      x,
      y,
      rowW,
      rowH,
      selected ? 'mint' : can ? 'idle' : 'off',
    )
    ctx.fillStyle = selected ? C.accent : can ? C.ink : C.dim
    ctx.font = `600 15px ${UI_FONT}`
    ctx.fillText(row.name, x + 14, y + 16)
    ctx.fillStyle = selected ? C.accentSoft : can ? C.mute : '#475569'
    ctx.font = `11px ${UI_FONT}`
    ctx.fillText(row.blurb, x + 14, y + 32, rowW - 88)
    const tag =
      row.status === 'owned' ? '已解锁' : row.status === 'max' ? '已满' : `${row.price}`
    const tagFill =
      row.status === 'owned' || row.status === 'max'
        ? 'rgba(42, 24, 10, 0.9)'
        : row.status === 'poor'
          ? 'rgba(69, 10, 10, 0.85)'
          : 'rgba(42, 32, 12, 0.9)'
    const tagStroke =
      row.status === 'owned' || row.status === 'max'
        ? C.accentLine
        : row.status === 'poor'
          ? 'rgba(251, 113, 133, 0.85)'
          : C.goldLine
    const tagFg =
      row.status === 'owned' || row.status === 'max'
        ? C.accent
        : row.status === 'poor'
          ? '#fda4af'
          : C.gold
    ctx.font = `700 12px ${UI_FONT}`
    const tw = ctx.measureText(tag).width + 16
    drawPill(ctx, x + rowW - 12 - tw, y + 10, tag, tagFill, tagStroke, tagFg)
  }
  if (start + vis < snap.shopRows.length) {
    ctx.fillStyle = C.mute
    ctx.font = `12px ${UI_FONT}`
    ctx.fillText('▼', x + 8, listBot + 4)
  }

  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, h * 0.92)
}

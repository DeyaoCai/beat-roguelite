import { HUB_THEMES, hubThemeById } from '../../content/hubThemes'
import type { FrameSnapshot } from './types'
import {
  C,
  UI_FONT,
  drawBar,
  drawCard,
  drawHintLine,
  drawKicker,
  drawPageTitle,
  drawPill,
  drawVeil,
} from './hudChrome'

export function drawHub(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  drawVeil(ctx, w, h, 0.5)
  const x = Math.max(28, w * 0.055)
  const theme = hubThemeById(snap.hubThemeId)
  drawKicker(ctx, x, h * 0.12, theme.kickerEn)
  drawPageTitle(ctx, x, h * 0.12 + 36, 'Beat Roguelite')
  ctx.fillStyle = C.mute
  ctx.font = `15px ${UI_FONT}`
  ctx.fillText(`${theme.name} · ${theme.blurb}`, x, h * 0.12 + 58)
  const pw = drawPill(
    ctx,
    x,
    h * 0.12 + 72,
    `钱袋 ${snap.purse}`,
    'rgba(42, 32, 12, 0.85)',
    C.goldLine,
    C.gold,
  )
  const rows = snap.hubRows
  drawHintLine(
    ctx,
    x + pw + 12,
    h * 0.12 + 88,
    rows[snap.hubIndex]?.name === '外形'
      ? 'A/D 换外形 · Enter'
      : 'W/S 选择 · A/D 换主页 · Enter',
  )

  let chipX = x
  const chipY = h * 0.12 + 104
  for (const t of HUB_THEMES) {
    const on = t.id === snap.hubThemeId
    const tw = drawPill(
      ctx,
      chipX,
      chipY,
      t.name,
      on ? C.cardHi : 'rgba(8, 8, 8, 0.35)',
      on ? C.accentLine : C.line,
      on ? C.accent : C.mute,
    )
    chipX += tw + 6
  }

  const cardY0 = h * 0.42
  const cardH = 52
  const gap = 10
  const cardW = Math.min(340, w * 0.4)
  for (let i = 0; i < rows.length; i++) {
    const it = rows[i]!
    const selected = i === snap.hubIndex
    const by = cardY0 + i * (cardH + gap)
    drawCard(ctx, x, by, cardW, cardH, selected ? 'mint' : 'idle')
    ctx.fillStyle = selected ? C.accent : C.ink
    ctx.font = `600 16px ${UI_FONT}`
    ctx.fillText(it.name, x + 18, by + 22)
    ctx.fillStyle = selected ? C.accentSoft : C.mute
    ctx.font = `12px ${UI_FONT}`
    ctx.fillText(it.blurb, x + 18, by + 40)
  }
}

export function drawOptions(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  drawVeil(ctx, w, h, 0.52)
  const x = Math.max(28, w * 0.05)
  drawKicker(ctx, x, h * 0.12, 'OPTIONS')
  drawPageTitle(ctx, x, h * 0.12 + 36, '选项')
  drawHintLine(ctx, x, h * 0.12 + 58, 'WASD 切换 · A/D 调节 · Esc 回枢纽')

  const theme = hubThemeById(snap.hubThemeId)
  const rows: { name: string; detail: string; bar: number | null }[] = [
    { name: '音乐', detail: `${Math.round(snap.musicGain * 100)}%`, bar: snap.musicGain },
    { name: '音效', detail: `${Math.round(snap.sfxGain * 100)}%`, bar: snap.sfxGain },
    { name: '主页', detail: `${theme.name} · ${theme.blurb}`, bar: null },
  ]
  const cardW = Math.min(360, w * 0.4)
  const barW = cardW - 28
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!
    const selected = i === snap.optionsRow
    const y = h * 0.3 + i * 88
    drawCard(ctx, x, y, cardW, 72, selected ? 'mint' : 'idle')
    ctx.fillStyle = selected ? C.accent : C.ink
    ctx.font = `600 16px ${UI_FONT}`
    ctx.fillText(row.name, x + 16, y + 26)
    ctx.fillStyle = selected ? C.accentSoft : C.mute
    ctx.font = `12px ${UI_FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(row.detail, x + cardW - 16, y + 26)
    ctx.textAlign = 'left'
    if (row.bar !== null) drawBar(ctx, x + 16, y + 42, barW, row.bar, selected)
    else {
      ctx.fillStyle = C.dim
      ctx.font = `12px ${UI_FONT}`
      ctx.fillText('A/D 换风格 · 衣橱仍用镜厅', x + 16, y + 50)
    }
  }

  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, h * 0.88)
}

export function drawCloset(ctx: CanvasRenderingContext2D, w: number, h: number) {
  drawVeil(ctx, w, h, 0.4)
  const x = Math.max(28, w * 0.05)
  drawKicker(ctx, x, h * 0.16, 'WARDROBE')
  drawPageTitle(ctx, x, h * 0.16 + 36, '衣橱')
  drawHintLine(ctx, x, h * 0.16 + 58, '换装 · 姿势 · 右侧面板')
  ctx.fillStyle = C.mute
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('左键旋转 · 滚轮缩放 · ~ 构图', x, h * 0.16 + 80)
  ctx.fillStyle = C.dim
  ctx.fillText('Esc 返回枢纽', x, h * 0.16 + 108)
}

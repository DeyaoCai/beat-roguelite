import { CODEX_TABS, codexAt, codexEntries } from '../../content/codex'
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
  wrapText,
} from './hudChrome'

export function drawCodex(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  drawVeil(ctx, w, h, 0.34)
  const x = Math.max(24, w * 0.04)
  drawKicker(ctx, x, h * 0.07, 'CODEX')
  drawPageTitle(ctx, x, h * 0.07 + 30, '图鉴')
  drawHintLine(ctx, x, h * 0.07 + 50, 'A/D 切栏 · W/S 条目 · 拖转全身 · Esc 回枢纽')

  let tabX = x
  const tabY = h * 0.07 + 68
  for (const tab of CODEX_TABS) {
    const on = tab.id === snap.codexTab
    const tw = drawPill(
      ctx,
      tabX,
      tabY,
      tab.name,
      on ? C.cardHi : 'rgba(8, 8, 8, 0.35)',
      on ? C.accentLine : C.line,
      on ? C.accent : C.mute,
    )
    tabX += tw + 8
  }

  const rows = codexEntries(snap.codexTab)
  const entry = codexAt(snap.codexTab, snap.codexIndex)
  const listW = Math.min(248, w * 0.26)
  const rowH = 36
  const gap = 5
  const listTop = tabY + 38
  const listH = Math.min(h * 0.38, Math.max(160, h * 0.34))
  const vis = Math.max(1, Math.floor(listH / (rowH + gap)))
  let start = 0
  if (rows.length > vis) {
    start = Math.max(0, Math.min(snap.codexIndex - Math.floor(vis / 2), rows.length - vis))
  }
  const shown = rows.slice(start, start + vis)

  for (let i = 0; i < shown.length; i++) {
    const it = shown[i]!
    const idx = start + i
    const y = listTop + i * (rowH + gap)
    const selected = idx === snap.codexIndex
    drawCard(ctx, x, y, listW, rowH, selected ? 'mint' : 'idle')
    ctx.fillStyle = it.color
    ctx.beginPath()
    ctx.arc(x + 16, y + rowH / 2, 7, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = selected ? C.accent : C.ink
    ctx.font = `600 13px ${UI_FONT}`
    ctx.fillText(it.name, x + 30, y + 15)
    ctx.fillStyle = selected ? C.accentSoft : C.mute
    ctx.font = `11px ${UI_FONT}`
    ctx.fillText(it.tag, x + 30, y + 29)
  }

  const tx = x
  const tw = Math.min(360, w * 0.34)
  let py = listTop + shown.length * (rowH + gap) + 16
  ctx.fillStyle = entry.color
  ctx.font = `700 22px ${UI_FONT}`
  ctx.fillText(entry.name, tx, py)
  py += 20
  ctx.fillStyle = C.gold
  ctx.font = `12px ${UI_FONT}`
  ctx.fillText(entry.kicker, tx, py)
  py += 22
  ctx.font = `13px ${UI_FONT}`
  ctx.fillStyle = C.mute
  for (const line of wrapText(ctx, entry.blurb, tw)) {
    if (py > h * 0.88) break
    ctx.fillText(line, tx, py)
    py += 18
  }
  py += 6
  ctx.fillStyle = C.ink
  for (const para of entry.lines) {
    for (const line of wrapText(ctx, para, tw)) {
      if (py > h * 0.88) break
      ctx.fillText(line, tx, py)
      py += 18
    }
    py += 4
  }
  ctx.fillStyle = C.gold
  ctx.font = `12px ${UI_FONT}`
  for (const fact of entry.facts) {
    if (py > h * 0.9) break
    ctx.fillText(`· ${fact}`, tx, py, tw)
    py += 16
  }

  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, h * 0.94)
}

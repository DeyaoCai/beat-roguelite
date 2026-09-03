import { hubThemeById, type HubThemeId, type HubThemeUi } from '../../content/hubThemes'

export const UI_FONT = 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'
export let C: HubThemeUi = hubThemeById('studio').ui

export function applyHudTheme(themeId: HubThemeId): void {
  C = hubThemeById(themeId).ui
}

export function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
}

export function strokeRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
}

export function drawVeil(ctx: CanvasRenderingContext2D, w: number, h: number, frac = 0.54) {
  const g = ctx.createLinearGradient(0, 0, w * frac, 0)
  g.addColorStop(0, C.veil0)
  g.addColorStop(0.42, C.veilMid)
  g.addColorStop(1, C.veil1)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const edge = ctx.createLinearGradient(0, 0, 0, h)
  edge.addColorStop(0, C.edge0)
  edge.addColorStop(0.22, C.edge1)
  edge.addColorStop(0.55, C.edge2)
  edge.addColorStop(1, C.edge0)
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, 3, h)
}

export function drawKicker(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.accent
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

export function drawPageTitle(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.ink
  ctx.font = `700 34px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

export function drawHintLine(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.mute
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

export function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  stroke: string,
  fg: string,
): number {
  ctx.font = `700 12px ${UI_FONT}`
  const tw = ctx.measureText(text).width + 18
  const ph = 22
  ctx.fillStyle = fill
  fillRound(ctx, x, y, tw, ph, 11)
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  strokeRound(ctx, x, y, tw, ph, 11)
  ctx.fillStyle = fg
  ctx.textAlign = 'left'
  ctx.fillText(text, x + 9, y + 15)
  return tw
}

export function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: 'idle' | 'mint' | 'gold' | 'ice' | 'off' = 'idle',
) {
  const fill =
    kind === 'mint'
      ? C.cardHi
        : kind === 'gold'
          ? 'rgba(48, 28, 10, 0.78)'
          : kind === 'ice'
            ? 'rgba(36, 24, 14, 0.75)'
            : kind === 'off'
              ? 'rgba(18, 12, 8, 0.4)'
              : C.card
  const stroke =
    kind === 'mint'
      ? C.accentLine
      : kind === 'gold'
        ? C.goldLine
        : kind === 'ice'
          ? C.iceLine
          : C.line
  ctx.fillStyle = fill
  fillRound(ctx, x, y, w, h, 10)
  ctx.strokeStyle = stroke
  ctx.lineWidth = kind === 'idle' || kind === 'off' ? 1 : 1.8
  if (kind === 'mint') {
    ctx.shadowColor = C.accentLine
    ctx.shadowBlur = 12
  }
  strokeRound(ctx, x, y, w, h, 10)
  ctx.shadowBlur = 0
  if (kind === 'mint') {
    ctx.fillStyle = C.accent
    ctx.fillRect(x, y + 10, 3, h - 20)
  }
}

export function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  selected: boolean,
) {
  const t = Math.max(0, Math.min(1, ratio))
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  fillRound(ctx, x, y, w, 10, 5)
  ctx.fillStyle = selected ? C.accent : C.ice
  if (t > 0.02) fillRound(ctx, x, y, Math.max(8, w * t), 10, 5)
  ctx.strokeStyle = selected ? C.accentLine : 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  strokeRound(ctx, x, y, w, 10, 5)
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string[] {
  const out: string[] = []
  let line = ''
  for (const ch of text) {
    const next = line + ch
    if (ctx.measureText(next).width > maxW && line) {
      out.push(line)
      line = ch
    } else line = next
  }
  if (line) out.push(line)
  return out
}

export function roundRect(
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

/** Shared screen layout for the centered rhythm rail (HUD + Three). */
export type HighwayLayout = {
  x0: number
  y0: number
  panelW: number
  panelH: number
  cx: number
  topY: number
  judgeY: number
}

export function highwayLayout(cssW: number, cssH: number): HighwayLayout {
  const panelW = Math.min(110, cssW * 0.12)
  const panelH = Math.min(cssH * 0.52, 440)
  const x0 = (cssW - panelW) / 2
  const y0 = Math.max(6, cssH * 0.02)
  const cx = x0 + panelW / 2
  const topY = y0 + 48
  const judgeY = y0 + panelH - 58
  return { x0, y0, panelW, panelH, cx, topY, judgeY }
}

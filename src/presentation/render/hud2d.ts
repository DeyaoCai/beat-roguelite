import type { FrameSnapshot } from './types'
import { applyHudTheme } from './hudChrome'
import { drawHub, drawCloset, drawOptions } from './hudHub'
import { drawShop } from './hudShop'
import { drawCodex } from './hudCodex'
import { drawPrep } from './hudPrep'
import { drawResult } from './hudResult'
import { drawPlayHud } from './hudPlay'
import { drawCenterOffer } from './hudOffer'

export { drawHighway } from './hudHighway'

/** Shared 2D HUD / menu overlay (used above Canvas or Three). Does not clear. */
export function paintHudLayer(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  snap: FrameSnapshot,
): void {
  const themed =
    snap.scene === 'title' ||
    snap.scene === 'options' ||
    snap.scene === 'shop' ||
    snap.scene === 'prep' ||
    snap.scene === 'codex'
  applyHudTheme(themed ? snap.hubThemeId : 'studio')
  if (snap.scene === 'title') {
    drawHub(ctx, cssW, cssH, snap)
    return
  }
  if (snap.scene === 'closet') {
    drawCloset(ctx, cssW, cssH)
    return
  }
  if (snap.scene === 'options') {
    drawOptions(ctx, cssW, cssH, snap)
    return
  }
  if (snap.scene === 'shop') {
    drawShop(ctx, cssW, cssH, snap)
    return
  }
  if (snap.scene === 'codex') {
    drawCodex(ctx, cssW, cssH, snap)
    return
  }
  if (snap.scene === 'prep') {
    drawPrep(ctx, cssW, cssH, snap)
    return
  }
  if (snap.scene === 'result' && snap.result) {
    drawResult(ctx, cssW, cssH, snap)
    return
  }

  if (snap.scene === 'play' || snap.scene === 'pick') {
    drawPlayHud(ctx, cssW, cssH, snap)
  }
  if (snap.scene === 'play' && snap.offer && snap.pickReason) {
    drawCenterOffer(ctx, cssW, cssH, snap)
  }
  if (snap.scene === 'pick' && snap.offer) {
    drawCenterOffer(ctx, cssW, cssH, snap)
  }

  if (snap.fadeBlack > 0.01) {
    ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, snap.fadeBlack)})`
    ctx.fillRect(0, 0, cssW, cssH)
  }
}

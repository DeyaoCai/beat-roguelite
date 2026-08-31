import { STARTERS } from '../../content/weapons'
import { BLESSINGS } from '../../content/meta'
import { HUB_THEMES, hubThemeById, type HubThemeUi } from '../../content/hubThemes'
import { drawPlayHud } from './hudPlay'
import { highwayLayout } from './highwayLayout'
import type { FrameSnapshot } from './types'

const UI_FONT = 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'
let C: HubThemeUi = hubThemeById('studio').ui

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
    snap.scene === 'prep'
  C = hubThemeById(themed ? snap.hubThemeId : 'studio').ui
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
  if (
    snap.scene === 'play' &&
    snap.offer &&
    snap.pickReason
  ) {
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


function fillRound(
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

function strokeRound(
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

function drawVeil(ctx: CanvasRenderingContext2D, w: number, h: number, frac = 0.54) {
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

function drawKicker(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.accent
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

function drawPageTitle(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.ink
  ctx.font = `700 34px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

function drawHintLine(ctx: CanvasRenderingContext2D, x: number, y: number, text: string) {
  ctx.textAlign = 'left'
  ctx.fillStyle = C.mute
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText(text, x, y)
}

function drawPill(
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

function drawCard(
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

function drawHub(
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
  drawHintLine(ctx, x + pw + 12, h * 0.12 + 88, 'W/S 选择 · A/D 换主页 · Enter')

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

  const rows = snap.hubRows
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

function drawBar(
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

function drawOptions(
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

function drawCloset(ctx: CanvasRenderingContext2D, w: number, h: number) {
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

function drawShop(
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
  drawHintLine(ctx, x + pw + 12, h * 0.1 + 64, '永久出门底子 · WASD 选择 · Enter 购买')

  if (snap.shopRows.length === 0) {
    ctx.fillStyle = C.dim
    ctx.font = `15px ${UI_FONT}`
    ctx.fillText('现在没有可买的东西。', x, h * 0.38)
  }

  const rowH = 48
  const rowW = Math.min(440, w * 0.5)
  for (let i = 0; i < snap.shopRows.length; i++) {
    const row = snap.shopRows[i]!
    const y = h * 0.26 + i * (rowH + 8)
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
    ctx.fillText(row.name, x + 14, y + 20)
    ctx.fillStyle = selected ? C.accentSoft : can ? C.mute : '#475569'
    ctx.font = `11px ${UI_FONT}`
    ctx.fillText(row.blurb, x + 14, y + 38)
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
    drawPill(ctx, x + rowW - 12 - tw, y + 13, tag, tagFill, tagStroke, tagFg)
  }

  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, h * 0.92)
}

function drawPrep(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  drawVeil(ctx, w, h, 0.6)
  const x = Math.max(28, w * 0.045)
  drawKicker(ctx, x, h * 0.08, 'DEPART')
  drawPageTitle(ctx, x, h * 0.08 + 32, '出发')
  const focus = snap.prepFocus
  let px = x
  px +=
    drawPill(
      ctx,
      px,
      h * 0.08 + 44,
      snap.runMode === 'endless' ? '无限' : '标准五波',
      snap.runMode === 'endless' ? 'rgba(42, 32, 12, 0.85)' : 'rgba(16, 42, 36, 0.85)',
      focus === 'mode' ? C.accentLine : snap.runMode === 'endless' ? C.goldLine : C.accentLine,
      focus === 'mode' ? C.accent : snap.runMode === 'endless' ? C.gold : C.accent,
    ) + 8
  px +=
    drawPill(
      ctx,
      px,
      h * 0.08 + 44,
      `钱袋 ${snap.purse}`,
      'rgba(42, 32, 12, 0.85)',
      C.goldLine,
      C.gold,
    ) + 8
  drawPill(
    ctx,
    px,
    h * 0.08 + 44,
    snap.weatherName,
    'rgba(12, 28, 40, 0.85)',
    C.iceLine,
    C.ice,
  )
  drawHintLine(ctx, x, h * 0.08 + 84, 'WASD 选择 · Enter 确认')

  const trackY = h * 0.2
  const trackW = Math.min(520, w * 0.58)
  drawCard(ctx, x, trackY, trackW, 52, focus === 'track' ? 'mint' : 'idle')
  ctx.fillStyle = C.ice
  ctx.font = `700 15px ${UI_FONT}`
  ctx.fillText(snap.highway.songTitle || '选择曲目中…', x + 14, trackY + 22)
  ctx.fillStyle = C.mute
  ctx.font = `12px ${UI_FONT}`
  ctx.fillText(
    `${snap.hint || ''}${snap.weatherBlurb ? `  ·  ${snap.weatherBlurb}` : ''}    A / D 切歌`,
    x + 14,
    trackY + 40,
  )

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText('主手 · 踩准拍会再放一次这一门', x, h * 0.295)
  const cardY = h * 0.31
  const cardW = Math.min(128, Math.max(92, (Math.min(w * 0.62, 720) - 40) / STARTERS.length))
  const gap = 8
  for (let i = 0; i < STARTERS.length; i++) {
    const st = STARTERS[i]!
    const selected = st.id === snap.starterId
    const duo = snap.duoStarterId === st.id
    const bx = x + i * (cardW + gap)
    const kind = selected ? 'mint' : duo ? 'ice' : focus === 'starter' ? 'idle' : 'off'
    drawCard(ctx, bx, cardY, cardW, 86, selected && focus === 'starter' ? 'mint' : kind)
    ctx.fillStyle = selected ? C.accent : duo ? C.ice : C.dim
    ctx.font = `800 10px ${UI_FONT}`
    ctx.fillText(selected ? '主手' : duo ? '副手' : '', bx + 10, cardY + 16)
    ctx.fillStyle = selected ? C.accent : C.ink
    ctx.font = `600 14px ${UI_FONT}`
    ctx.fillText(st.name, bx + 10, cardY + 36)
    ctx.fillStyle = selected ? C.accentSoft : C.mute
    ctx.font = `11px ${UI_FONT}`
    const bits = st.blurb.split('·').map((s) => s.trim())
    ctx.fillText(bits[0] ?? '', bx + 10, cardY + 56)
    ctx.fillText(bits[1] ?? '', bx + 10, cardY + 72)
  }

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText('祝福 · 本局增益，不花钱袋', x, h * 0.485)
  const blessY = h * 0.5
  const blessW = Math.min(520, w * 0.58)
  const blessDef = BLESSINGS.find((b) => b.name === snap.blessingName)
  drawCard(
    ctx,
    x,
    blessY,
    blessW,
    snap.blessingName === '双修' ? 84 : 56,
    focus === 'blessing' ? 'mint' : snap.blessingName === '无' ? 'idle' : 'ice',
  )
  ctx.fillStyle = C.ink
  ctx.font = `600 15px ${UI_FONT}`
  ctx.fillText(snap.blessingName === '无' ? '无祝福' : snap.blessingName, x + 14, blessY + 22)
  ctx.fillStyle = C.mute
  ctx.font = `12px ${UI_FONT}`
  if (snap.blessingName === '无') {
    ctx.fillText('A / D 选用 · 没有也行', x + 14, blessY + 42)
  } else if (snap.blessingName === '双修') {
    ctx.fillText('A / D 换祝福 · Q / E 换副手', x + 14, blessY + 42)
    ctx.fillStyle = focus === 'blessing' ? C.accent : C.ice
    ctx.font = `700 13px ${UI_FONT}`
    ctx.fillText(`副手 ${snap.duoLearnName || '—'}  ·  自动打，踩拍不加它`, x + 14, blessY + 66)
  } else {
    ctx.fillText(blessDef?.blurb ?? 'A / D 切换 · 本局生效', x + 14, blessY + 42)
  }

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  const chipHeadY = h * 0.635
  const mulTxt = snap.contractMul > 1.001 ? `  ·  结算金币 ×${snap.contractMul.toFixed(2)}` : ''
  ctx.fillText(`契约 · 自愿加难度，多拿钱${mulTxt}`, x, chipHeadY)
  let cx = x
  let chipTop = chipHeadY + 12
  const chipMax = x + Math.min(520, w * 0.58)
  for (let i = 0; i < snap.contractRows.length; i++) {
    const c = snap.contractRows[i]!
    const label = c.name
    ctx.font = `600 12px ${UI_FONT}`
    const tw = ctx.measureText(label).width + 20
    if (cx > x && cx + tw > chipMax) {
      cx = x
      chipTop += 34
    }
    const cursor = focus === 'contract' && i === snap.prepContractIndex
    ctx.fillStyle = c.on ? 'rgba(42, 32, 12, 0.85)' : C.card
    fillRound(ctx, cx, chipTop, tw, 28, 14)
    ctx.strokeStyle = cursor ? C.accentLine : c.on ? C.goldLine : C.line
    ctx.lineWidth = cursor || c.on ? 1.6 : 1
    strokeRound(ctx, cx, chipTop, tw, 28, 14)
    ctx.fillStyle = cursor ? C.accent : c.on ? '#fde68a' : C.mute
    ctx.fillText(label, cx + 10, chipTop + 19)
    cx += tw + 8
  }
  const pointed = snap.contractRows[snap.prepContractIndex]
  ctx.fillStyle = C.mute
  ctx.font = `12px ${UI_FONT}`
  if (pointed) {
    const extra = Math.round((pointed.bankMul - 1) * 100)
    ctx.fillText(
      `${pointed.on ? '已勾  ' : ''}${pointed.name}：${pointed.blurb}  ·  结算 +${extra}%`,
      x,
      chipTop + 48,
    )
  } else {
    ctx.fillText('不勾也行。Enter 勾选当前项。', x, chipTop + 48)
  }

  const ctaY = h * 0.84
  const ctaW = Math.min(420, w * 0.48)
  drawCard(ctx, x, ctaY, ctaW, 40, focus === 'go' ? 'mint' : 'idle')
  ctx.fillStyle = focus === 'go' ? C.accent : C.ink
  ctx.font = `700 16px ${UI_FONT}`
  ctx.fillText(`Enter  开始 · 主手 ${snap.starterName}`, x + 16, ctaY + 26)
  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, ctaY + 58)
}

function drawResult(ctx: CanvasRenderingContext2D, w: number, h: number, snap: FrameSnapshot) {
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

function offerGlyph(id: string): string {
  switch (id) {
    case 'damage':
      return '伤'
    case 'haste':
      return '迅'
    case 'fire_rate':
      return '速'
    case 'max_hp':
      return '命'
    case 'hp_regen':
      return '愈'
    case 'move_speed':
      return '步'
    case 'melee_range':
      return '锥'
    case 'melee_power':
      return '退'
    case 'heat_decay':
      return '温'
    case 'heat_cap':
      return '热'
    case 'aura_widen':
      return '环'
    case 'aura_slow':
      return '缓'
    case 'luck':
      return '幸'
    case 'armor':
      return '甲'
    case 'crit':
      return '暴'
    case 'growth':
      return '经'
    case 'spread':
      return '散'
    case 'pierce':
      return '穿'
    case 'orb_split':
      return '裂'
    case 'beat_bonus':
      return '拍'
    case 'chain_fork':
      return '弹'
    case 'chain_reach':
      return '围'
    case 'star_rain':
      return '雨'
    case 'star_crater':
      return '坑'
    case 'star_volley':
      return '发'
    case 'elem_break':
      return '甲'
    case 'elem_explode':
      return '炸'
    case 'elem_freeze':
      return '冻'
    case 'elem_amp':
      return '增'
    case 'elem_weak':
      return '虚'
    case 'learn_flame':
      return '风'
    case 'learn_orb':
      return '火'
    case 'learn_aura':
      return '霜'
    case 'learn_chain':
      return '链'
    case 'learn_star':
      return '岩'
    case 'learn_orbit':
      return '刃'
    case 'orbit_blades':
      return '刃'
    case 'orbit_spin':
      return '转'
    case 'elem_cut':
      return '割'
    default:
      return '升'
  }
}

/**
 * Visual weight by rarity — high grade must dominate the scan.
 * Low = ashen; mid = green; top = gold; special = ritual ember.
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
  if (u.kind === 'special') {
    return {
      border: '#e07a3a',
      borderW: 2.5,
      fill: '#3a1810',
      name: '#f3ead8',
      detail: '#e8c4a0',
      key: '#e07a3a',
      tag: '特',
      glow: true,
      scale: 1.04,
    }
  }
  if (u.grade >= 3) {
    return {
      border: '#fbbf24',
      borderW: 3,
      fill: '#422006',
      name: '#fffbeb',
      detail: '#fde68a',
      key: '#fbbf24',
      tag: 'Ⅲ',
      glow: true,
      scale: 1.08,
    }
  }
  if (u.grade === 2) {
    return {
      border: '#4ade80',
      borderW: 2,
      fill: '#14532d',
      name: '#ecfdf5',
      detail: '#86efac',
      key: '#4ade80',
      tag: 'Ⅱ',
      glow: false,
      scale: 1,
    }
  }
  // Grade I — intentionally quiet so eyes skip to better cards.
  return {
    border: '#5a4636',
    borderW: 1,
    fill: '#1c1410',
    name: '#7a6a58',
    detail: '#5c4e40',
    key: '#5c4e40',
    tag: 'Ⅰ',
    glow: false,
    scale: 0.94,
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
function drawCenterOffer(
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

  const baseW = Math.min(132, Math.max(108, w * 0.12))
  const baseH = Math.min(112, Math.max(96, h * 0.12))
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
      ? '大强化'
      : snap.pickReason === 'drop_minor'
        ? '小强化'
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

  const baseW = Math.min(200, Math.max(148, w * 0.168))
  const baseH = Math.min(248, Math.max(188, h * 0.28))
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
  ctx.fillText('选择强化 · 1 / 2 / 3', cx, cy - (baseH * scale) / 2 - 14)

  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-total / 2, -baseH / 2)
  drawOfferRow(ctx, offer, 0, 0, baseW, baseH, gap, 1.15)
  ctx.restore()
  ctx.textAlign = 'left'
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
    const cardW = baseW * a.scale
    const cardH = baseH * a.scale
    const y = y0 + (baseH - cardH) / 2
    const ts = textScale

    if (a.glow) {
      ctx.shadowColor = a.border
      ctx.shadowBlur = u.grade >= 3 || u.kind === 'special' ? 18 * ts : 8 * ts
    } else {
      ctx.shadowBlur = 0
    }

    ctx.fillStyle = a.fill
    ctx.strokeStyle = a.border
    ctx.lineWidth = a.borderW
    roundRect(ctx, x, y, cardW, cardH, 10 + 2 * ts)
    ctx.fill()
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = a.border
    ctx.fillRect(x, y + 12 * ts, 3, cardH - 24 * ts)

    ctx.fillStyle = a.key
    ctx.beginPath()
    ctx.arc(x + 16 * ts, y + 16 * ts, 11 * ts, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#1a1008'
    ctx.font = `800 ${Math.round(13 * ts)}px ${UI_FONT}`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, x + 16 * ts, y + 20 * ts)

    ctx.fillStyle = a.border
    ctx.font = `800 ${Math.round(12 * ts)}px ${UI_FONT}`
    ctx.textAlign = 'right'
    ctx.fillText(a.tag, x + cardW - 12 * ts, y + 18 * ts)

    ctx.textAlign = 'center'
    ctx.fillStyle = a.border
    ctx.font = `800 ${Math.round(28 * ts)}px ${UI_FONT}`
    ctx.fillText(offerGlyph(u.id), x + cardW / 2, y + 52 * ts)

    ctx.fillStyle = a.name
    ctx.font = `800 ${Math.round(17 * ts)}px ${UI_FONT}`
    ctx.fillText(u.name, x + cardW / 2, y + 78 * ts)

    ctx.fillStyle = a.detail
    ctx.font = `600 ${Math.round(12 * ts)}px ${UI_FONT}`
    const effect = (u.detail || u.desc).slice(0, ts > 1 ? 18 : 14)
    ctx.fillText(effect, x + cardW / 2, y + 100 * ts)

    if (ts > 1.05) {
      ctx.fillStyle = 'rgba(243, 234, 216, 0.35)'
      ctx.font = `600 ${Math.round(11 * ts)}px ${UI_FONT}`
      ctx.fillText(`按 ${i + 1}`, x + cardW / 2, y + cardH - 18 * ts)
    }

    x += cardW + gap
  })
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

import { BLESSINGS } from '../../content/meta'
import { graftBlurbOf, graftShortOf } from '../../content/fusions'
import { STARTERS } from '../../content/weapons'
import type { FrameSnapshot } from './types'
import { drawHudIcon, iconForId } from './hudIcons'
import {
  C,
  UI_FONT,
  drawCard,
  drawHintLine,
  drawKicker,
  drawPageTitle,
  drawPill,
  drawVeil,
  fillRound,
  strokeRound,
} from './hudChrome'

export function drawPrep(
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
  if (snap.weatherBlurb) {
    ctx.fillStyle = C.mute
    ctx.font = `11px ${UI_FONT}`
    ctx.fillText(snap.weatherBlurb, x, h * 0.08 + 72)
  }
  drawHintLine(ctx, x, h * 0.08 + 88, 'WASD 换行 · A/D 改当前行 · Enter 确认')

  let y = h * 0.2
  if (snap.rhythmEnabled) {
    const trackW = Math.min(520, w * 0.58)
    drawCard(ctx, x, y, trackW, 52, focus === 'track' ? 'mint' : 'idle')
    ctx.fillStyle = C.ice
    ctx.font = `700 15px ${UI_FONT}`
    ctx.fillText(snap.highway.songTitle || '选择曲目中…', x + 14, y + 22)
    ctx.fillStyle = C.mute
    ctx.font = `12px ${UI_FONT}`
    const dur = snap.highway.songDuration
    ctx.fillText(
      `${dur ? `${dur}  ·  ` : ''}${snap.hint || ''}${snap.weatherBlurb ? `  ·  ${snap.weatherBlurb}` : ''}    A / D 切歌`,
      x + 14,
      y + 40,
    )
    y += 68
  }

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText(
    snap.rhythmEnabled ? '主手 · 踩准拍会再放一次这一门' : '主手',
    x,
    y,
  )
  y += 14
  const cardW = Math.min(128, Math.max(92, (Math.min(w * 0.62, 720) - 40) / STARTERS.length))
  const gap = 8
  const cardH = 86
  for (let i = 0; i < STARTERS.length; i++) {
    const st = STARTERS[i]!
    const selected = st.id === snap.starterId
    const grafted = snap.fuseStarterIds.includes(st.id)
    const bx = x + i * (cardW + gap)
    const kind = selected ? 'mint' : grafted ? 'ice' : focus === 'starter' ? 'idle' : 'off'
    drawCard(ctx, bx, y, cardW, cardH, selected && focus === 'starter' ? 'mint' : kind)
    ctx.fillStyle = selected ? C.accent : grafted ? C.ice : C.dim
    ctx.font = `800 10px ${UI_FONT}`
    ctx.fillText(selected ? '主手' : grafted ? '嫁接' : '', bx + 10, y + 16)
    ctx.fillStyle = selected ? C.accent : C.ink
    ctx.font = `600 14px ${UI_FONT}`
    ctx.fillText(st.name, bx + 10, y + 36)
    ctx.fillStyle = selected ? C.accentSoft : C.mute
    ctx.font = `11px ${UI_FONT}`
    const bits = st.blurb.split('·').map((s) => s.trim())
    ctx.fillText(bits[0] ?? '', bx + 10, y + 56)
    ctx.fillText(bits[1] ?? '', bx + 10, y + 72)
  }
  y += cardH + 16

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  ctx.fillText('祝福 · 本局增益，不花钱袋', x, y)
  y += 14
  const blessW = Math.min(520, w * 0.58)
  const blessDef = BLESSINGS.find((b) => b.name === snap.blessingName)
  drawCard(ctx, x, y, blessW, 56, focus === 'blessing' ? 'mint' : snap.blessingName === '无' ? 'idle' : 'ice')
  ctx.fillStyle = C.ink
  ctx.font = `600 15px ${UI_FONT}`
  ctx.fillText(snap.blessingName === '无' ? '无祝福' : snap.blessingName, x + 14, y + 22)
  ctx.fillStyle = C.mute
  ctx.font = `12px ${UI_FONT}`
  if (snap.blessingName === '无') {
    ctx.fillText(
      snap.startFuseNeed > 0
        ? `商店已买开局融合 · 下一行选 ${snap.startFuseNeed} 门`
        : 'A / D 选用 · 没有也行',
      x + 14,
      y + 42,
    )
  } else {
    ctx.fillText(blessDef?.blurb ?? 'A / D 切换 · 本局生效', x + 14, y + 42)
  }
  y += 68

  if (snap.startFuseNeed > 0) {
    ctx.fillStyle = C.mute
    ctx.font = `700 11px ${UI_FONT}`
    ctx.fillText(
      snap.startFuseNeed > 1
        ? `开局融合 · 选 ${snap.startFuseNeed} 门（已 ${snap.fuseStarterIds.length}）`
        : '嫁接 · 开局融进主手，不另开副手',
      x,
      y,
    )
    y += 14
    const offs = STARTERS.filter((st) => st.id !== snap.starterId)
    const chipW = Math.min(108, Math.max(80, (blessW - (offs.length - 1) * gap) / Math.max(1, offs.length)))
    const chipH = 58
    for (let i = 0; i < offs.length; i++) {
      const st = offs[i]!
      const on = snap.fuseStarterIds.includes(st.id)
      const cursor = focus === 'fuse' && st.id === snap.fuseCursorId
      const bx = x + i * (chipW + gap)
      drawCard(ctx, bx, y, chipW, chipH, cursor ? 'mint' : on ? 'ice' : focus === 'fuse' ? 'idle' : 'off')
      const ink = cursor ? C.accent : on ? C.ice : C.mute
      drawHudIcon(ctx, iconForId(st.id), bx + 16, y + 18, 18, ink)
      ctx.fillStyle = cursor ? C.accent : on ? C.ice : C.ink
      ctx.font = `600 13px ${UI_FONT}`
      ctx.fillText(st.name, bx + 30, y + 22)
      ctx.fillStyle = cursor ? C.accentSoft : on ? C.ice : C.mute
      ctx.font = `11px ${UI_FONT}`
      ctx.fillText(graftShortOf(st.id), bx + 10, y + 44)
    }
    y += chipH + 8
    ctx.fillStyle = focus === 'fuse' ? C.accent : C.ice
    ctx.font = `12px ${UI_FONT}`
    if (snap.startFuseNeed > 1) {
      ctx.fillText('A/D 移动 · Enter 勾选  ·  开局融进主手', x, y + 4)
    } else {
      const off = STARTERS.find((st) => st.id === (snap.fuseStarterIds[0] ?? snap.duoStarterId))
      if (off) {
        ctx.fillText(
          `${snap.starterName} × ${off.name}  ·  主手${graftBlurbOf(off.id)}  ·  A/D 选门`,
          x,
          y + 4,
        )
      } else {
        ctx.fillText('A / D 选出发明融哪一门', x, y + 4)
      }
    }
    y += 22
  }

  ctx.fillStyle = C.mute
  ctx.font = `700 11px ${UI_FONT}`
  const mulTxt = snap.contractMul > 1.001 ? `  ·  结算金币 ×${snap.contractMul.toFixed(2)}` : ''
  ctx.fillText(`契约 · 自愿加难度，多拿钱${mulTxt}`, x, y)
  let cx = x
  let chipTop = y + 12
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

  const ctaY = Math.min(h * 0.9 - 48, Math.max(chipTop + 68, h * 0.84))
  const ctaW = Math.min(420, w * 0.48)
  drawCard(ctx, x, ctaY, ctaW, 40, focus === 'go' ? 'mint' : 'idle')
  ctx.fillStyle = focus === 'go' ? C.accent : C.ink
  ctx.font = `700 16px ${UI_FONT}`
  const duoTag = snap.duoLearnName ? ` × ${snap.duoLearnName}` : ''
  ctx.fillText(`Enter  开始 · 主手 ${snap.starterName}${duoTag}`, x + 16, ctaY + 26)
  ctx.fillStyle = C.dim
  ctx.font = `13px ${UI_FONT}`
  ctx.fillText('Esc 返回枢纽', x, ctaY + 58)
}

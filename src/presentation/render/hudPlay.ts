import type { FrameSnapshot } from './types'
import { highwayLayout } from './highwayLayout'
import { playCamLayout, type PlayCamLayout } from './playPortrait'

const FONT = 'Segoe UI, PingFang SC, Microsoft YaHei, sans-serif'
const FEVER_END_WARN_SEC = 2.2

type EdgeSpark = {
  edge: 0 | 1 | 2 | 3
  u: number
  speed: number
  life: number
  max: number
  size: number
}

const feverSparks: EdgeSpark[] = []
let hudFxT = performance.now()

function spawnFeverSpark() {
  feverSparks.push({
    edge: Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3,
    u: Math.random(),
    speed: (Math.random() < 0.5 ? 1 : -1) * (0.18 + Math.random() * 0.45),
    life: 0.45 + Math.random() * 0.7,
    max: 0,
    size: 1.4 + Math.random() * 3.2,
  })
  feverSparks[feverSparks.length - 1]!.max = feverSparks[feverSparks.length - 1]!.life
}

function edgePoint(edge: 0 | 1 | 2 | 3, u: number, w: number, h: number, pad: number) {
  const x = Math.max(0, Math.min(1, u))
  if (edge === 0) return { x: x * w, y: pad }
  if (edge === 1) return { x: w - pad, y: x * h }
  if (edge === 2) return { x: (1 - x) * w, y: h - pad }
  return { x: pad, y: (1 - x) * h }
}

/** In-run HUD chrome. Does not cover the centered rhythm highway. */
export function drawPlayHud(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
): void {
  drawHurtVignette(ctx, w, h, snap.player.hurtFlash)
  drawFeverFlash(ctx, w, h, snap)

  const lay = playCamLayout(w, h, snap)
  drawVitals(ctx, lay, snap)

  const midOffer =
    !!snap.offer && snap.pickReason != null && snap.pickReason !== 'wave'
  if (!midOffer) drawRun(ctx, w, snap)

  drawKit(ctx, lay.panel.x, h, snap)
  drawRailChrome(ctx, w, h, snap)
  drawBossBar(ctx, w, h, snap)
  drawLevelUp(ctx, w, h, snap)
  drawHint(ctx, w, h, snap.hint)
}

function drawHurtVignette(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hurt: number,
) {
  if (hurt <= 0.02) return
  drawEdgeGlow(ctx, w, h, [220, 40, 60], 0.35 + 0.55 * hurt, 72 + 40 * hurt)
}

function drawVitals(ctx: CanvasRenderingContext2D, lay: PlayCamLayout, snap: FrameSnapshot) {
  const x = lay.bars.x
  const barW = lay.bars.w
  const rightX = lay.panel.x + lay.panel.w - 12
  let cy = lay.bars.y + 2
  const hpH = snap.player.maxHp <= 10 ? 14 : 10
  paintPanel(ctx, lay.panel.x, lay.panel.y, lay.panel.w, lay.panel.h)

  const hpHurt = snap.player.hurtFlash > 0.15
  drawLabel(ctx, x, cy, 'HP', hpHurt ? '#fda4af' : '#b8a894')
  drawHp(ctx, x + 28, cy - 9, barW - 76, hpH, snap.player.hp, snap.player.maxHp, hpHurt)
  ctx.textAlign = 'right'
  ctx.font = `600 11px ${FONT}`
  ctx.fillStyle = hpHurt ? '#fda4af' : '#f3ead8'
  ctx.fillText(
    `${Math.max(0, Math.ceil(snap.player.hp * 10) / 10)}/${snap.player.maxHp}`,
    rightX,
    cy + 2,
  )
  ctx.textAlign = 'left'
  cy += hpH + 8

  // Status chips: slow / poison / bleed
  {
    let sx = x
    const chip = (label: string, color: string, on: boolean) => {
      if (!on) return
      ctx.fillStyle = color
      const tw = ctx.measureText(label).width
      ctx.globalAlpha = 0.9
      roundRect(ctx, sx, cy - 9, tw + 10, 14, 7)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#1a1008'
      ctx.font = `700 10px ${FONT}`
      ctx.fillText(label, sx + 5, cy + 1)
      sx += tw + 14
    }
    chip('减速', 'rgba(125, 211, 252, 0.95)', snap.player.slowT > 0)
    chip('中毒', 'rgba(74, 222, 128, 0.95)', snap.player.poisonT > 0)
    chip('流血', 'rgba(251, 113, 133, 0.95)', snap.player.bleedT > 0)
    chip('盾', 'rgba(232, 160, 74, 0.95)', snap.player.shieldOn)
    if (
      snap.player.slowT > 0 ||
      snap.player.poisonT > 0 ||
      snap.player.bleedT > 0 ||
      snap.player.shieldOn
    ) {
      cy += 16
    }
  }

  drawLabel(ctx, x, cy, 'XP', '#b8a894')
  drawBar(ctx, x + 28, cy - 7, barW - 86, 8, snap.xpProgress, '#c4783a')
  ctx.fillStyle = '#f3ead8'
  ctx.font = `600 12px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`Lv ${snap.level}`, rightX, cy + 2)
  ctx.textAlign = 'left'
  cy += 18

  const feverR = snap.heatMax > 0 ? snap.heat / snap.heatMax : 0
  const feverEnding = snap.feverActive && snap.feverRemain <= FEVER_END_WARN_SEC
  const feverHot = snap.feverActive || feverR >= 0.98
  const feverReady =
    !snap.feverActive && snap.feverCooldown <= 0 && feverR >= 0.98
  const feverCd = snap.feverCooldown > 0 && !snap.feverActive
  const warnBlink = feverEnding ? 0.5 + 0.5 * Math.sin(performance.now() * 0.02) : 1
  drawLabel(
    ctx,
    x,
    cy,
    feverCd ? 'CD' : feverEnding ? 'END' : feverReady ? (snap.feverMute ? '锁' : 'F') : 'HEAT',
    feverCd
      ? '#b8a894'
      : feverEnding
        ? `rgba(253,224,71,${0.55 + 0.45 * warnBlink})`
        : feverReady
          ? snap.feverMute
            ? '#b8a894'
            : '#fde047'
          : feverHot
            ? '#fde047'
            : '#eab308',
  )
  drawBar(
    ctx,
    x + 44,
    cy - 7,
    barW - 96,
    8,
    feverR,
    feverCd ? '#7a6a58' : feverEnding ? '#facc15' : feverHot ? '#fde047' : '#eab308',
    feverReady && !snap.feverMute,
  )
  ctx.fillStyle = feverHot ? '#fde68a' : '#f3ead8'
  ctx.font = `700 13px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`×${snap.mult.toFixed(2)}`, rightX, cy + 2)
  ctx.textAlign = 'left'
  cy += 18

  let sx = x
  sx += drawMiniPill(ctx, sx, cy - 8, `金 ${snap.gold}`, 'rgba(42, 32, 12, 0.9)', '#fbbf24') + 6
  sx += drawMiniPill(ctx, sx, cy - 8, `幸 ${snap.luck}`, 'rgba(42, 24, 10, 0.9)', '#e8a04a') + 6
  if (snap.armorDr > 0) {
    sx += drawMiniPill(ctx, sx, cy - 8, `甲 ${Math.round(snap.armorDr * 100)}%`, 'rgba(22, 14, 10, 0.9)', '#d4c4b0') + 6
  }
  if (snap.dodgeChance > 0) {
    sx += drawMiniPill(ctx, sx, cy - 8, `闪 ${Math.round(snap.dodgeChance * 100)}%`, 'rgba(28, 18, 12, 0.9)', '#e8c4a0') + 6
  }
  if (snap.carapaceStacks > 0) {
    drawMiniPill(ctx, sx, cy - 8, `壳 ${snap.carapaceStacks}`, 'rgba(42, 24, 12, 0.9)', '#fdba74')
  }
  ctx.fillStyle = '#d4c4b0'
  ctx.font = `700 12px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`${snap.score}`, rightX, cy + 2)
  ctx.textAlign = 'left'
}

function drawRun(ctx: CanvasRenderingContext2D, w: number, snap: FrameSnapshot) {
  const colW = Math.min(228, Math.max(180, w * 0.2))
  const x = w - colW - Math.max(14, w * 0.018)
  const y = 14
  const inner = 12
  const threat = snap.eliteAlive || snap.bossAlive
  const panelH = threat ? 98 : 82
  paintPanel(ctx, x, y, colW, panelH, threat ? 'rgba(251, 113, 133, 0.45)' : 'rgba(232, 160, 74, 0.32)', threat ? '#fb7185' : '#e8a04a')

  ctx.textAlign = 'left'
  ctx.fillStyle = '#e8a04a'
  ctx.font = `700 10px ${FONT}`
  ctx.fillText('WAVE', x + inner, y + inner + 8)
  ctx.fillStyle = '#f3ead8'
  ctx.font = `700 15px ${FONT}`
  ctx.fillText(
    snap.runMode === 'endless' ? `${snap.wave}` : `${snap.wave} / 5`,
    x + inner,
    y + inner + 26,
  )
  ctx.fillStyle = '#c9a882'
  ctx.font = `11px ${FONT}`
  ctx.fillText(snap.weatherName || '晴', x + inner, y + inner + 42)
  ctx.fillStyle = '#b8a894'
  ctx.font = `11px ${FONT}`
  ctx.textAlign = 'right'
  ctx.fillText(`击杀 ${snap.kills}`, x + colW - inner, y + inner + 26)
  ctx.textAlign = 'left'
  drawBar(ctx, x + inner, y + inner + 50, colW - inner * 2, 5, snap.waveProgress, '#e8a04a')

  if (threat) {
    let tx = x + inner
    const ty = y + panelH - 16
    if (snap.eliteAlive) tx = drawTag(ctx, tx, ty, '精英', '#fbbf24', '#422006')
    if (snap.bossAlive) drawTag(ctx, tx, ty, 'BOSS', '#fb7185', '#4c0519')
  }
}

function drawKit(
  ctx: CanvasRenderingContext2D,
  left: number,
  h: number,
  snap: FrameSnapshot,
) {
  const slotW = 56
  const slotH = 50
  const gap = 8
  const weapons = snap.weapons
  const n = Math.max(1, weapons.length)
  const kitW = n * slotW + (n - 1) * gap
  const y = h - 78
  for (let i = 0; i < weapons.length; i++) {
    const wp = weapons[i]!
    const x = left + i * (slotW + gap)
    paintPanel(
      ctx,
      x,
      y,
      slotW,
      slotH,
      wp.empty
        ? 'rgba(100, 116, 139, 0.25)'
        : wp.beat
          ? 'rgba(253, 224, 71, 0.7)'
          : 'rgba(232, 160, 74, 0.28)',
      wp.empty ? '#64748b' : wp.beat ? '#fde047' : '#e8a04a',
    )
    const cd = wp.empty ? 0 : (wp.cd ?? 0)
    if (cd > 0.02) {
      const cx = x + slotW / 2
      const cy = y + slotH / 2
      const r = Math.min(slotW, slotH) * 0.42
      ctx.beginPath()
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2)
      ctx.strokeStyle = wp.beat ? 'rgba(253, 224, 71, 0.85)' : 'rgba(248, 250, 252, 0.55)'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = 'rgba(15, 23, 42, 0.35)'
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r - 1, -Math.PI / 2, -Math.PI / 2 + cd * Math.PI * 2)
      ctx.closePath()
      ctx.fill()
    }
    ctx.textAlign = 'center'
    ctx.fillStyle = wp.empty ? '#94a3b8' : wp.beat ? '#fde047' : '#f3ead8'
    ctx.font = `700 16px ${FONT}`
    ctx.fillText(wp.glyph, x + slotW / 2, y + 24)
    ctx.font = `600 10px ${FONT}`
    ctx.fillStyle = wp.empty ? '#64748b' : wp.beat ? '#fef9c3' : '#b8a894'
    ctx.fillText(wp.name, x + slotW / 2, y + 40)
    if (wp.beat) {
      ctx.font = `700 9px ${FONT}`
      const tw = ctx.measureText('拍').width + 8
      ctx.fillStyle = 'rgba(253, 224, 71, 0.22)'
      roundRect(ctx, x + slotW - tw - 4, y + 4, tw, 12, 6)
      ctx.fill()
      ctx.fillStyle = '#fde047'
      ctx.fillText('拍', x + slotW - tw / 2 - 4, y + 13)
    }
  }
  ctx.textAlign = 'left'

  const chips = snap.upgrades
  if (!chips.length) return
  const chipY = y - 26
  let cx = left
  const maxX = left + Math.max(kitW, 268)
  let drawn = 0
  for (const u of chips) {
    ctx.font = `600 11px ${FONT}`
    const tw = ctx.measureText(u.label).width + 14
    if (cx + tw > maxX || drawn >= 8) break
    const special = u.kind === 'special'
    ctx.fillStyle = special ? 'rgba(42, 32, 12, 0.85)' : 'rgba(28, 18, 12, 0.8)'
    ctx.strokeStyle = special ? 'rgba(251, 191, 36, 0.7)' : 'rgba(232, 160, 74, 0.45)'
    ctx.lineWidth = 1
    roundRect(ctx, cx, chipY, tw, 20, 10)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = special ? '#fde68a' : '#f3ead8'
    ctx.textAlign = 'center'
    ctx.fillText(u.label, cx + tw / 2, chipY + 14)
    cx += tw + 6
    drawn++
  }
  if (chips.length > drawn) {
    ctx.textAlign = 'left'
    ctx.fillStyle = '#b8a894'
    ctx.font = `11px ${FONT}`
    ctx.fillText(`+${chips.length - drawn}`, cx, chipY + 14)
  }
  ctx.textAlign = 'left'
}

function drawBossBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  _h: number,
  snap: FrameSnapshot,
) {
  const boss = snap.boss
  if (!boss || boss.maxHp <= 0) return
  const barW = Math.min(380, Math.max(240, w * 0.36))
  const barH = 12
  const x = (w - barW) / 2
  const y = 10
  const ratio = Math.max(0, Math.min(1, boss.hp / boss.maxHp))
  const low = ratio < 0.28
  const windup = boss.windup

  paintPanel(
    ctx,
    x - 12,
    y,
    barW + 24,
    32,
    windup ? 'rgba(253, 224, 71, 0.65)' : 'rgba(251, 113, 133, 0.55)',
    windup ? '#facc15' : '#fb7185',
  )
  ctx.textAlign = 'left'
  ctx.font = `800 11px ${FONT}`
  ctx.fillStyle = windup ? '#fef08a' : low ? '#fda4af' : '#fecdd3'
  const label = boss.name || 'BOSS'
  ctx.fillText(windup ? `${label} · !` : label, x, y + 14)
  const labelW = Math.min(128, ctx.measureText(windup ? `${label} · !` : label).width + 8)
  const innerX = x + labelW
  const innerW = barW - labelW
  drawBar(ctx, innerX, y + 10, innerW, barH, ratio, windup ? '#facc15' : low ? '#fb7185' : '#f43f5e')
  ctx.textAlign = 'center'
  ctx.font = `700 11px ${FONT}`
  ctx.fillStyle = '#f3ead8'
  ctx.fillText(`${Math.max(0, Math.ceil(boss.hp))}/${boss.maxHp}`, innerX + innerW / 2, y + 20)
  ctx.textAlign = 'left'
}

function drawRailChrome(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  if (snap.scene !== 'play' && snap.scene !== 'pick') return
  if (snap.beatMute) return
  const rail = highwayLayout(w, h)
  drawCombo(ctx, rail, snap)
  drawAutoHint(ctx, rail, snap)
}

function drawCombo(
  ctx: CanvasRenderingContext2D,
  rail: ReturnType<typeof highwayLayout>,
  snap: FrameSnapshot,
) {
  if (snap.combo <= 0 && snap.comboBreak <= 0.04) return
  const cx = rail.x0 - 14
  const cy = rail.judgeY - 6
  const punch = snap.comboFlash
  const brk = snap.comboBreak
  const scale = 1 + punch * 0.42 + brk * 0.12
  const shown = snap.combo > 0 ? snap.combo : 0
  const fill =
    brk > 0.08
      ? '#fb7185'
      : snap.combo >= 50
        ? '#fde047'
        : snap.combo >= 25
          ? '#fcd34d'
          : '#fef3c7'

  ctx.save()
  ctx.textAlign = 'right'
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.font = `800 36px ${FONT}`
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(11, 15, 20, 0.62)'
  ctx.strokeText(`${shown}`, 0, 0)
  ctx.globalAlpha = snap.combo <= 0 ? brk : 1
  ctx.fillStyle = fill
  ctx.fillText(`${shown}`, 0, 0)
  ctx.restore()

  ctx.textAlign = 'right'
  ctx.font = `700 11px ${FONT}`
  ctx.fillStyle = brk > 0.08 ? '#fda4af' : '#fcd34d'
  ctx.fillText(brk > 0.25 && snap.combo <= 0 ? 'BREAK' : 'COMBO', cx, cy + 16)
  if (snap.combo > 0) {
    ctx.fillStyle = '#fde68a'
    ctx.font = `700 11px ${FONT}`
    ctx.fillText(`×${snap.comboMul.toFixed(2)}`, cx, cy + 30)
  }
  if (snap.maxCombo > snap.combo && snap.combo > 0) {
    ctx.fillStyle = '#b8a894'
    ctx.font = `10px ${FONT}`
    ctx.fillText(`BEST ${snap.maxCombo}`, cx, cy + 44)
  }

  if (snap.comboMilestone) {
    const a = 0.35 + 0.65 * snap.comboFlash
    ctx.font = `800 18px ${FONT}`
    ctx.fillStyle = `rgba(253, 224, 71, ${a})`
    ctx.fillText(`${snap.comboMilestone} COMBO`, cx, cy - 28)
  }
  ctx.textAlign = 'left'
}

function drawAutoHint(
  ctx: CanvasRenderingContext2D,
  rail: ReturnType<typeof highwayLayout>,
  snap: FrameSnapshot,
) {
  const x = rail.x0 + rail.panelW + 14
  const y = rail.judgeY
  ctx.textAlign = 'left'

  if (snap.feverActive) {
    const ending = snap.feverRemain <= FEVER_END_WARN_SEC
    const blink = 0.55 + 0.45 * Math.sin(performance.now() * (ending ? 0.022 : 0.008))
    ctx.font = `800 16px ${FONT}`
    ctx.fillStyle = ending
      ? `rgba(254, 243, 199, ${blink})`
      : `rgba(253, 224, 71, ${0.75 + 0.2 * blink})`
    ctx.fillText('AUTO', x, y - 8)
    ctx.font = `700 12px ${FONT}`
    ctx.fillStyle = ending ? '#fde68a' : '#fef9c3'
    ctx.fillText(ending ? '即将结束' : 'Perfect', x, y + 10)
    ctx.textAlign = 'left'
    return
  }

  const pulse = snap.highway.judgePulse
  const jr = snap.highway.judgeResult ?? snap.beatFlash
  let line = 0
  if (pulse > 0.08 && jr) {
    const label = jr.toUpperCase()
    ctx.font = `800 15px ${FONT}`
    ctx.fillStyle =
      jr === 'miss' ? '#fb7185' : jr === 'perfect' ? '#fde047' : '#e8a04a'
    ctx.globalAlpha = 0.45 + 0.55 * pulse
    ctx.fillText(label, x, y - 8)
    ctx.globalAlpha = 1
    line = 18
  }
  if (snap.timingHint) {
    ctx.font = `800 16px ${FONT}`
    ctx.fillStyle = snap.timingHint === 'early' ? '#c9a882' : '#fb923c'
    ctx.fillText(snap.timingHint.toUpperCase(), x, y + line)
  }
  ctx.textAlign = 'left'
}

function drawFeverFlash(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: FrameSnapshot,
) {
  if (snap.feverActive) {
    const ending = snap.feverRemain <= FEVER_END_WARN_SEC
    const beat = 0.5 + 0.5 * Math.sin(snap.beatPhase * Math.PI * 2)
    const warn = ending
      ? 0.5 + 0.5 * Math.sin(performance.now() * 0.022)
      : 0
    const burst = snap.feverFlash
    const intensity = Math.min(
      1,
      0.28 + 0.22 * beat + 0.45 * burst + (ending ? 0.2 + 0.4 * warn : 0),
    )
    const rgb: [number, number, number] = ending ? [251, 191, 36] : [253, 224, 71]
    const thick = 56 + 36 * burst + (ending ? 18 * warn : 0)
    drawEdgeGlow(ctx, w, h, rgb, intensity, thick)
    drawFeverSparks(ctx, w, h, ending ? 1.4 : 0.7 + burst)
    drawCornerFlares(ctx, w, h, rgb, intensity)

    if (burst > 0.35) {
      ctx.textAlign = 'center'
      ctx.font = `800 42px ${FONT}`
      ctx.fillStyle = `rgba(254, 243, 199, ${0.45 + 0.5 * burst})`
      ctx.fillText('FEVER', w / 2, h * 0.58)
      ctx.textAlign = 'left'
    }

    if (ending) {
      ctx.textAlign = 'center'
      ctx.font = `800 22px ${FONT}`
      ctx.fillStyle = `rgba(254, 243, 199, ${0.55 + 0.45 * warn})`
      ctx.fillText(`FEVER  ${snap.feverRemain.toFixed(1)}`, w / 2, h * 0.58)
      ctx.font = `700 13px ${FONT}`
      ctx.fillStyle = `rgba(253, 224, 71, ${0.5 + 0.4 * warn})`
      ctx.fillText('即将结束', w / 2, h * 0.58 + 22)
      ctx.textAlign = 'left'
    }
    return
  }

  if (snap.feverFlash <= 0.05) return
  drawEdgeGlow(
    ctx,
    w,
    h,
    [253, 224, 71],
    0.35 + 0.55 * snap.feverFlash,
    70 + 40 * snap.feverFlash,
  )
  drawFeverSparks(ctx, w, h, 1.2 + snap.feverFlash)
  drawCornerFlares(ctx, w, h, [253, 224, 71], 0.4 + 0.6 * snap.feverFlash)
  if (snap.feverFlash <= 0.35) return
  ctx.textAlign = 'center'
  ctx.font = `800 42px ${FONT}`
  ctx.fillStyle = `rgba(254, 243, 199, ${0.55 + 0.45 * snap.feverFlash})`
  ctx.fillText('FEVER', w / 2, h * 0.58)
  ctx.textAlign = 'left'
}

/** Edge band + glowing frame. Center stays clear. */
function drawEdgeGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rgb: [number, number, number],
  intensity: number,
  thickness: number,
) {
  const a = Math.max(0, Math.min(1, intensity))
  if (a < 0.02) return
  const [r, g, b] = rgb
  const t = Math.max(24, thickness)
  const inset = 7

  const band = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
    const grad = ctx.createLinearGradient(x0, y0, x1, y1)
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`)
    grad.addColorStop(0.45, `rgba(${r},${g},${b},${a * 0.45})`)
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`)
    ctx.fillStyle = grad
    ctx.fillRect(rx, ry, rw, rh)
  }
  band(0, 0, 0, t, 0, 0, w, t)
  band(0, h, 0, h - t, 0, h - t, w, t)
  band(0, 0, t, 0, 0, 0, t, h)
  band(w, 0, w - t, 0, w - t, 0, t, h)

  ctx.save()
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.4 + 0.55 * a})`
  ctx.lineWidth = 2.5 + 6 * a
  ctx.shadowColor = `rgba(${r},${g},${b},${0.75 * a})`
  ctx.shadowBlur = 16 + 28 * a
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2)
  ctx.strokeStyle = `rgba(254, 243, 199, ${0.18 + 0.35 * a})`
  ctx.lineWidth = 1
  ctx.shadowBlur = 8 + 12 * a
  ctx.strokeRect(inset + 5, inset, w - inset * 2 - 10, h - inset * 2)
  ctx.restore()
}

function drawFeverSparks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rate: number,
) {
  const now = performance.now()
  const dt = Math.min(0.05, (now - hudFxT) / 1000)
  hudFxT = now
  const want = Math.min(48, Math.floor(10 + rate * 18))
  while (feverSparks.length < want) spawnFeverSpark()
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = feverSparks.length - 1; i >= 0; i--) {
    const s = feverSparks[i]!
    s.life -= dt
    s.u += s.speed * dt
    if (s.u < 0) s.u += 1
    if (s.u > 1) s.u -= 1
    if (s.life <= 0) {
      feverSparks.splice(i, 1)
      continue
    }
    const p = edgePoint(s.edge, s.u, w, h, 10)
    const u = s.life / s.max
    const r = s.size * (0.5 + u)
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4)
    g.addColorStop(0, `rgba(254, 243, 199, ${0.85 * u})`)
    g.addColorStop(0.4, `rgba(253, 224, 71, ${0.45 * u})`)
    g.addColorStop(1, 'rgba(253, 224, 71, 0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawCornerFlares(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rgb: [number, number, number],
  intensity: number,
) {
  const a = Math.max(0, Math.min(1, intensity))
  if (a < 0.04) return
  const [r, g, b] = rgb
  const pad = 18
  const len = 28 + 36 * a
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.35 + 0.5 * a})`
  ctx.lineWidth = 2 + 3 * a
  ctx.shadowColor = `rgba(${r},${g},${b},${0.7 * a})`
  ctx.shadowBlur = 12 + 16 * a
  const corners: [number, number, number, number][] = [
    [pad, pad, 1, 1],
    [w - pad, pad, -1, 1],
    [pad, h - pad, 1, -1],
    [w - pad, h - pad, -1, -1],
  ]
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath()
    ctx.moveTo(x, y + sy * len)
    ctx.lineTo(x, y)
    ctx.lineTo(x + sx * len, y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawLevelUp(ctx: CanvasRenderingContext2D, w: number, h: number, snap: FrameSnapshot) {
  if (!snap.levelFlash) return
  ctx.font = `800 28px ${FONT}`
  ctx.textAlign = 'center'
  ctx.lineWidth = 6
  ctx.strokeStyle = 'rgba(26, 16, 8, 0.55)'
  ctx.strokeText('LEVEL UP', w / 2, h * 0.58)
  ctx.fillStyle = '#fde68a'
  ctx.fillText('LEVEL UP', w / 2, h * 0.58)
  ctx.textAlign = 'left'
}

function drawHint(ctx: CanvasRenderingContext2D, w: number, h: number, hint: string) {
  if (!hint) return
  ctx.font = `700 13px ${FONT}`
  const tw = Math.min(w - 48, ctx.measureText(hint).width + 28)
  const ph = 28
  const x = (w - tw) / 2
  const y = h - 38
  ctx.fillStyle = 'rgba(22, 14, 10, 0.86)'
  ctx.strokeStyle = 'rgba(232, 160, 74, 0.4)'
  ctx.lineWidth = 1
  roundRect(ctx, x, y, tw, ph, 14)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f3ead8'
  ctx.textAlign = 'center'
  ctx.fillText(hint, w / 2, y + 19)
  ctx.textAlign = 'left'
}

function drawHp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  maxW: number,
  h: number,
  hp: number,
  maxHp: number,
  hurt: boolean,
) {
  const fill = hurt ? '#fb7185' : '#f43f5e'
  if (maxHp > 10) {
    const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0
    drawBar(ctx, x, y + 2, maxW, h, ratio, fill)
    return
  }
  const gap = 3
  const pipW = Math.min(14, (maxW - (maxHp - 1) * gap) / Math.max(1, maxHp))
  for (let i = 0; i < maxHp; i++) {
    const px = x + i * (pipW + gap)
    const full = hp >= i + 1
    const partial = hp > i && hp < i + 1
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    roundRect(ctx, px, y, pipW, h, 3)
    ctx.fill()
    if (full || partial) {
      ctx.fillStyle = fill
      roundRect(ctx, px, y, full ? pipW : pipW * (hp - i), h, 3)
      ctx.fill()
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1
    roundRect(ctx, px, y, pipW, h, 3)
    ctx.stroke()
  }
}

function drawBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  glow = false,
) {
  const r = Math.min(h / 2, 5)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  roundRect(ctx, x, y, w, h, r)
  ctx.fill()
  const rw = w * Math.max(0, Math.min(1, ratio))
  if (rw > 0.5) {
    if (glow) {
      ctx.shadowColor = fill
      ctx.shadowBlur = 10
    }
    ctx.fillStyle = fill
    roundRect(ctx, x, y, rw, h, r)
    ctx.fill()
    ctx.shadowBlur = 0
  }
  ctx.strokeStyle = glow ? fill : 'rgba(255, 255, 255, 0.16)'
  ctx.globalAlpha = glow ? 0.55 : 1
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()
  ctx.globalAlpha = 1
}

function drawMiniPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  fg: string,
): number {
  ctx.font = `700 10px ${FONT}`
  const tw = ctx.measureText(text).width + 12
  const ph = 16
  ctx.fillStyle = fill
  roundRect(ctx, x, y, tw, ph, 8)
  ctx.fill()
  ctx.strokeStyle = fg
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 1
  roundRect(ctx, x, y, tw, ph, 8)
  ctx.stroke()
  ctx.globalAlpha = 1
  ctx.fillStyle = fg
  ctx.textAlign = 'left'
  ctx.fillText(text, x + 6, y + 12)
  return tw
}

function drawLabel(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string) {
  ctx.textAlign = 'left'
  ctx.font = `700 10px ${FONT}`
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

function drawTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  stroke: string,
  fill: string,
): number {
  ctx.font = `700 10px ${FONT}`
  const tw = ctx.measureText(label).width + 14
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  roundRect(ctx, x, y - 12, tw, 16, 8)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = stroke
  ctx.textAlign = 'center'
  ctx.fillText(label, x + tw / 2, y)
  ctx.textAlign = 'left'
  return x + tw + 6
}

function paintPanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke = 'rgba(232, 160, 74, 0.28)',
  accent = '#e8a04a',
) {
  ctx.fillStyle = 'rgba(22, 14, 10, 0.78)'
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  roundRect(ctx, x, y, w, h, 10)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = accent
  ctx.fillRect(x, y + 10, 3, Math.max(8, h - 20))
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

import { drawHighway, paintHudLayer } from './hud2d'
import { drawDamageFloaters } from './damageFloaters'
import { drawOffscreenTrackers } from './offscreenTrack'
import type { FrameSnapshot, Renderer } from './types'
import { PLAY_VIEW_HALF } from '../../domain/combat/arena'

/** Legacy / fallback flat renderer. Prefer `createThreeOrthoRenderer`. */
export function createCanvasRenderer(host: HTMLElement): Renderer {
  host.innerHTML = ''
  host.style.position = 'relative'
  host.style.width = '100%'
  host.style.height = '100%'
  const canvas = document.createElement('canvas')
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  host.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = window.innerWidth
    const h = window.innerHeight
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  const worldToScreen = (
    x: number,
    z: number,
    half: number,
    cssW: number,
    cssH: number,
    ox = 0,
    oz = 0,
  ) => {
    const view = Math.min(PLAY_VIEW_HALF, half)
    const size = Math.min(cssW, cssH) * 0.98
    const scale = size / (view * 2)
    return {
      sx: cssW / 2 + (x - ox) * scale,
      sy: cssH / 2 + (z - oz) * scale,
      scale,
    }
  }

  const draw = (snap: FrameSnapshot) => {
    const cssW = window.innerWidth
    const cssH = window.innerHeight
    ctx.clearRect(0, 0, cssW, cssH)

    const g = ctx.createRadialGradient(
      cssW / 2,
      cssH / 2,
      40,
      cssW / 2,
      cssH / 2,
      Math.max(cssW, cssH) * 0.7,
    )
    g.addColorStop(0, '#3a2418')
    g.addColorStop(1, '#140e0a')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, cssW, cssH)

    if (snap.scene === 'play' || snap.scene === 'pick') {
      const half = snap.arenaHalf
      const ox = snap.player.x
      const oz = snap.player.z
      const toS = (x: number, z: number) => worldToScreen(x, z, half, cssW, cssH, ox, oz)
      const { scale } = toS(0, 0)
      const arenaTl = toS(-half, -half)
      const side = half * 2 * scale
      ctx.strokeStyle = 'rgba(180, 110, 48, 0.4)'
      ctx.lineWidth = 2
      ctx.strokeRect(arenaTl.sx, arenaTl.sy, side, side)
      ctx.fillStyle = 'rgba(72, 44, 22, 0.38)'
      ctx.fillRect(arenaTl.sx, arenaTl.sy, side, side)
      // Lightweight tile grid (2d fallback)
      const tiles = 12
      const step = side / tiles
      ctx.save()
      ctx.beginPath()
      ctx.rect(arenaTl.sx, arenaTl.sy, side, side)
      ctx.clip()
      ctx.strokeStyle = 'rgba(160, 100, 48, 0.16)'
      ctx.lineWidth = 1
      for (let i = 1; i < tiles; i++) {
        const o = i * step
        ctx.beginPath()
        ctx.moveTo(arenaTl.sx + o, arenaTl.sy)
        ctx.lineTo(arenaTl.sx + o, arenaTl.sy + side)
        ctx.moveTo(arenaTl.sx, arenaTl.sy + o)
        ctx.lineTo(arenaTl.sx + side, arenaTl.sy + o)
        ctx.stroke()
      }
      ctx.restore()

      if (snap.aura) {
        const p = toS(snap.player.x, snap.player.z)
        const pr = snap.aura.radius * p.scale
        const pulse = snap.aura.pulse
        ctx.beginPath()
        ctx.fillStyle = `rgba(14, 165, 233, ${0.12 + 0.2 * pulse})`
        ctx.arc(p.sx, p.sy, pr, 0, Math.PI * 2)
        ctx.fill()
        ctx.beginPath()
        ctx.strokeStyle = `rgba(125, 211, 252, ${0.4 + 0.5 * pulse})`
        ctx.lineWidth = 3 + 5 * pulse
        ctx.arc(p.sx, p.sy, pr, 0, Math.PI * 2)
        ctx.stroke()
        ctx.beginPath()
        ctx.strokeStyle = `rgba(224, 242, 254, ${0.2 + 0.35 * pulse})`
        ctx.lineWidth = 2
        ctx.arc(p.sx, p.sy, pr * (0.62 + 0.12 * pulse), 0, Math.PI * 2)
        ctx.stroke()
      }

      if (snap.orbit) {
        for (const b of snap.orbit.blades) {
          const s = toS(b.x, b.z)
          ctx.beginPath()
          ctx.fillStyle = `rgba(251, 191, 36, ${0.7 + 0.3 * snap.orbit.pulse})`
          ctx.arc(s.sx, s.sy, 5 + 3 * snap.orbit.pulse, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      for (const c of snap.chains) {
        const a = toS(c.ax, c.az)
        const b = toS(c.bx, c.bz)
        const dx = b.sx - a.sx
        const dy = b.sy - a.sy
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.45 + 0.45 * c.lifeRatio})`
        ctx.lineWidth = 6
        ctx.beginPath()
        ctx.moveTo(a.sx, a.sy)
        const segs = 5
        for (let i = 1; i <= segs; i++) {
          const u = i / segs
          const jig = i === segs ? 0 : (i % 2 === 0 ? 1 : -1) * 7 * c.lifeRatio
          const px = -dy
          const py = dx
          const plen = Math.hypot(px, py) || 1
          ctx.lineTo(a.sx + dx * u + (px / plen) * jig, a.sy + dy * u + (py / plen) * jig)
        }
        ctx.stroke()
        ctx.strokeStyle = `rgba(240, 249, 255, ${0.55 + 0.4 * c.lifeRatio})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      for (const b of snap.bullets) {
        const p = toS(b.x, b.z)
        const r = Math.max(2, b.r * p.scale)
        if (b.friendly) {
          ctx.beginPath()
          ctx.fillStyle = 'rgba(249, 115, 22, 0.32)'
          ctx.arc(p.sx, p.sy, r * 3.1, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.beginPath()
        ctx.fillStyle = b.friendly ? '#fb923c' : '#ff6b6b'
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const o of snap.obstacles) {
        const p = toS(o.x, o.z)
        const hw = (o.w * p.scale) / 2
        const hd = (o.d * p.scale) / 2
        if (o.kind === 'pillar') {
          ctx.beginPath()
          ctx.fillStyle = '#3d5a7a'
          ctx.ellipse(p.sx, p.sy, hw * 0.85, hd * 0.85, 0, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.strokeStyle = '#5b7a9a'
          ctx.lineWidth = 1.5
          ctx.ellipse(p.sx, p.sy, hw * 0.55, hd * 0.55, 0, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#2a3f5c'
          ctx.fillRect(p.sx - hw, p.sy - hd, hw * 2, hd * 2)
          ctx.strokeStyle = '#1e2d42'
          ctx.lineWidth = 1
          ctx.strokeRect(p.sx - hw * 0.7, p.sy - hd * 0.55, hw * 1.4, hd * 1.1)
        }
      }

      for (const pk of snap.pickups) {
        const p = toS(pk.x, pk.z)
        const r =
          pk.kind === 'relic_major' ? 9 : pk.kind === 'relic_minor' ? 7 : pk.kind === 'xp' ? 5.5 : 5
        ctx.beginPath()
        if (pk.kind === 'gold') {
          ctx.fillStyle = '#fde047'
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
          ctx.fill()
          ctx.strokeStyle = '#f59e0b'
          ctx.lineWidth = 1.5
          ctx.stroke()
        } else if (pk.kind === 'xp') {
          ctx.fillStyle = '#67e8f9'
          ctx.moveTo(p.sx, p.sy - r)
          ctx.lineTo(p.sx + r * 0.7, p.sy)
          ctx.lineTo(p.sx, p.sy + r)
          ctx.lineTo(p.sx - r * 0.7, p.sy)
          ctx.closePath()
          ctx.fill()
          ctx.strokeStyle = '#06b6d4'
          ctx.lineWidth = 1.2
          ctx.stroke()
        } else {
          ctx.fillStyle = pk.kind === 'relic_major' ? '#f472b6' : '#a78bfa'
          ctx.moveTo(p.sx, p.sy - r)
          ctx.lineTo(p.sx + r * 0.75, p.sy)
          ctx.lineTo(p.sx, p.sy + r)
          ctx.lineTo(p.sx - r * 0.75, p.sy)
          ctx.closePath()
          ctx.fill()
        }
      }

      for (const e of snap.enemies) {
        const p = toS(e.x, e.z)
        const flash = e.hurtFlash
        const punch = 1 + 0.45 * flash
        const r = e.r * p.scale * punch
        ctx.beginPath()
        ctx.fillStyle =
          flash > 0.15
            ? `rgba(255,241,242,${0.75 + 0.25 * flash})`
            : e.frozen
              ? '#7dd3fc'
              : e.bleed
                ? '#fb7185'
                : e.amped
                  ? '#facc15'
                  : e.broken
                    ? '#94a3b8'
                    : e.weak
                      ? '#a8a29e'
                      : e.kind === 'boss'
              ? '#ef4444'
              : e.kind === 'elite'
                ? '#fbbf24'
                : e.kind === 'chest'
                  ? '#f59e0b'
                : e.kind === 'spitter'
                  ? '#4ade80'
                  : e.kind === 'frost'
                    ? '#7dd3fc'
                    : e.kind === 'leech'
                      ? '#be123c'
                      : e.kind === 'shooter'
                        ? '#c084fc'
                        : e.kind === 'brute'
                          ? '#9f1239'
                          : '#f97316'
        if (e.kind === 'shooter') {
          ctx.moveTo(p.sx, p.sy - r)
          ctx.lineTo(p.sx + r * 0.9, p.sy + r * 0.6)
          ctx.lineTo(p.sx - r * 0.9, p.sy + r * 0.6)
          ctx.closePath()
        } else if (e.kind === 'brute' || e.kind === 'boss' || e.kind === 'chest') {
          ctx.rect(p.sx - r, p.sy - r * 0.85, r * 2, r * 1.7)
        } else {
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2)
        }
        ctx.fill()
        if (e.kind === 'elite' || e.kind === 'boss' || e.kind === 'chest') {
          ctx.beginPath()
          ctx.strokeStyle =
            flash > 0.15
              ? '#fff'
              : e.kind === 'boss'
                ? '#fecaca'
                : e.kind === 'chest'
                  ? '#fde68a'
                  : '#fef3c7'
          ctx.lineWidth = 2
          ctx.arc(p.sx, p.sy, r * 1.15, 0, Math.PI * 2)
          ctx.stroke()
        }
      }

      {
        const p = toS(snap.player.x, snap.player.z)
        const hurt = snap.player.hurtFlash
        const shakeX = hurt > 0 ? (Math.random() - 0.5) * hurt * 10 : 0
        const shakeY = hurt > 0 ? (Math.random() - 0.5) * hurt * 10 : 0
        ctx.beginPath()
        ctx.fillStyle =
          hurt > 0.2
            ? `rgba(251,113,133,${0.55 + 0.35 * hurt})`
            : snap.player.invuln > 0
              ? 'rgba(243,234,216,0.55)'
              : '#d4a06a'
        ctx.arc(p.sx + shakeX, p.sy + shakeY, snap.player.r * p.scale, 0, Math.PI * 2)
        ctx.fill()
      }

      drawDamageFloaters(ctx, snap.floaters, (x, z) => toS(x, z))
    }

    paintHudLayer(ctx, cssW, cssH, snap)
    if (snap.scene === 'play' || snap.scene === 'pick') {
      const ox = snap.player.x
      const oz = snap.player.z
      drawOffscreenTrackers(ctx, cssW, cssH, snap, (x, z) =>
        worldToScreen(x, z, snap.arenaHalf, cssW, cssH, ox, oz),
      )
    }
    if (snap.scene === 'play' && snap.highway.visible) {
      drawHighway(ctx, cssW, cssH, snap)
    }
  }

  return { resize, draw }
}

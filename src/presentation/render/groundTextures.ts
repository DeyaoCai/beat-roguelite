import * as THREE from 'three'

const TILE_WORLD = 2.4

function hash2(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return n - Math.floor(n)
}

function paintArenaAlbedo(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size)
  const d = img.data
  const cells = 8
  const cell = size / cells

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell)
      const cy = Math.floor(y / cell)
      const lx = x - cx * cell
      const ly = y - cy * cell
      const edge = Math.min(lx, ly, cell - lx, cell - ly)
      const crack = edge < cell * 0.045

      const n = hash2(cx * 1.7 + x * 0.02, cy * 2.3 + y * 0.02)
      const n2 = hash2(x * 0.11, y * 0.13)
      const tint = (cx + cy) % 2 === 0 ? 0 : -8

      let r: number
      let g: number
      let b: number
      if (crack) {
        r = 42 + n2 * 10
        g = 28 + n2 * 8
        b = 18 + n2 * 6
      } else {
        r = 92 + n * 28 + tint + n2 * 12
        g = 62 + n * 16 + tint * 0.6 + n2 * 8
        b = 36 + n * 10 + tint * 0.3 + n2 * 6
        if (n2 > 0.82) {
          r *= 0.78
          g *= 0.8
          b *= 0.72
        }
      }

      const rust =
        Math.abs((x + y * 0.35) % (cell * 2) - cell) < 1.2 && n > 0.55
      if (rust && !crack) {
        r = Math.min(255, r + 36)
        g = Math.min(255, g + 8)
        b = Math.min(255, b - 4)
      }

      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  ctx.fillStyle = 'rgba(180, 110, 48, 0.28)'
  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      const ox = cx * cell
      const oy = cy * cell
      const inset = cell * 0.12
      for (const [px, py] of [
        [ox + inset, oy + inset],
        [ox + cell - inset, oy + inset],
        [ox + inset, oy + cell - inset],
        [ox + cell - inset, oy + cell - inset],
      ] as const) {
        ctx.beginPath()
        ctx.arc(px, py, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }
}

function paintArenaRoughness(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size)
  const d = img.data
  const cells = 8
  const cell = size / cells
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const lx = x % cell
      const ly = y % cell
      const edge = Math.min(lx, ly, cell - lx, cell - ly)
      const crack = edge < cell * 0.045
      const n = hash2(x * 0.17, y * 0.19)
      const v = crack ? 210 + n * 30 : 150 + n * 70
      const i = (y * size + x) * 4
      d[i] = d[i + 1] = d[i + 2] = v
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function paintVoidAlbedo(ctx: CanvasRenderingContext2D, size: number): void {
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = hash2(x * 0.07, y * 0.09)
      const n2 = hash2(x * 0.31 + 3, y * 0.29)
      let r = 22 + n * 12
      let g = 14 + n * 8
      let b = 10 + n * 6
      if (n2 > 0.97) {
        r = 52 + n2 * 28
        g = 36 + n2 * 18
        b = 22 + n2 * 10
      }
      if (n2 > 0.992) {
        r = 180
        g = 120
        b = 58
      }
      const i = (y * size + x) * 4
      d[i] = r
      d[i + 1] = g
      d[i + 2] = b
      d[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

function canvasTex(
  paint: (ctx: CanvasRenderingContext2D, size: number) => void,
  size = 512,
  srgb = true,
): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  paint(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

export type GroundMaps = {
  arenaMap: THREE.CanvasTexture
  arenaRough: THREE.CanvasTexture
  voidMap: THREE.CanvasTexture
}

/** Procedural cracked ochre arena + dusty dusk surrounds. */
export function createGroundMaps(): GroundMaps {
  return {
    arenaMap: canvasTex(paintArenaAlbedo, 512, true),
    arenaRough: canvasTex(paintArenaRoughness, 512, false),
    voidMap: canvasTex(paintVoidAlbedo, 512, true),
  }
}

/** Keep texel density stable when the floor plane is rescaled. */
export function setGroundRepeat(
  maps: GroundMaps,
  worldW: number,
  worldD: number,
  kind: 'arena' | 'void',
): void {
  const tile = kind === 'arena' ? TILE_WORLD : TILE_WORLD * 1.6
  const rx = Math.max(1, worldW / tile)
  const ry = Math.max(1, worldD / tile)
  if (kind === 'arena') {
    maps.arenaMap.repeat.set(rx, ry)
    maps.arenaRough.repeat.set(rx, ry)
  } else {
    maps.voidMap.repeat.set(rx, ry)
  }
}

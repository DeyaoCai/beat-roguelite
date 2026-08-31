/** UE DataTable field names often look like `Texture_d_10_<32hex>`. */

const GUID_SUFFIX = /^(.*)_\d+_([0-9A-Fa-f]{32})$/

export function shortFieldName(key: string): string {
  const m = key.match(GUID_SUFFIX)
  return m?.[1] ?? key
}

export function normalizeFields(fields: Record<string, unknown> | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!fields) return out
  for (const [key, value] of Object.entries(fields)) {
    const short = shortFieldName(key)
    if (!(short in out)) out[short] = value
  }
  return out
}

export function field(fields: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (fields[name] != null && fields[name] !== '') return fields[name]
    const hit = Object.entries(fields).find(([k]) => k.toLowerCase() === name.toLowerCase())
    if (hit && hit[1] != null && hit[1] !== '') return hit[1]
  }
  return undefined
}

export function fieldString(fields: Record<string, unknown>, ...names: string[]): string | null {
  const v = field(fields, ...names)
  if (v == null) return null
  if (typeof v === 'string') {
    const s = stripEnum(v).trim()
    return s && s !== 'None' ? s : null
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return null
}

export function stripEnum(raw: string): string {
  const t = raw.replace(/\s*\([^)]*Property\)\s*$/i, '').trim()
  const sep = Math.max(t.lastIndexOf(':'), t.lastIndexOf('.'))
  const inner = t.match(/'([^']+)'/)
  if (inner?.[1] && /Property/i.test(t)) return t
  return sep >= 0 && !t.includes('/') ? t.slice(sep + 1) : t
}

/**
 * UE object dump → web path under the TKA figure pack `models/`.
 * `Texture2D'TheKillingAntidote/Content/Mod/HMs_LushesLipsP/Lips/DLipsP_01.DLipsP_01'`
 */
export function mapUeAssetPath(raw: unknown, ext: string, fallbackMod: string): string | null {
  const s = stringifyPath(raw)
  if (!s) return null
  let n = s.replace(/\\/g, '/')
  const marker = '/Content/Mod/'
  const i = n.toLowerCase().indexOf(marker.toLowerCase())
  if (i >= 0) n = n.slice(i + marker.length)
  n = n.replace(/^TheKillingAntidote\//i, '')
  const lastSlash = n.lastIndexOf('/')
  const lastDot = n.lastIndexOf('.')
  if (lastDot > lastSlash) n = n.slice(0, lastDot)
  const mod = n.split('/')[0] || fallbackMod
  if (!n.toLowerCase().startsWith(`${mod.toLowerCase()}/`) && n.toLowerCase() !== mod.toLowerCase()) {
    n = `${fallbackMod}/${n.split('/').pop() ?? n}`
  }
  const e = ext.startsWith('.') ? ext : `.${ext}`
  return n + e
}

function stringifyPath(raw: unknown): string | null {
  if (raw == null) return null
  if (typeof raw === 'string') {
    const quoted = raw.match(/'([^']+)'/)
    return quoted?.[1] ?? raw.replace(/\s*\([^)]*Property\)\s*$/i, '').trim()
  }
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as { AssetPathName?: unknown; ObjectPath?: unknown; ObjectName?: unknown }
    if (o.ObjectPath != null) return stringifyPath(o.ObjectPath)
    if (o.AssetPathName != null) return stringifyPath(o.AssetPathName)
    if (o.ObjectName != null) return stringifyPath(o.ObjectName)
  }
  return String(raw)
}

export function flattenRect(v: unknown): number[] | Record<string, number> | null {
  if (v == null) return null
  if (Array.isArray(v) && v.length === 0) return null
  if (Array.isArray(v) && v.length === 1 && (Array.isArray(v[0]) || (v[0] && typeof v[0] === 'object'))) {
    return flattenRect(v[0])
  }
  if (Array.isArray(v) && v.every((n) => typeof n === 'number')) return v as number[]
  if (typeof v === 'object') return v as Record<string, number>
  return null
}

/** UE LinearColor / FLinearColor dump → RGB multiply + A = emissive intensity (may be >1). */
export function flattenColor(v: unknown): { r: number; g: number; b: number; a: number } | null {
  if (v == null) return null
  if (Array.isArray(v)) {
    if (v.length === 1 && (Array.isArray(v[0]) || (v[0] && typeof v[0] === 'object'))) {
      return flattenColor(v[0])
    }
    const nums = v.map((n) => Number(n))
    if (nums.length >= 3 && nums.slice(0, 3).every(Number.isFinite)) {
      const a = nums.length >= 4 && Number.isFinite(nums[3]!) ? nums[3]! : 1
      return { r: nums[0]!, g: nums[1]!, b: nums[2]!, a }
    }
    return null
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const r = Number(o.R ?? o.r ?? o.X ?? o.x)
    const g = Number(o.G ?? o.g ?? o.Y ?? o.y)
    const b = Number(o.B ?? o.b ?? o.Z ?? o.z)
    const aRaw = o.A ?? o.a ?? o.W ?? o.w
    const a = aRaw == null ? 1 : Number(aRaw)
    if (![r, g, b].every(Number.isFinite)) return null
    return { r, g, b, a: Number.isFinite(a) ? a : 1 }
  }
  if (typeof v === 'string') {
    const hex = v.trim().match(/^#?([0-9a-f]{6})$/i)
    if (hex?.[1]) {
      const n = Number.parseInt(hex[1], 16)
      return {
        r: ((n >> 16) & 255) / 255,
        g: ((n >> 8) & 255) / 255,
        b: (n & 255) / 255,
        a: 1,
      }
    }
    const parts = [...v.matchAll(/([RGBA])\s*[=:]\s*([0-9.]+)/gi)]
    if (parts.length >= 3) {
      const map: Record<string, number> = {}
      for (const m of parts) map[m[1]!.toUpperCase()] = Number(m[2])
      if ([map.R, map.G, map.B].every(Number.isFinite)) {
        return { r: map.R!, g: map.G!, b: map.B!, a: Number.isFinite(map.A) ? map.A! : 1 }
      }
    }
  }
  return null
}

export function classifyTable(name: string): 'clothes' | 'skin' | 'hair' | 'eyes' | 'makeup' | 'anim' | 'meta' | 'other' {
  const n = name.replace(/\\/g, '/').split('/').pop() ?? name
  if (/Mod_ClothesTable/i.test(n) || n.toLowerCase() === 'clothes') return 'clothes'
  if (/Mod_SkinTable/i.test(n) || n.toLowerCase() === 'skin') return 'skin'
  if (/Mod_HairstyleTable/i.test(n) || n.toLowerCase() === 'hair') return 'hair'
  if (/Mod_EyesTable/i.test(n) || n.toLowerCase() === 'eyes') return 'eyes'
  if (/Mod_MakeupTable/i.test(n) || n.toLowerCase() === 'makeup') return 'makeup'
  if (/Mod_AnimationTable/i.test(n) || /AnimationTable/i.test(n) || n.toLowerCase() === 'anim') return 'anim'
  if (/TKA_Mod_Table/i.test(n) || n.toLowerCase() === 'meta') return 'meta'
  return 'other'
}

export function normalizeGroup(raw: string | null, modId: string): string {
  if (!raw || raw === 'None') return modId
  return raw
}

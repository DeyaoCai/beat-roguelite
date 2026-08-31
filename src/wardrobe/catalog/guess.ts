import { BODY_MESH, isClothesType, type ClothesTypeName } from './types'

export function looksLikeAnim(path: string): boolean {
  const n = path.replace(/\\/g, '/').toLowerCase()
  if (n.includes('/anim') || n.includes('/pose')) return true
  const file = n.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  if (file.startsWith('as_') || file.includes('_anim') || file.includes('montage')) return true
  return /(^|[^a-z])(idle|pose|walk|run|groove|dance|jiggle|anim)([^a-z]|$)/.test(file)
}

export function looksLikeLoopAnim(name: string): boolean {
  return /(^|[^a-z])(idle|wait|walk|run|sprint|loop|groove|dance|jiggle)([^a-z]|$)/i.test(name)
}

/** Montage + AnimSequence pair of the same clip (table points at Montage). */
export function animPoseFamily(url: string): string {
  return (url.replace(/\\/g, '/').split('/').pop() ?? url)
    .replace(/\.[^.]+$/, '')
    .replace(/_Montage\d*$/i, '')
    .toLowerCase()
}

export function preferMontageAnimUrls(urls: string[]): string[] {
  const byFamily = new Map<string, string>()
  for (const url of urls) {
    if (!url) continue
    const fam = animPoseFamily(url)
    const prev = byFamily.get(fam)
    if (!prev) {
      byFamily.set(fam, url)
      continue
    }
    const montage = /_Montage\d*(\.|$)/i.test(url)
    const prevMontage = /_Montage\d*(\.|$)/i.test(prev)
    if (montage && !prevMontage) byFamily.set(fam, url)
  }
  return [...byFamily.values()]
}

/** Official workshop tutorial packs / empty exclude dumps — not player wardrobe. */
export function isSamplePackId(id: string): boolean {
  const s = (id.replace(/\\/g, '/').split('/').pop() ?? id).toLowerCase()
  if (s === 'exclude') return true
  if (s.includes('clothessample') || s.includes('eyessample')) return true
  return false
}

/** WIP / labelled test clips. Do not use on clothes — many real items are named `*_Test`. */
export function isDevAnimLabel(id: string, caption: string, url: string): boolean {
  const blob = `${id} ${caption} ${url}`
  if (blob.includes('测试')) return true
  return /(?:^|[\s._-])test(?:[\s._-]|$)/i.test(blob)
}

export function isThumbAlbedo(map: string | null | undefined): boolean {
  const n = (map ?? '').replace(/\\/g, '/').toLowerCase()
  if (!n) return false
  return n.includes('/icons/') || n.includes('/thumbs/') || /(^|\/)icon[_-]/i.test(n)
}

export function isMakeupPath(path: string): boolean {
  const n = path.replace(/\\/g, '/').toLowerCase()
  if (n.includes('/lips/') || n.includes('/makeup/') || n.includes('lusheslips')) return true
  const file = n.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  return /(^|[^a-z])(lips?|dlips|lipstick|lipliner|eyeshadow|eyeliner|eyebrow)([^a-z]|$)/.test(file)
}

/** ShaderClothes damage / packed masks — not a wearable albedo. */
export function isAuxOrDamageTex(path: string): boolean {
  const n = path.replace(/\\/g, '/').toLowerCase()
  const file = n.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  if (file.endsWith('_n') || file.endsWith('_nrm') || file.includes('normal')) return true
  if (file.endsWith('_o') || file.endsWith('_orm') || file.endsWith('_s') || file.endsWith('_spec')) return true
  if (file.endsWith('_m') || file.includes('metal')) return true
  if (n.includes('/scars/') || file.includes('scar') || file.includes('damage') || file.includes('bodymask')) {
    return true
  }
  return false
}

/** PNG-only scan may emit a Skin row only when the file looks like a body albedo. */
export function isLikelySkinPng(path: string): boolean {
  if (isAuxOrDamageTex(path) || isMakeupPath(path) || isThumbAlbedo(path)) return false
  const n = path.replace(/\\/g, '/').toLowerCase()
  const file = n.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
  if (n.includes('/skin') || n.includes('/skins/')) return true
  if (/(^|[^a-z])(skin|body|nude|pale|tan)([^a-z]|$)/.test(file)) return true
  return false
}

function assetHint(mesh: string | null | undefined, id: string): string {
  const file = (mesh ?? '').replace(/\\/g, '/').split('/').pop() ?? ''
  const stem = file.replace(/\.[^.]+$/, '')
  const row = id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : id
  return `${stem} ${row}`.toLowerCase()
}

/** File stem + table row name. Ignore folder/mod ids (they often contain "Jodi"). */
export function looksLikeEyesAsset(mesh: string | null | undefined, id: string): boolean {
  const n = assetHint(mesh, id)
  return (
    /(^|[^a-z])(eye|eyes|iris|pupil|sclera|cornea|eyelid)([^a-z]|$)/.test(n) ||
    n.includes('eyelash') ||
    n.includes('eyelas') ||
    /(^|[^a-z])lash(es)?([^a-z]|$)/.test(n)
  )
}

/** Scan / filename → 美瞳 or 睫毛（不进衣服槽）。 */
export function guessEyesMakeupKind(
  mesh: string | null | undefined,
  id: string,
): 'Eye' | 'Eyelashes' | null {
  if (!looksLikeEyesAsset(mesh, id)) return null
  const n = assetHint(mesh, id)
  if (n.includes('eyelash') || n.includes('eyelas') || /(^|[^a-z])lash(es)?([^a-z]|$)/.test(n)) {
    return 'Eyelashes'
  }
  return 'Eye'
}

export function guessWebTypeName(
  mesh: string | null | undefined,
  id: string,
): ClothesTypeName | null {
  const path = (mesh ?? '').replace(/\\/g, '/').toLowerCase()
  const n = assetHint(mesh, id)
  if (looksLikeEyesAsset(mesh, id)) return null
  if (/(^|[^a-z])hair([^a-z]|$)/.test(n) || n.includes('scalp') || n.includes('hairstyle')) {
    return 'Hair'
  }
  if (/(^|[^a-z])ears?([^a-z]|$)/.test(n)) return 'Ears'
  if (n.includes('mask') || n.includes('visor') || /(^|[^a-z])face([^a-z]|$)/.test(n) || n.includes('glass')) {
    return 'Face'
  }
  if (n.includes('glove') || n.includes('claw') || n.includes('gauntlet')) return 'Gloves'
  if (n.includes('watch') || n.includes('wrist') || n.includes('bracelet')) return 'Wrist'
  if (n.includes('boot') || n.includes('shoe') || n.includes('heel') || n.includes('footwear')) return 'Shoes'
  if (n.includes('sock') || n.includes('stocking') || n.includes('tights')) return 'Socks'
  if (/(^|[^a-z])tail([^a-z]|$)/.test(n)) return 'Tail'
  if (n.includes('pouch') || n.includes('holster')) return 'Backpack'
  if (n.includes('neck') || n.includes('brecross') || n.includes('veil') || n.includes('belt')) return 'Neck'
  if (n.includes('skirt') || n.includes('_bot') || n.includes('bottom')) return 'Skirt'
  if (n.includes('bra') || n.includes('nipple')) return 'Bra'
  if (n.includes('brief') || n.includes('panty')) return 'Briefs'
  if (n.includes('bag') || n.includes('pack') || /(^|[^a-z])pod([^a-z]|$)/.test(n)) return 'Backpack'
  if (n.includes('dress') || n.includes('top') || n.includes('towel') || n.includes('bunny') || n.includes('lingerie')) {
    return 'Dress'
  }
  const file = (mesh ?? '').replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? ''
  const stem = file.replace(/\.[^.]+$/, '')
  if (
    path.includes('/user2/') ||
    file === 'user.glb' ||
    stem === 'female' ||
    stem === 'body' ||
    stem === 'skin' ||
    /(^|[^a-z])(skin|body)([^a-z]|$)/.test(n)
  ) {
    return 'Skin'
  }
  return 'Dress'
}

export function mapOfficialSlot(raw: string | null | undefined): ClothesTypeName | null {
  if (!raw) return null
  let t = raw.trim()
  const sep = Math.max(t.lastIndexOf(':'), t.lastIndexOf('.'))
  if (sep >= 0) t = t.slice(sep + 1)
  if (isClothesType(t)) return t
  switch (t.toLowerCase()) {
    case 'glasses':
    case 'mask':
    case 'headwear':
    case 'hat':
    case 'acc':
    case 'accessory':
      return 'Face'
    default:
      return null
  }
}

export function mapMakeupType(raw: string | null | undefined): import('./types').MakeupTypeName | null {
  if (!raw) return null
  const t = raw.trim()
  switch (t.toLowerCase()) {
    case 'lips':
    case 'lip':
    case 'lipstick':
      return 'Lips'
    case 'eyebrow':
    case 'brows':
    case 'brow':
      return 'Eyebrow'
    case 'eyeshadow':
    case 'shadow':
      return 'Eyeshadow'
    case 'eyeliner':
    case 'liner':
      return 'Eyeliner'
    case 'cheeks':
    case 'cheek':
    case 'blush':
      return 'Cheeks'
    case 'nose':
      return 'Nose'
    case 'nails':
    case 'nail':
      return 'Nails'
    case 'tattoo':
      return 'Tattoo'
    case 'eye':
    case 'eyes':
    case 'iris':
    case 'lens':
      return 'Eye'
    case 'eyelashes':
    case 'eyelash':
    case 'lashes':
    case 'lash':
      return 'Eyelashes'
    default:
      return null
  }
}

export function mapEyesType(raw: string | null | undefined): 'Eye' | 'Eyelashes' | null {
  const t = mapMakeupType(raw)
  if (t === 'Eye' || t === 'Eyelashes') return t
  return null
}

/** Glasses lens material names (`lens`, `lensColorable`). */
export function looksLikeLensPart(name: string): boolean {
  const n = name.toLowerCase()
  return n.includes('lens') || /(^|[^a-z])glass([^a-z]|$)/.test(n)
}

/** Short UI label for a glTF material slot. Collisions are disambiguated by the caller. */
export function dyePartLabel(name: string): string {
  const n = name.toLowerCase()
  if (looksLikeLensPart(name)) return '镜片'
  if (n.includes('pad')) return '鼻托'
  if (n.includes('metal') || n.includes('metallic') || n.includes('metalic') || n.includes('gold')) return '金属'
  if (n.includes('cell') || n.includes('frame')) return '镜框'
  if (n.includes('scarf')) return '围巾'
  if (n.includes('pearl')) return '珍珠'
  if (n.includes('dress') && n.includes('main')) return '主料'
  if (n.includes('black')) return '黑'
  if (n.includes('white')) return '白'
  return name.replace(/^M_/, '').replace(/_/g, ' ').trim() || name
}

export { BODY_MESH }

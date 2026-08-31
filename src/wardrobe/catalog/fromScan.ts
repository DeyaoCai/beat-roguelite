import {
  BODY_MESH,
  guessEyesMakeupKind,
  guessWebTypeName,
  isAuxOrDamageTex,
  isLikelySkinPng,
  isMakeupPath,
  isThumbAlbedo,
  looksLikeAnim,
  looksLikeEyesAsset,
  looksLikeLoopAnim,
  preferMontageAnimUrls,
} from './guess'
import type { ClothesRow, MakeupRow, ModCatalog } from './types'

export function catalogFromFiles(modId: string, files: string[]): ModCatalog {
  const clothes: ClothesRow[] = []
  const makeup: MakeupRow[] = []
  const glbs = files.filter((f) => /\.(glb|gltf)$/i.test(f) && !looksLikeAnim(f))
  const pngs = files.filter((f) => /\.png$/i.test(f))
  const animUrls = preferMontageAnimUrls(files.filter((f) => /\.(glb|gltf)$/i.test(f) && looksLikeAnim(f)))
  const anims = animUrls.map((url) => {
    const caption = (url.replace(/\\/g, '/').split('/').pop() ?? url).replace(/\.[^.]+$/, '')
    return { url, caption, loop: looksLikeLoopAnim(`${caption} ${url}`) }
  })

  for (const rel of glbs) {
    const id = fileStem(rel)
    const stem = id.toLowerCase()
    if (stem === 'female' || stem === 'user' || stem === 'body') continue
    if (looksLikeEyesAsset(rel, id)) continue
    const typeName = guessWebTypeName(rel, id)
    if (!typeName) continue
    clothes.push({
      id: `${modId}.${id}`,
      group: modId,
      typeName,
      caption: id,
      mesh: rel,
      icon: null,
      source: 'scan',
      shading: typeName === 'Hair' ? 'hairCard' : 'lit',
    })
  }

  if (clothes.length === 0) {
    for (const rel of pngs) {
      if (isThumbAlbedo(rel) || isMakeupPath(rel) || isAuxOrDamageTex(rel)) continue
      const id = fileStem(rel)
      const eyesKind = guessEyesMakeupKind(rel, id)
      if (eyesKind) {
        makeup.push({
          id: `${modId}.${id}`,
          group: modId,
          typeName: eyesKind,
          caption: id,
          mesh: null,
          icon: rel,
          textures: { map: rel },
          source: 'eyes',
        })
        continue
      }
      if (!isLikelySkinPng(rel)) continue
      clothes.push({
        id: `${modId}.${id}`,
        group: modId,
        typeName: 'Skin',
        caption: id,
        mesh: BODY_MESH,
        icon: rel,
        source: 'scan',
        shading: 'lit',
        textures: { map: rel },
      })
    }
  }

  return { clothes, makeup, animUrls, anims }
}

function fileStem(rel: string): string {
  return (rel.replace(/\\/g, '/').split('/').pop() ?? rel).replace(/\.[^.]+$/, '')
}

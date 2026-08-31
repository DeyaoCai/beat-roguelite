/**
 * Tracks: local `.osz` (learning) + sibling co_der-resource onset charts.
 */
export type TrackDef = {
  id: string
  title: string
  artist: string
  source: 'osz' | 'resource'
  /** public/ URL path for `.osz` (source=osz) */
  oszPath?: string
  /** Prefer this difficulty name inside the pack */
  oszPrefer?: string
  /** Path under co_der-resource (source=resource) */
  metaJson?: string
  rhythmJson?: string
  audioFallback?: string
}

export const TRACKS: TrackDef[] = [
  {
    id: 'osz_pixel_planet',
    title: 'Pixel Planet',
    artist: 'Lime',
    source: 'osz',
    oszPath: 'osz/2382059 Lime - Pixel Planet.osz',
    oszPrefer: 'Easy',
  },
  {
    id: 'qq_649556361',
    title: '太阳之子',
    artist: '周杰伦',
    source: 'resource',
    metaJson: 'music-resource/周杰伦/太阳之子/qq_649556361_太阳之子/music.json',
    rhythmJson: 'music-rhythm-points/qq_649556361.json',
  },
  {
    id: 'qq_512188195',
    title: '《黑神话：悟空》主题音乐',
    artist: '游戏科学',
    source: 'resource',
    metaJson:
      'music-resource/游戏科学/《黑神话：悟空》游戏音乐精选集/qq_512188195_《黑神话：悟空》主题音乐/music.json',
    rhythmJson: 'music-rhythm-points/qq_512188195.json',
  },
  {
    id: 'qq_509884989',
    title: '不由己',
    artist: '陈彼得',
    source: 'resource',
    metaJson:
      'music-resource/陈彼得/《黑神话：悟空》游戏音乐精选集/qq_509884989_不由己/music.json',
    rhythmJson: 'music-rhythm-points/qq_509884989.json',
  },
]

export const DEFAULT_TRACK_ID = 'osz_pixel_planet'

export function resUrl(relPath: string): string {
  return `/res/${relPath.split('\\').join('/')}`
}

/** Encode each path segment for public/ static files. */
export function publicUrl(relPath: string): string {
  return (
    '/' +
    relPath
      .split(/[/\\]/)
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/')
  )
}

export type MusicMeta = {
  name: string
  file: string
  duration?: number
  cover?: string
  lrc?: string
}

async function fetchOk(url: string, timeoutMs = 12_000): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ac.signal })
    if (!res.ok) throw new Error(`${res.status}: ${url}`)
    return res
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(`timeout ${timeoutMs}ms: ${url}`)
    }
    throw e
  } finally {
    clearTimeout(t)
  }
}

export async function loadMusicMeta(track: TrackDef): Promise<{
  meta: MusicMeta
  metaDir: string
  audioUrl: string
}> {
  if (!track.metaJson) throw new Error('track missing metaJson')
  const metaUrl = resUrl(track.metaJson)
  const res = await fetchOk(metaUrl)
  const meta = (await res.json()) as MusicMeta
  const metaDir = track.metaJson.replace(/[/\\][^/\\]+$/, '')
  const audioUrl = resUrl(`${metaDir}/${meta.file}`)
  return { meta, metaDir, audioUrl }
}

import { assetUrl, encodePublicPath } from '../lib/assetUrl'
import { isRhythmEnabled } from '../lib/rhythmEnabled'

/** co_der-resource prefix for beat-roguelite audio/charts (dev-only rhythm layer). */
export const BEAT_AUDIO_PREFIX = 'beat-roguelite'

/**
 * Tracks live in co_der-resource. Rhythm layer is dev-only; ship builds omit charts/audio.
 */
export type TrackDef = {
  id: string
  title: string
  artist: string
  source: 'osz' | 'resource'
  /** Path under co_der-resource (source=osz) */
  oszPath?: string
  oszPrefer?: string
  /** Path under co_der-resource (source=resource) */
  metaJson?: string
  rhythmJson?: string
  audioFallback?: string
}

const ALL_TRACKS: TrackDef[] = [
  {
    id: 'osz_pixel_planet',
    title: 'Pixel Planet',
    artist: 'Lime',
    source: 'osz',
    oszPath: `${BEAT_AUDIO_PREFIX}/osz/2382059 Lime - Pixel Planet.osz`,
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

/** Placeholder when rhythm layer is off (no fetch). */
export const SHIP_SILENT_TRACK: TrackDef = {
  id: 'ship_silent',
  title: '素打',
  artist: '',
  source: 'resource',
}

/** @deprecated use {@link listTracks} */
export const TRACKS: TrackDef[] = ALL_TRACKS

export function listTracks(): TrackDef[] {
  return isRhythmEnabled() ? ALL_TRACKS : []
}

export const DEFAULT_TRACK_ID = 'osz_pixel_planet'

export function defaultTrack(): TrackDef {
  const tracks = listTracks()
  return tracks.find((t) => t.id === DEFAULT_TRACK_ID) ?? tracks[0] ?? SHIP_SILENT_TRACK
}

export function resUrl(relPath: string): string {
  return assetUrl(`res/${relPath.split('\\').join('/')}`)
}

/** Encode each path segment for static files under co_der-resource. */
export function publicUrl(relPath: string): string {
  return resUrl(encodePublicPath(relPath))
}

export function formatTrackDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  const t = Math.round(sec)
  const m = Math.floor(t / 60)
  const s = t % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export type MusicMeta = {
  name: string
  file: string
  duration?: number
  cover?: string
  lrc?: string
}

/** music.json 有的写秒、有的写毫秒。 */
export function metaDurationSec(raw?: number): number {
  if (raw == null || raw <= 0) return 0
  return raw >= 1000 ? raw / 1000 : raw
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

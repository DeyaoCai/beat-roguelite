import { unzipSync } from 'fflate'
import {
  chartFromOsuTimes,
  parseOsu,
  pickOsuDiff,
  type OsuDifficulty,
} from '../../domain/rhythm/osuParse'
import type { ChartNote } from '../../domain/rhythm/chart'

export type LoadedOsz = {
  title: string
  artist: string
  creator: string
  version: string
  bpm: number
  keyCount: number
  mode: number
  notes: ChartNote[]
  /** Object URL for decoded audio; caller should revoke when replacing. */
  audioUrl: string
  /** Available difficulty names in the pack. */
  versions: string[]
}

function basename(path: string): string {
  const n = path.replace(/\\/g, '/').split('/').pop() ?? path
  return n
}

/**
 * Fetch a `.osz` (zip) from a URL, pick a difficulty, build single-lane chart + audio blob URL.
 */
export async function loadOsz(
  url: string,
  opts?: { preferVersion?: string; signal?: AbortSignal },
): Promise<LoadedOsz> {
  const res = await fetch(url, { signal: opts?.signal })
  if (!res.ok) throw new Error(`osz ${res.status}: ${url}`)
  const ab = await res.arrayBuffer()
  const files = unzipSync(new Uint8Array(ab))

  const osuEntries: { path: string; text: string; parsed: OsuDifficulty }[] = []
  for (const [path, data] of Object.entries(files)) {
    if (!path.toLowerCase().endsWith('.osu')) continue
    if (path.includes('/__MACOSX/') || basename(path).startsWith('.')) continue
    const text = new TextDecoder().decode(data)
    osuEntries.push({ path, text, parsed: parseOsu(text) })
  }
  if (osuEntries.length === 0) throw new Error('osz: no .osu files')

  const idx = pickOsuDiff(
    osuEntries.map((e) => ({
      version: e.parsed.version,
      mode: e.parsed.mode,
      noteCount: e.parsed.times.length,
    })),
    opts?.preferVersion,
  )
  const chosen = osuEntries[idx]!
  const d = chosen.parsed

  const audioName = d.audioFilename.replace(/\\/g, '/')
  const audioKey =
    Object.keys(files).find(
      (k) => basename(k).toLowerCase() === basename(audioName).toLowerCase(),
    ) ?? Object.keys(files).find((k) => /\.(mp3|ogg|wav|flac)$/i.test(k))

  if (!audioKey) throw new Error(`osz: missing audio ${audioName}`)

  const audioBytes = files[audioKey]!
  const mime = audioKey.toLowerCase().endsWith('.ogg')
    ? 'audio/ogg'
    : audioKey.toLowerCase().endsWith('.wav')
      ? 'audio/wav'
      : 'audio/mpeg'
  const audioUrl = URL.createObjectURL(new Blob([audioBytes], { type: mime }))

  return {
    title: d.title,
    artist: d.artist,
    creator: d.creator,
    version: d.version,
    bpm: d.bpm,
    keyCount: d.keyCount,
    mode: d.mode,
    notes: chartFromOsuTimes(d.times),
    audioUrl,
    versions: osuEntries.map((e) => e.parsed.version),
  }
}

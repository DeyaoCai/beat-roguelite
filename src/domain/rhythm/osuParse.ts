import type { ChartNote } from './chart'

export type OsuDifficulty = {
  version: string
  mode: number
  keyCount: number
  /** Note onset times in seconds (all columns; chords not yet collapsed). */
  times: number[]
  bpm: number
  audioFilename: string
  title: string
  artist: string
  creator: string
}

/** Parse a single `.osu` text (mania-focused; other modes still yield hit times). */
export function parseOsu(text: string): OsuDifficulty {
  const section = (name: string) => {
    const re = new RegExp(`\\[${name}\\]\\s*([\\s\\S]*?)(?=\\n\\[|$)`, 'i')
    return re.exec(text)?.[1] ?? ''
  }

  const kv = (block: string, key: string, fallback = '') => {
    const m = new RegExp(`^${key}:(.*)$`, 'im').exec(block)
    return m ? m[1]!.trim() : fallback
  }

  const general = section('General')
  const meta = section('Metadata')
  const diff = section('Difficulty')
  const timing = section('TimingPoints')
  const hits = section('HitObjects')

  const mode = Number(kv(general, 'Mode', '0')) || 0
  const keyCount = Math.max(1, Math.round(Number(kv(diff, 'CircleSize', '4')) || 4))
  const audioFilename = kv(general, 'AudioFilename', 'audio.mp3')
  const title = kv(meta, 'Title', 'Unknown')
  const artist = kv(meta, 'Artist', '')
  const creator = kv(meta, 'Creator', '')
  const version = kv(meta, 'Version', 'Normal')

  let bpm = 120
  for (const line of timing.split(/\r?\n/)) {
    if (!line || line.startsWith('//')) continue
    const parts = line.split(',')
    const msPerBeat = Number(parts[1])
    if (Number.isFinite(msPerBeat) && msPerBeat > 0) {
      bpm = 60000 / msPerBeat
      break
    }
  }

  const times: number[] = []
  for (const line of hits.split(/\r?\n/)) {
    if (!line || line.startsWith('//')) continue
    const parts = line.split(',')
    if (parts.length < 3) continue
    const tMs = Number(parts[2])
    if (!Number.isFinite(tMs)) continue
    times.push(tMs / 1000)
  }
  times.sort((a, b) => a - b)

  return {
    version,
    mode,
    keyCount,
    times,
    bpm,
    audioFilename,
    title,
    artist,
    creator,
  }
}

/**
 * Collapse chords + thin to a casual single-lane density.
 */
export function chartFromOsuTimes(
  times: number[],
  opts?: { chordWindow?: number; minGap?: number },
): ChartNote[] {
  const chordWindow = opts?.chordWindow ?? 0.04
  const minGap = opts?.minGap ?? 0.48
  const notes: ChartNote[] = []
  let last = -Infinity
  let id = 0
  for (const t of times) {
    if (t - last < Math.max(chordWindow, minGap)) continue
    notes.push({ id: id++, lane: 0, t, judged: false, result: null })
    last = t
  }
  return notes
}

/** Prefer a mid difficulty for learning (Hard → Normal → Insane → …). */
export function pickOsuDiff(
  diffs: { version: string; mode: number; noteCount: number }[],
  prefer?: string,
): number {
  if (prefer) {
    const i = diffs.findIndex(
      (d) => d.version.toLowerCase() === prefer.toLowerCase(),
    )
    if (i >= 0) return i
  }
  const order = ['easy', 'normal', 'beginner', 'hard', 'insane', 'expert']
  for (const name of order) {
    const i = diffs.findIndex((d) => d.version.toLowerCase().includes(name))
    if (i >= 0) return i
  }
  // Prefer mania (mode 3), else densest chart
  let best = 0
  let bestScore = -1
  for (let i = 0; i < diffs.length; i++) {
    const d = diffs[i]!
    const score = (d.mode === 3 ? 1_000_000 : 0) + d.noteCount
    if (score > bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

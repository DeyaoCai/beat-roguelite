import type { JudgeResult, JudgeWindows } from './judge'
import { catchSec, DEFAULT_JUDGE_WINDOWS, judgeBeat } from './judge'

export type ChartNote = {
  id: number
  lane: number
  /** Hit time in song seconds */
  t: number
  judged: boolean
  result: JudgeResult | null
}

export type RhythmBandFile = {
  songId?: string
  bands: { name: string; rage: [number, number | null]; rhythms: number[] }[]
}

/** Single-track control hint. */
export const LANE_LABELS = ['Space'] as const
export const LANE_COUNT = 1

/** Merge all band onsets into one lane, then thin. */
export function chartFromRhythmPoints(
  data: RhythmBandFile,
  opts?: { minGap?: number; maxNotes?: number; endSec?: number },
): ChartNote[] {
  const minGap = opts?.minGap ?? 0.26
  const maxNotes = opts?.maxNotes ?? 520
  const endSec = opts?.endSec ?? Infinity

  const times: number[] = []
  for (const band of data.bands) {
    for (const t of band.rhythms) {
      if (t > endSec) break
      times.push(t)
    }
  }
  times.sort((a, b) => a - b)

  const notes: ChartNote[] = []
  let last = -Infinity
  let id = 0
  for (const t of times) {
    if (t - last < minGap) continue
    notes.push({ id: id++, lane: 0, t, judged: false, result: null })
    last = t
  }

  if (notes.length <= maxNotes) return notes

  const out: ChartNote[] = []
  let lastT = -Infinity
  const gap = Math.max(minGap * 0.55, (notes[notes.length - 1]!.t / maxNotes) * 0.85)
  for (const n of notes) {
    if (n.t - lastT < gap) continue
    out.push(n)
    lastT = n.t
  }
  return out
}

export type HighwayNoteView = {
  lane: number
  /** 0 = at judge line, 1 = top of highway */
  y: number
  judged: boolean
  result: JudgeResult | null
}

export type RhythmRuntime = {
  notes: ChartNote[]
  lead: number
  lastFlash: JudgeResult | null
  flashT: number
  lastLane: number
  flashSeq: number
  /** Which audio loop we last reset notes for. */
  loopIndex: number
}

export function createRhythmRuntime(notes: ChartNote[], lead = 1.65): RhythmRuntime {
  return {
    notes: notes.map((n) => ({ ...n })),
    lead,
    lastFlash: null,
    flashT: 0,
    lastLane: -1,
    flashSeq: 0,
    loopIndex: 0,
  }
}

/** In-loop song time (music repeats; chart times stay in [0, period)). */
export function chartTime(songTime: number, period: number): number {
  if (period <= 0) return songTime
  return songTime % period
}

/** When the bed loops, notes become hittable again. */
export function tickRhythmLoop(rt: RhythmRuntime, songTime: number, period: number): void {
  if (period <= 0) return
  const loop = Math.floor(songTime / period)
  if (loop === rt.loopIndex) return
  rt.loopIndex = loop
  for (const n of rt.notes) {
    n.judged = false
    n.result = null
  }
}

export function visibleHighwayNotes(
  rt: RhythmRuntime,
  songTime: number,
): HighwayNoteView[] {
  const views: HighwayNoteView[] = []
  for (const n of rt.notes) {
    const dt = n.t - songTime
    if (dt > rt.lead) continue
    if (dt < -0.28 && n.judged) continue
    if (dt < -0.4) continue
    const y = Math.max(-0.08, Math.min(1.15, dt / rt.lead))
    views.push({
      lane: n.lane,
      y,
      judged: n.judged,
      result: n.result,
    })
  }
  return views
}

export function tickRhythmMisses(
  rt: RhythmRuntime,
  songTime: number,
  win: JudgeWindows = DEFAULT_JUDGE_WINDOWS,
): JudgeResult[] {
  const events: JudgeResult[] = []
  const late = catchSec(win)
  for (const n of rt.notes) {
    if (n.judged) continue
    if (songTime - n.t > late) {
      n.judged = true
      n.result = 'miss'
      events.push('miss')
      rt.lastFlash = 'miss'
      rt.flashT = 0.45
      rt.lastLane = n.lane
      rt.flashSeq += 1
    }
  }
  return events
}

export type HitOutcome = {
  result: JudgeResult
  /** songTime - note.t; >0 late, <0 early */
  errorSec: number
}

/**
 * During Fever: auto-catch notes as they reach the judge line (Perfect).
 * Call instead of (or before) miss processing while fever is active.
 */
export function tickFeverAutoHits(
  rt: RhythmRuntime,
  songTime: number,
  win: JudgeWindows = DEFAULT_JUDGE_WINDOWS,
): HitOutcome[] {
  const out: HitOutcome[] = []
  const late = catchSec(win)
  for (const n of rt.notes) {
    if (n.judged) continue
    // Catch from slightly early through the miss cutoff.
    if (songTime >= n.t - 0.04 && songTime - n.t <= late) {
      n.judged = true
      n.result = 'perfect'
      rt.lastFlash = 'perfect'
      rt.flashT = 0.32
      rt.lastLane = n.lane
      rt.flashSeq += 1
      out.push({ result: 'perfect', errorSec: 0 })
    }
  }
  return out
}

export function tickRhythmFlash(rt: RhythmRuntime, dt: number): void {
  if (rt.flashT > 0) rt.flashT = Math.max(0, rt.flashT - dt)
}

export function hitLane(
  rt: RhythmRuntime,
  lane: number,
  songTime: number,
  win: JudgeWindows = DEFAULT_JUDGE_WINDOWS,
): HitOutcome | null {
  let best: ChartNote | null = null
  let bestErr = Infinity
  const catchW = catchSec(win)
  for (const n of rt.notes) {
    if (n.judged || n.lane !== lane) continue
    const a = Math.abs(n.t - songTime)
    if (a < bestErr && a <= catchW) {
      bestErr = a
      best = n
    }
  }
  if (!best) return null
  const errorSec = songTime - best.t
  const result = judgeBeat(errorSec, win)
  best.judged = true
  best.result = result
  rt.lastFlash = result
  rt.flashT = result === 'perfect' ? 0.38 : result === 'good' ? 0.32 : 0.4
  rt.lastLane = lane
  rt.flashSeq += 1
  return { result, errorSec }
}

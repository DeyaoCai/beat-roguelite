/** Playable half-extent on X/Z (full map is 2× this). */
export const ARENA_HALF = 42

/**
 * Local chase-camera / 2D view half-extent.
 * Independent of arena size so a bigger map does not zoom the player out.
 */
export const PLAY_VIEW_HALF = 22

/** Combat wave length band (not equal to full track). */
export const WAVE_DURATION_MIN_SEC = 3 * 60
export const WAVE_DURATION_MAX_SEC = 5 * 60
export const WAVE_DURATION_FALLBACK_SEC = 4 * 60

/** 标准模式波数。无限没有这个顶。 */
export const STANDARD_WAVES = 5

export type RunMode = 'standard' | 'endless'

export function isLastStandardWave(mode: RunMode, wave: number): boolean {
  return mode === 'standard' && wave >= STANDARD_WAVES
}

/**
 * Resolve fight length into a fixed 3–5 minute window.
 * Uses song metadata when present, then clamps — short tracks still get ≥3m (music loops),
 * long tracks cap at 5m.
 */
export function resolveWaveDurationSec(songDurationSec: number): number {
  const raw = songDurationSec > 0 ? songDurationSec : WAVE_DURATION_FALLBACK_SEC
  return Math.min(
    WAVE_DURATION_MAX_SEC,
    Math.max(WAVE_DURATION_MIN_SEC, raw),
  )
}

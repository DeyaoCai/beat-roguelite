/**
 * Ports that adapters implement and domain consumes (structural typing).
 * Domain never imports adapters; application injects concrete clocks/keys.
 */

/** Synthetic SFX kinds (no sample files). */
export type BeepKind =
  | 'perfect'
  | 'good'
  | 'miss'
  | 'hit'
  | 'hurt'
  | 'death'
  | 'kill'
  | 'kill_elite'
  | 'kill_boss'
  | 'fever'
  | 'level_up'
  | 'pickup_gold'
  | 'pickup_relic'
  | 'offer'
  | 'upgrade'
  | 'wave_start'
  | 'wave_clear'
  | 'elite_spawn'
  | 'boss_spawn'
  | 'slash'
  | 'orb'
  | 'aura'
  | 'chain'
  | 'ui'
  | 'ui_ok'
  | 'ui_back'
  | 'ui_tick'
  | 'combo'

/** Minimal clock surface used by combat / beat bridge. */
export type AudioClockPort = {
  readonly songTime: number
  readonly duration: number
  beep(kind?: BeepKind): void
}

export type KeyState = {
  w: boolean
  a: boolean
  s: boolean
  d: boolean
  /** Single rhythm lane (Space / J / K / L). */
  lanePressed: [boolean]
  laneDown: [boolean]
  /** Edge: Fever 键（F）本帧按下。 */
  feverPressed: boolean
  /** Edge: 位移闪避（Shift）本帧按下。 */
  dashPressed: boolean
}

export type HeatConfig = {
  max: number
  decayPerSec: number
  hitGain: number
  killGain: number
  perfectGain: number
  goodGain: number
  missLoss: number
  hurtLoss: number
}

export const DEFAULT_HEAT: HeatConfig = {
  max: 100,
  decayPerSec: 6,
  hitGain: 0.85,
  killGain: 6,
  perfectGain: 10,
  goodGain: 5,
  missLoss: 4,
  hurtLoss: 12,
}

export function heatToMult(heat: number, max = 100): number {
  return 1 + Math.max(0, Math.min(heat, max)) / max
}

export function tickHeat(
  heat: number,
  dt: number,
  cfg: HeatConfig,
  decayMul = 1,
): number {
  return Math.max(0, heat - cfg.decayPerSec * decayMul * dt)
}

export function addHeat(heat: number, amount: number, cfg: HeatConfig): number {
  return Math.max(0, Math.min(cfg.max, heat + amount))
}

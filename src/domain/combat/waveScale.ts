/**
 * Enemy attribute growth by wave (standard 1–5 + endless beyond).
 * Wave 1 stays teachable; later waves and endless climb.
 *
 * Speed: trash climbs with wave; tanks (brute / elite) climb slower so they stay “soak” targets.
 */

export function waveAtkMul(wave: number): number {
  const w = Math.max(1, wave)
  // w1=1 · w3≈1.28 · w5≈1.6 · w8≈2.2 · w12≈3.0
  return 1 + (w - 1) * 0.14 + Math.max(0, w - 5) * 0.12
}

export function waveSpeedMul(wave: number): number {
  const w = Math.max(1, wave)
  return 1 + (w - 1) * 0.055 + Math.max(0, w - 5) * 0.035
}

/** Tanks barely speed up with wave — stay slow enough to juice. */
export function waveTankSpeedMul(wave: number): number {
  const w = Math.max(1, wave)
  return 1 + (w - 1) * 0.022 + Math.max(0, w - 5) * 0.015
}

export function waveArmorBonus(wave: number): number {
  const w = Math.max(1, wave)
  return Math.min(0.28, Math.max(0, (w - 2) * 0.045))
}

/** Base fodder HP before kind hpMul / iron contract. */
export function fodderHp(wave: number): number {
  const w = Math.max(1, wave)
  // w1≈5 · w3≈11 · w5≈21 · w8≈36 · w12≈58
  let hp = 3 + w * 2 + (w >= 3 ? (w - 2) * 3 : 0)
  if (w >= 6) hp = Math.floor(hp * (1 + (w - 5) * 0.18))
  return Math.max(1, Math.floor(hp))
}

/**
 * Boss table muls (wave-bosses.md) are end-of-standard targets.
 * Wave 1–2 stay teachable; wave 5 ≈ full mul; endless climbs further.
 */
export function bossHpMul(wave: number, tableMul: number): number {
  const w = Math.max(1, wave)
  if (w <= 5) {
    // w1≈0.72 · w3≈0.86 · w5=1.0 of table
    const ramp = 0.72 + (w - 1) * 0.07
    return tableMul * ramp
  }
  return tableMul * (1 + (w - 5) * 0.08)
}

export function scaleEnemySpeed(
  base: number,
  wave: number,
  role: 'trash' | 'tank' | 'boss' = 'trash',
): number {
  if (role === 'tank') return base * waveTankSpeedMul(wave)
  return base * waveSpeedMul(wave)
}

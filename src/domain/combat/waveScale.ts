import { WAVE_SCALE } from '../../content/rules'

/**
 * Enemy attribute growth by wave (standard 1–5 + endless beyond).
 * Coeffs in content/rules/waveScale.
 */

const S = WAVE_SCALE

export function waveAtkMul(wave: number): number {
  const w = Math.max(1, wave)
  return 1 + (w - 1) * S.atkPerWave + Math.max(0, w - 5) * S.atkExtraAfter5
}

export function waveSpeedMul(wave: number): number {
  const w = Math.max(1, wave)
  return 1 + (w - 1) * S.speedPerWave + Math.max(0, w - 5) * S.speedExtraAfter5
}

/** Tanks barely speed up with wave — stay slow enough to juice. */
export function waveTankSpeedMul(wave: number): number {
  const w = Math.max(1, wave)
  return (
    1 +
    (w - 1) * S.tankSpeedPerWave +
    Math.max(0, w - 5) * S.tankSpeedExtraAfter5
  )
}

export function waveArmorBonus(wave: number): number {
  const w = Math.max(1, wave)
  return Math.min(
    S.armorCap,
    Math.max(0, (w - S.armorFromWave) * S.armorPerWave),
  )
}

/** Base fodder HP before kind hpMul / iron contract. */
export function fodderHp(wave: number): number {
  const w = Math.max(1, wave)
  let hp =
    S.fodderHpBase +
    w * S.fodderHpPerWave +
    (w >= S.fodderHpExtraStartWave
      ? (w - (S.fodderHpExtraStartWave - 1)) * S.fodderHpExtraFromWave
      : 0)
  if (w >= S.fodderHpRampFromWave) {
    hp = Math.floor(hp * (1 + (w - 5) * S.fodderHpRampPer))
  }
  return Math.max(1, Math.floor(hp))
}

/**
 * Boss table muls are end-of-standard targets.
 * Wave 1–2 stay teachable; wave 5 ≈ full mul; endless climbs further.
 */
export function bossHpMul(wave: number, tableMul: number): number {
  const w = Math.max(1, wave)
  if (w <= S.bossFullAtWave) {
    const ramp = S.bossRampBase + (w - 1) * S.bossRampPerWave
    return tableMul * ramp
  }
  return tableMul * (1 + (w - S.bossFullAtWave) * S.bossEndlessPerWave)
}

export function scaleEnemySpeed(
  base: number,
  wave: number,
  role: 'trash' | 'tank' | 'boss' = 'trash',
): number {
  if (role === 'tank') return base * waveTankSpeedMul(wave)
  return base * waveSpeedMul(wave)
}

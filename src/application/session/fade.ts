import { FADE_IN_SEC, FADE_OUT_SEC, type FadeTx } from './types'

export type FadeBag = {
  fadeTx: FadeTx | null
  fadeBlack: number
}

export function beginFadeToWave(s: FadeBag, next: number): void {
  if (s.fadeTx) return
  s.fadeTx = { phase: 'out', t: 0, action: 'wave', nextWave: next }
}

export function beginFadeToResult(s: FadeBag, won: boolean): void {
  if (s.fadeTx) return
  s.fadeTx = { phase: 'out', t: 0, action: 'result', won }
}

export function tickFade(
  s: FadeBag,
  dt: number,
  hooks: { startWave: (n: number) => void; goResult: (won: boolean) => void },
): void {
  if (!s.fadeTx) return
  s.fadeTx.t += dt
  if (s.fadeTx.phase === 'out') {
    s.fadeBlack = Math.min(1, s.fadeTx.t / FADE_OUT_SEC)
    if (s.fadeTx.t >= FADE_OUT_SEC) {
      if (s.fadeTx.action === 'wave' && s.fadeTx.nextWave) {
        hooks.startWave(s.fadeTx.nextWave)
      } else if (s.fadeTx.action === 'result') {
        hooks.goResult(!!s.fadeTx.won)
      }
      s.fadeTx = { phase: 'in', t: 0, action: s.fadeTx.action }
      s.fadeBlack = 1
    }
  } else {
    s.fadeBlack = Math.max(0, 1 - s.fadeTx.t / FADE_IN_SEC)
    if (s.fadeTx.t >= FADE_IN_SEC) {
      s.fadeTx = null
      s.fadeBlack = 0
    }
  }
}

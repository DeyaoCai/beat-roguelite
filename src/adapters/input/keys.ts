import type { KeyState } from '../../domain/shared/ports'

export type { KeyState }

export function createInput(target: Window = window): {
  keys: KeyState
  dispose: () => void
  endFrame: () => void
} {
  const keys: KeyState = {
    w: false,
    a: false,
    s: false,
    d: false,
    lanePressed: [false],
    laneDown: [false],
    feverPressed: false,
    dashPressed: false,
  }
  let feverDown = false
  let dashDown = false

  const isRhythmKey = (k: string) =>
    k === 'j' || k === 'k' || k === 'l' || k === ' ' || k === 'spacebar'

  const onDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') keys.w = true
    if (k === 'a' || k === 'arrowleft') keys.a = true
    if (k === 's' || k === 'arrowdown') keys.s = true
    if (k === 'd' || k === 'arrowright') keys.d = true
    if (isRhythmKey(k)) {
      if (!keys.laneDown[0]) keys.lanePressed[0] = true
      keys.laneDown[0] = true
      e.preventDefault()
    }
    if (k === 'f') {
      if (!feverDown) keys.feverPressed = true
      feverDown = true
      e.preventDefault()
    }
    if (k === 'shift') {
      if (!dashDown) keys.dashPressed = true
      dashDown = true
    }
  }
  const onUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') keys.w = false
    if (k === 'a' || k === 'arrowleft') keys.a = false
    if (k === 's' || k === 'arrowdown') keys.s = false
    if (k === 'd' || k === 'arrowright') keys.d = false
    if (isRhythmKey(k)) keys.laneDown[0] = false
    if (k === 'f') feverDown = false
    if (k === 'shift') dashDown = false
  }

  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)

  return {
    keys,
    dispose: () => {
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
    },
    endFrame: () => {
      keys.lanePressed[0] = false
      keys.feverPressed = false
      keys.dashPressed = false
    },
  }
}

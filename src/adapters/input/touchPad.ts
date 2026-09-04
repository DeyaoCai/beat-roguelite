import type { KeyState } from '../../domain/shared/ports'

export type TouchPadState = {
  /** 0..1 heat fill toward Fever. */
  heatFill: number
  /** 0..1 Fever crash cooldown remaining. */
  feverCooldown: number
  feverActive: boolean
  feverMute: boolean
  /** 0..1 dash cooldown remaining. */
  dashCd: number
}

export type TouchPad = {
  root: HTMLElement
  setVisible: (v: boolean) => void
  setOnPause: (fn: () => void) => void
  sync: (state: TouchPadState) => void
  dispose: () => void
}

/**
 * Virtual stick (WASD) + Fever / Dash edge buttons.
 * Writes into the shared KeyState used by keyboard input.
 */
export function createTouchPad(host: HTMLElement, keys: KeyState): TouchPad {
  const root = document.createElement('div')
  root.className = 'touch-pad'
  root.style.display = 'none'
  root.setAttribute('aria-hidden', 'true')

  const stickWrap = document.createElement('div')
  stickWrap.className = 'touch-pad__stick'
  const stickBase = document.createElement('div')
  stickBase.className = 'touch-pad__stick-base'
  const stickKnob = document.createElement('div')
  stickKnob.className = 'touch-pad__stick-knob'
  stickWrap.append(stickBase, stickKnob)

  const actions = document.createElement('div')
  actions.className = 'touch-pad__actions'

  const makeAction = (label: string, kind: string) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `touch-pad__btn touch-pad__btn--${kind}`
    const text = document.createElement('span')
    text.className = 'touch-pad__btn-label'
    text.textContent = label
    const ring = document.createElement('span')
    ring.className = 'touch-pad__ring'
    ring.style.setProperty('--cd', '0')
    ring.style.setProperty('--fill', '0')
    b.append(text, ring)
    return { btn: b, ring, label: text }
  }

  const pauseBtn = document.createElement('button')
  pauseBtn.type = 'button'
  pauseBtn.className = 'touch-pad__btn touch-pad__btn--pause'
  pauseBtn.textContent = '暂停'

  const fever = makeAction('Fever', 'fever')
  const dash = makeAction('闪避', 'dash')
  actions.append(pauseBtn, fever.btn, dash.btn)

  root.append(stickWrap, actions)
  host.appendChild(root)

  let stickId: number | null = null
  let originX = 0
  let originY = 0
  let onPause: (() => void) | null = null
  const MAX = 52
  const DEAD = 0.22

  const clearMove = () => {
    keys.w = false
    keys.a = false
    keys.s = false
    keys.d = false
    stickKnob.style.transform = 'translate(-50%, -50%)'
  }

  const applyAxis = (dx: number, dy: number) => {
    const len = Math.hypot(dx, dy)
    const nx = len > 0 ? dx / len : 0
    const ny = len > 0 ? dy / len : 0
    const mag = Math.min(1, len / MAX)
    const px = nx * mag * MAX
    const py = ny * mag * MAX
    stickKnob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`
    if (mag < DEAD) {
      clearMove()
      return
    }
    keys.w = ny < -0.35
    keys.s = ny > 0.35
    keys.a = nx < -0.35
    keys.d = nx > 0.35
  }

  const onStickDown = (e: PointerEvent) => {
    if (stickId != null) return
    stickId = e.pointerId
    stickWrap.setPointerCapture(e.pointerId)
    const r = stickBase.getBoundingClientRect()
    originX = r.left + r.width / 2
    originY = r.top + r.height / 2
    applyAxis(e.clientX - originX, e.clientY - originY)
    e.preventDefault()
  }
  const onStickMove = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return
    applyAxis(e.clientX - originX, e.clientY - originY)
    e.preventDefault()
  }
  const onStickUp = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return
    stickId = null
    clearMove()
  }

  stickWrap.addEventListener('pointerdown', onStickDown)
  stickWrap.addEventListener('pointermove', onStickMove)
  stickWrap.addEventListener('pointerup', onStickUp)
  stickWrap.addEventListener('pointercancel', onStickUp)

  const edgePress = (kind: 'fever' | 'dash') => (e: PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (kind === 'fever') keys.feverPressed = true
    else keys.dashPressed = true
  }
  fever.btn.addEventListener('pointerdown', edgePress('fever'))
  dash.btn.addEventListener('pointerdown', edgePress('dash'))
  pauseBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onPause?.()
  })

  let open = false

  return {
    root,
    setVisible: (v) => {
      if (open === v) return
      open = v
      root.style.display = v ? 'block' : 'none'
      root.setAttribute('aria-hidden', v ? 'false' : 'true')
      // 仅在从显示→隐藏时清摇杆；每帧 setVisible(false) 会误清键盘 WASD
      if (!v) {
        stickId = null
        clearMove()
      }
    },
    setOnPause: (fn) => {
      onPause = fn
    },
    sync: (state) => {
      const heat = Math.max(0, Math.min(1, state.heatFill))
      const fCd = Math.max(0, Math.min(1, state.feverCooldown))
      const dCd = Math.max(0, Math.min(1, state.dashCd))
      fever.ring.style.setProperty('--cd', String(fCd))
      fever.ring.style.setProperty('--fill', String(state.feverActive || state.feverMute ? 0 : heat))
      dash.ring.style.setProperty('--cd', String(dCd))
      dash.ring.style.setProperty('--fill', '0')
      fever.btn.classList.toggle('is-ready', heat >= 0.98 && fCd <= 0.02 && !state.feverMute && !state.feverActive)
      fever.btn.classList.toggle('is-active', state.feverActive)
      fever.btn.classList.toggle('is-locked', state.feverMute)
      fever.btn.disabled = state.feverMute
      fever.label.textContent = state.feverMute
        ? '锁'
        : state.feverActive
          ? 'Fever!'
          : fCd > 0.02
            ? 'CD'
            : 'Fever'
      dash.btn.classList.toggle('is-ready', dCd <= 0.02)
      dash.btn.classList.toggle('is-cooling', dCd > 0.02)
    },
    dispose: () => {
      if (open) {
        stickId = null
        clearMove()
      }
      open = false
      root.remove()
    },
  }
}

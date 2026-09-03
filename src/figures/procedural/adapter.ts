import type { CreatedHero, Gait, HeroFrame } from '../types'
import { setAvatarOutline, tickAvatarAura } from '../kernel'
import { buildProceduralHero, type ProceduralRig, type ProceduralVariant } from './buildHero'
import { isProceduralKitId, type HeroKitId } from './kits'

const CAPS = { wardrobe: false, poses: false, jiggle: false } as const

export { isProceduralKitId } from './kits'
export type { HeroKitId } from './kits'
export type { ProceduralVariant } from './buildHero'

export type ProceduralFigureOpts = { variant?: ProceduralVariant }

export function createProceduralFigure(
  packId: string,
  opts: ProceduralFigureOpts = {},
): CreatedHero {
  if (!isProceduralKitId(packId)) {
    throw new Error(`procedural figure: unknown kit ${packId}`)
  }
  const kitId = packId as HeroKitId
  const variant = opts.variant ?? 'full'
  const rig = buildProceduralHero(kitId, { variant })
  const fit = rig.root
  fit.name = 'fit'

  const frame: HeroFrame = { height: rig.height, width: rig.width }
  let gait: Gait = 'idle'
  let t = 0
  let castT = -1

  const ready = Promise.resolve()

  return {
    figure: {
      id: kitId,
      root: fit,
      ready,
      capabilities: { ...CAPS },
      getFrame: () => frame,
      playGait: (g) => {
        // Bust has no legs — keep idle motion only.
        if (rig.variant === 'bust') {
          gait = 'idle'
          return
        }
        gait = g === 'run' ? 'walk' : g
      },
      playCast: () => {
        castT = 0
      },
      tick: (dt, beatPhase, audio) => {
        t += dt
        tickRig(rig, gait, t, castT)
        if (castT >= 0) {
          castT += dt
          if (castT > 0.35) castT = -1
        }
        tickAvatarAura(fit, dt, beatPhase, audio)
      },
      setOutline: (color, width) => setAvatarOutline(fit, color, width),
    },
  }
}

function tickRig(rig: ProceduralRig, gait: Gait, t: number, castT: number): void {
  const breathe = Math.sin(t * 2.2) * 0.012
  rig.torso.position.y = 0.95 + (gait === 'idle' ? breathe : Math.sin(t * 10) * 0.02)
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.08

  if (rig.variant === 'bust') {
    rig.leftArm.rotation.x = Math.sin(t * 1.5) * 0.05
    rig.rightArm.rotation.x = -Math.sin(t * 1.5) * 0.05
    if (castT >= 0) {
      const k = Math.sin(Math.min(1, castT / 0.2) * Math.PI)
      rig.rightArm.rotation.x = -0.8 * k
      rig.leftArm.rotation.x = -0.3 * k
    }
    return
  }

  if (gait === 'walk') {
    const swing = Math.sin(t * 9.5) * 0.55
    rig.leftThigh.rotation.x = swing
    rig.rightThigh.rotation.x = -swing
    rig.leftShin.rotation.x = Math.max(0, -swing) * 0.6
    rig.rightShin.rotation.x = Math.max(0, swing) * 0.6
    rig.leftArm.rotation.x = -swing * 0.7
    rig.rightArm.rotation.x = swing * 0.7
  } else {
    rig.leftThigh.rotation.x *= 0.85
    rig.rightThigh.rotation.x *= 0.85
    rig.leftShin.rotation.x *= 0.85
    rig.rightShin.rotation.x *= 0.85
    rig.leftArm.rotation.x = Math.sin(t * 1.5) * 0.04
    rig.rightArm.rotation.x = -Math.sin(t * 1.5) * 0.04
  }

  if (castT >= 0) {
    const k = Math.sin(Math.min(1, castT / 0.2) * Math.PI)
    rig.rightArm.rotation.x = -1.1 * k
    rig.leftArm.rotation.x = -0.4 * k
  }
}

import type { AudioClockPort } from '../shared/ports'
import { aabbOverlap, entityBox } from './math'
import { damageEnemy, hurtPlayer, runMagicWave, tickCraters, tickChains, tickSlashes } from './combat'
import { hitsObstacle } from './map'
import { hitEffectForKind } from './status'
import { outgoingMul } from './elemental'
import type { World } from './types'

export function tickProjectiles(w: World, dt: number, clock: AudioClockPort): void {
  for (const b of w.bullets) {
    b.x += b.vx * dt
    b.z += b.vz * dt
    b.life -= dt
    if (b.life > 0 && hitsObstacle(b.x, b.z, b.r, w.obstacles)) {
      b.life = 0
    }
  }

  tickSlashes(w, dt, clock)
  tickChains(w, dt)
  tickCraters(w, dt)

  for (const b of w.bullets) {
    if (!b.friendly || b.life <= 0) continue
    for (const e of w.enemies) {
      if (e.hp <= 0 || b.hit.has(e)) continue
      if (aabbOverlap(entityBox(b.x, b.z, b.r), entityBox(e.x, e.z, e.r))) {
        b.hit.add(e)
        const dist = Math.hypot(e.x - w.player.x, e.z - w.player.z)
        const hop = b.hit.size - 1
        damageEnemy(w, e, b.damage, clock, 0.7, 'orb', {
          elem: 'orb',
          ctx: {
            role: hop > 0 ? 'split' : 'primary',
            hop,
            targets: 1,
            dist,
            range: 8,
            special: hop > 0,
          },
        })
        runMagicWave(w, clock, [e], { dmg: b.damage, originX: e.x, originZ: e.z })
        if (b.pierce > 0) b.pierce -= 1
        else b.life = 0
        break
      }
    }
  }

  if (w.player.invuln <= 0) {
    const pb = entityBox(w.player.x, w.player.z, w.player.r * 0.85)
    for (const b of w.bullets) {
      if (b.friendly || b.life <= 0) continue
      if (aabbOverlap(pb, entityBox(b.x, b.z, b.r))) {
        hurtPlayer(w, clock, b.hitFx, b.dmgMul ?? 1)
        b.life = 0
        break
      }
    }
    if (w.player.invuln <= 0) {
      for (const e of w.enemies) {
        if (e.hp <= 0 || e.kind === 'chest') continue
        if (aabbOverlap(pb, entityBox(e.x, e.z, e.r))) {
          hurtPlayer(w, clock, hitEffectForKind(e.kind, 'contact'), outgoingMul(e))
          break
        }
      }
    }
  }

  w.enemies = w.enemies.filter((e) => e.hp > 0)
  w.bullets = w.bullets.filter((b) => b.life > 0)
}

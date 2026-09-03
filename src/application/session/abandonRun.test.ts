import { describe, expect, it } from 'vitest'
import { createWorld } from '../../domain/combat'
import { abandonRun } from './abandonRun'
import { createSessionState } from './types'
import type { SessionIO } from './types'

describe('abandonRun', () => {
  it('queues a loss result fade and banks score', () => {
    const s = createSessionState({
      characterId: 'vie',
      weaponId: 'martial_wind',
      starterId: 'flame',
      trackIndex: 0,
      track: { id: 't', title: 't', artist: 'a', source: 'json', url: '' },
      hubThemeId: 'studio',
      figureId: 'vie',
    })
    s.scene = 'play'
    s.world = createWorld({ wave: 2, upgrades: [] })
    s.world.stats.score = 120
    s.world.stats.kills = 7
    let banked = false
    const io = {
      setTuneOpen: () => {},
      goResult: () => {
        banked = true
      },
    } as unknown as SessionIO

    abandonRun(s, io)

    expect(s.paused).toBe(false)
    expect(s.runScore).toBe(120)
    expect(s.runKills).toBe(7)
    expect(s.fadeTx?.action).toBe('result')
    expect(s.fadeTx?.won).toBe(false)
    expect(banked).toBe(false)
  })
})

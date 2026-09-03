/**
 * 刷怪时段 / 密度 / 种类底数。
 * 引擎读表；AI 行为仍在 domain/combat/spawn.ts。
 */

export type SpawnFodderKind =
  | 'chaser'
  | 'shooter'
  | 'brute'
  | 'spitter'
  | 'frost'
  | 'leech'

export type SpawnPhaseId = 'intro' | 'build' | 'spice' | 'pressure' | 'boss'

export type SpawnPhaseCfg = {
  id: SpawnPhaseId
  /** 曲进度 [0,1) 上界（boss 阶段由存活覆盖）。 */
  until: number
  maxBase: number
  maxPerWave: number
  /** 越大刷得越慢。 */
  rateMul: number
  packIdle: number
  packBusy: number
  elite: boolean
  eliteEvery: number
  weights: Partial<Record<SpawnFodderKind, number>>
}

export const SPAWN_TIMING = {
  openSec: 2.4,
  eliteFirstSec: 12,
  bossAtSec: 78,
  bossEarliestSec: 52,
  bossMinLevelEarly: 2,
  bossProgressFrac: 0.55,
  eliteProgressMin: 0.18,
  /** Boss 出场前至少留这么久给首只精英落地。 */
  eliteBeforeBossSec: 10,
  endPadSec: 0.8,
  /** 宝箱：关卡时间 1/2～2/3 才出现，远处要自己找。 */
  chestProgressMin: 0.5,
  chestProgressMax: 2 / 3,
  chestMinPlayerDist: 18,
  chestRimMin: 0.58,
  chestRimMax: 0.9,
} as const

export const SPAWN_RATE = {
  base: 0.42,
  perWave: 0.035,
  min: 0.1,
  emptyMul: 0.28,
  criticalMul: 0.42,
  depletedMul: 0.62,
} as const

export const SPAWN_DENSITY = {
  softTargetFrac: 0.52,
  trashTargetFrac: 0.4,
  criticalFloorFrac: 0.24,
  meatCapFrac: 0.16,
  meatCapMaxEarly: 16,
  meatCapMaxLate: 24,
  meatCapWaveGate: 5,
} as const

/** 小兵优先野外营地；身周只在场上饿了才补。 */
export const SPAWN_PLACE = {
  /** 出生盘（和天气一样空着）。 */
  spawnDiskR: 4.8,
  /** 任何刷点离玩家至少这么远。 */
  safeR: 11,
  /** 场上饿了：身周补刷圈。 */
  pressureMin: 11,
  pressureMax: 16.5,
  /** 野外营地：出镜头边缘到场地外沿。 */
  wildMin: 16,
  wildMaxFrac: 0.9,
  campJitter: 2.7,
  foeSep: 1.4,
  terrainBias: 0.68,
} as const

/** 种类最早可进权重的波次。 */
export const FODDER_UNLOCK_WAVE: Partial<Record<SpawnFodderKind, number>> = {
  frost: 2,
  spitter: 2,
  brute: 2,
  leech: 3,
}

export const PREFER_TRASH_WEIGHT = {
  chaser: 3.2,
  shooter: 3.2,
  leech: 1.4,
  other: 0.7,
} as const

export type FodderKindRule = {
  hpMul: number
  r: number
  role: 'trash' | 'tank'
  speedBase: number
  speedPerWave: number
  /** 固定 CD；有则忽略 shoot* 曲线。 */
  shootCdFixed?: number
  shootCdBase?: number
  shootCdPerWave?: number
  shootCdMin?: number
  shootCdJitter?: number
  /** 仅 jitter、无曲线时的基线（brute/chaser）。 */
  shootCdIdleBase?: number
  shootCdIdleJitter?: number
}

export const FODDER_KINDS: Record<SpawnFodderKind, FodderKindRule> = {
  frost: {
    hpMul: 1.5,
    r: 0.28,
    role: 'trash',
    speedBase: 2.45,
    speedPerWave: 0.1,
    shootCdBase: 1.05,
    shootCdPerWave: 0.02,
    shootCdMin: 0.7,
    shootCdJitter: 0.4,
  },
  spitter: {
    hpMul: 1.25,
    r: 0.27,
    role: 'trash',
    speedBase: 2.55,
    speedPerWave: 0.1,
    shootCdBase: 0.95,
    shootCdPerWave: 0.02,
    shootCdMin: 0.65,
    shootCdJitter: 0.4,
  },
  leech: {
    hpMul: 1.55,
    r: 0.32,
    role: 'trash',
    speedBase: 3.85,
    speedPerWave: 0.16,
    shootCdFixed: 99,
  },
  brute: {
    hpMul: 6.4,
    r: 0.48,
    role: 'tank',
    speedBase: 1.45,
    speedPerWave: 0.035,
    shootCdIdleBase: 0.35,
    shootCdIdleJitter: 0.7,
  },
  shooter: {
    hpMul: 1.05,
    r: 0.26,
    role: 'trash',
    speedBase: 2.75,
    speedPerWave: 0.12,
    shootCdBase: 1.1,
    shootCdPerWave: 0.02,
    shootCdMin: 0.7,
    shootCdJitter: 0.45,
  },
  chaser: {
    hpMul: 1,
    r: 0.28,
    role: 'trash',
    speedBase: 3.55,
    speedPerWave: 0.16,
    shootCdIdleBase: 0.35,
    shootCdIdleJitter: 0.7,
  },
}

export const SPAWN_PHASES: SpawnPhaseCfg[] = [
  {
    id: 'intro',
    until: 0.32,
    maxBase: 64,
    maxPerWave: 8,
    rateMul: 1.05,
    packIdle: 16,
    packBusy: 24,
    elite: false,
    eliteEvery: 99,
    weights: { chaser: 1 },
  },
  {
    id: 'build',
    until: 0.5,
    maxBase: 80,
    maxPerWave: 16,
    rateMul: 0.95,
    packIdle: 16,
    packBusy: 24,
    elite: true,
    eliteEvery: 24,
    weights: { chaser: 0.72, shooter: 0.28 },
  },
  {
    id: 'spice',
    until: 0.7,
    maxBase: 104,
    maxPerWave: 16,
    rateMul: 0.85,
    packIdle: 16,
    packBusy: 24,
    elite: true,
    eliteEvery: 22,
    weights: {
      chaser: 0.5,
      shooter: 0.28,
      brute: 0.08,
      frost: 0.08,
      spitter: 0.06,
    },
  },
  {
    id: 'pressure',
    until: 1,
    maxBase: 120,
    maxPerWave: 24,
    rateMul: 0.78,
    packIdle: 16,
    packBusy: 24,
    elite: true,
    eliteEvery: 16,
    weights: {
      chaser: 0.4,
      shooter: 0.22,
      brute: 0.08,
      frost: 0.12,
      spitter: 0.1,
      leech: 0.08,
    },
  },
]

export const BOSS_SPAWN_PHASE: SpawnPhaseCfg = {
  id: 'boss',
  until: 1,
  maxBase: 72,
  maxPerWave: 16,
  rateMul: 1.1,
  packIdle: 16,
  packBusy: 16,
  elite: false,
  eliteEvery: 99,
  weights: {
    chaser: 0.55,
    shooter: 0.25,
    brute: 0.05,
    frost: 0.08,
    spitter: 0.07,
  },
}

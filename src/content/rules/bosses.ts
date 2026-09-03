/** Boss 表（按标准波 1–5 循环；无限取模）+ 招式数字。 */

export type BossRuleId = 'warden' | 'caller' | 'hex' | 'choir' | 'tyrant'

export type BossTeleId = 'ring' | 'cross' | 'dash' | 'summon' | 'fan' | 'phase'

export type BossFanShot = {
  shots: number
  spread: number
  spdMul: number
  r: number
  cdBase: number
  cdJitter: number
}

export type BossRingShot = {
  count: number
  spdMul: number
  r: number
}

/** 共享弹速 / 弹寿命。 */
export const BOSS_SHOT = {
  spdBase: 5.4,
  spdPerWave: 0.22,
  ringLife: 2.8,
  crossLife: 2.6,
  crossR: 0.16,
} as const

/**
 * 招式数字总表：行为顺序仍在 domain，改手感改这里。
 * 各 Boss 用到的字段不同，未用字段可缺省。
 */
export type BossSkillDef = {
  chaseMul: number
  /** 暴君狂暴后追击倍率。 */
  chaseMulRage?: number
  basicFan?: BossFanShot
  basicCross?: { spdMul: number; cdBase: number; cdJitter: number }
  /** 监守 / 号手 / 镜咒 / 暴君常态的主特殊。 */
  special?: {
    windup: number
    hint: string
    tele: BossTeleId
    aiCd: number
    ring?: BossRingShot
    crossSpdMul?: number
    fan?: Omit<BossFanShot, 'cdBase' | 'cdJitter'>
    summon?: {
      addBase: number
      /** wave >= 此值时多 1 只。 */
      addExtraFromWave: number
      roomBase: number
      roomPerWave: number
      addHpMul: number
      addSpeedBase: number
      addSpeedPerWave: number
    }
  }
  /** 铁律：环 ↔ 冲交替。 */
  choir?: {
    ringWindup: number
    ringHint: string
    ring: BossRingShot
    dashWindup: number
    dashHint: string
    dashSpeedBase: number
    dashSpeedPerWave: number
    dashDuration: number
    dashFan: Omit<BossFanShot, 'cdBase' | 'cdJitter'>
    recoverCdBase: number
    recoverCdJitter: number
  }
  /** 暴君半血。 */
  tyrant?: {
    phaseHpFrac: number
    phaseSpeedMul: number
    phaseWindup: number
    phaseHint: string
    phaseShootCd: number
    phaseAiCd: number
    phaseBurstRing: BossRingShot
    phaseBurstFan: Omit<BossFanShot, 'cdBase' | 'cdJitter'>
    phaseBurstShootCd: number
    phaseBurstAiCd: number
    rageSpinBase: number
    rageSpinPerWave: number
    rageSpiralShots: number
    rageSpiralSpdMul: number
    rageSpiralR: number
    rageSpiralLife: number
    rageSpiralCd: number
    rageFanWindup: number
    rageFanHint: string
    rageFan: Omit<BossFanShot, 'cdBase' | 'cdJitter'>
    rageFanAiCd: number
  }
}

export type BossRuleDef = {
  id: BossRuleId
  name: string
  /** 相对 fodderHp(wave)。 */
  hpMul: number
  r: number
  speed: number
  shootCd0: number
  skills: BossSkillDef
}

const WARDEN_SKILLS: BossSkillDef = {
  chaseMul: 1,
  basicFan: { shots: 3, spread: 0.38, spdMul: 1, r: 0.16, cdBase: 1.15, cdJitter: 0.25 },
  special: {
    windup: 0.9,
    hint: '脉冲环 · 走开',
    tele: 'ring',
    aiCd: 4.0,
    ring: { count: 10, spdMul: 0.68, r: 0.15 },
  },
}

const CALLER_SKILLS: BossSkillDef = {
  chaseMul: 0.75,
  basicFan: { shots: 2, spread: 0.26, spdMul: 1.05, r: 0.15, cdBase: 1.25, cdJitter: 0.3 },
  special: {
    windup: 0.75,
    hint: '清增援优先',
    tele: 'summon',
    aiCd: 5.0,
    summon: {
      addBase: 2,
      addExtraFromWave: 2,
      roomBase: 14,
      roomPerWave: 3,
      addHpMul: 0.85,
      addSpeedBase: 3.9,
      addSpeedPerWave: 0.18,
    },
  },
}

const HEX_SKILLS: BossSkillDef = {
  chaseMul: 0.55,
  basicCross: { spdMul: 0.95, cdBase: 1.35, cdJitter: 0.25 },
  special: {
    windup: 0.85,
    hint: '闪现 · 预判落点',
    tele: 'cross',
    aiCd: 5.5,
    crossSpdMul: 0.85,
  },
}

const CHOIR_SKILLS: BossSkillDef = {
  chaseMul: 1,
  choir: {
    ringWindup: 0.8,
    ringHint: '全环弹幕',
    ring: { count: 12, spdMul: 0.72, r: 0.16 },
    dashWindup: 0.7,
    dashHint: '冲锋 · 侧闪',
    dashSpeedBase: 9.5,
    dashSpeedPerWave: 0.4,
    dashDuration: 0.55,
    dashFan: { shots: 3, spread: 0.28, spdMul: 1, r: 0.15 },
    recoverCdBase: 3.4,
    recoverCdJitter: 0.35,
  },
}

const TYRANT_SKILLS: BossSkillDef = {
  chaseMul: 1,
  chaseMulRage: 1.25,
  basicFan: { shots: 5, spread: 0.5, spdMul: 0.92, r: 0.17, cdBase: 0.95, cdJitter: 0.25 },
  special: {
    windup: 0.85,
    hint: '脉冲环 · 走开',
    tele: 'ring',
    aiCd: 4.5,
    ring: { count: 12, spdMul: 0.66, r: 0.16 },
  },
  tyrant: {
    phaseHpFrac: 0.5,
    phaseSpeedMul: 1.22,
    phaseWindup: 1.05,
    phaseHint: '半血狂暴',
    phaseShootCd: 0.9,
    phaseAiCd: 1.6,
    phaseBurstRing: { count: 16, spdMul: 0.82, r: 0.18 },
    phaseBurstFan: { shots: 5, spread: 0.5, spdMul: 1, r: 0.17 },
    phaseBurstShootCd: 0.45,
    phaseBurstAiCd: 2.2,
    rageSpinBase: 2.4,
    rageSpinPerWave: 0.15,
    rageSpiralShots: 3,
    rageSpiralSpdMul: 0.9,
    rageSpiralR: 0.16,
    rageSpiralLife: 3.4,
    rageSpiralCd: 0.22,
    rageFanWindup: 0.65,
    rageFanHint: '扇射',
    rageFan: { shots: 5, spread: 0.5, spdMul: 1, r: 0.17 },
    rageFanAiCd: 2.8,
  },
}

/** 键为标准波序号 1–5。 */
export const BOSS_BY_WAVE: Record<number, BossRuleDef> = {
  1: {
    id: 'warden',
    name: '节拍监守',
    hpMul: 20,
    r: 0.68,
    speed: 1.75,
    shootCd0: 1.2,
    skills: WARDEN_SKILLS,
  },
  2: {
    id: 'caller',
    name: '猎群号手',
    hpMul: 23,
    r: 0.7,
    speed: 2.1,
    shootCd0: 1.3,
    skills: CALLER_SKILLS,
  },
  3: {
    id: 'hex',
    name: '镜咒法师',
    hpMul: 21,
    r: 0.62,
    speed: 1.35,
    shootCd0: 1.0,
    skills: HEX_SKILLS,
  },
  4: {
    id: 'choir',
    name: '铁律合唱',
    hpMul: 30,
    r: 0.78,
    speed: 1.65,
    shootCd0: 3.2,
    skills: CHOIR_SKILLS,
  },
  5: {
    id: 'tyrant',
    name: '终曲暴君',
    hpMul: 36,
    r: 0.82,
    speed: 2.05,
    shootCd0: 0.95,
    skills: TYRANT_SKILLS,
  },
}

export const BOSS_CYCLE = 5

/** 按 id 取招式（Boss 实例也可走 meta.boss.skills）。 */
export function bossSkillsFor(id: BossRuleId): BossSkillDef {
  for (const d of Object.values(BOSS_BY_WAVE)) {
    if (d.id === id) return d.skills
  }
  return WARDEN_SKILLS
}

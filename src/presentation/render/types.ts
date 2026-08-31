import type { JudgeResult } from '../../domain/rhythm/judge'
import type { UpgradeOffer } from '../../domain/progression/upgrades'
import type { HighwayNoteView } from '../../domain/rhythm/chart'
import type { HubThemeId } from '../../content/hubThemes'

export type SceneKind = 'title' | 'closet' | 'options' | 'shop' | 'prep' | 'play' | 'pick' | 'result'

/** 出发屏焦点行。WASD 移动，Enter 确认/勾选。 */
export type PrepFocus = 'mode' | 'track' | 'starter' | 'blessing' | 'contract' | 'go'

export type HudWeapon = {
  id: string
  name: string
  glyph: string
  /** 拍点只强化这一门 */
  beat: boolean
  /** 已解锁的空魔法槽 */
  empty?: boolean
  /** 0 = 就绪 · 1 = 刚进入冷却（剩余比例） */
  cd?: number
}

export type HudUpgrade = {
  id: string
  name: string
  grade: number
  kind: 'stat' | 'special'
  label: string
}

export type FrameSnapshot = {
  scene: SceneKind
  arenaHalf: number
  player: {
    x: number
    z: number
    r: number
    hp: number
    maxHp: number
    invuln: number
    /** 0..1 hit-feedback intensity. */
    hurtFlash: number
    /** Facing yaw around Y (radians). */
    yaw: number
    /** WASD or dash this tick. */
    moving: boolean
    slowT: number
    poisonT: number
    bleedT: number
    shieldOn: boolean
    /** Increments when a fireball is spawned. */
    castSeq: number
  }
    enemies: {
    x: number
    z: number
    r: number
    kind: string
    bossId?: string
    hurtFlash: number
    hpRatio: number
    frozen?: boolean
    bleed?: boolean
    amped?: boolean
    broken?: boolean
    weak?: boolean
  }[]
  pickups: { x: number; z: number; kind: 'gold' | 'xp' | 'relic_minor' | 'relic_major' }[]
  obstacles: { x: number; z: number; w: number; d: number; h: number; kind: string }[]
  terrain: { x: number; z: number; w: number; d: number; kind: string }[]
  bullets: { x: number; z: number; r: number; friendly: boolean }[]
  slashes: {
    x: number
    z: number
    dirX: number
    dirZ: number
    radius: number
    halfAngle: number
    lifeRatio: number
  }[]
  craters: { x: number; z: number; r: number; lifeRatio: number; style?: 'earth' | 'fire' }[]
  aura: { radius: number; pulse: number } | null
  orbit: { blades: { x: number; z: number }[]; pulse: number } | null
  chains: { ax: number; az: number; bx: number; bz: number; lifeRatio: number }[]
  pops: { x: number; z: number; kind: 'split'; lifeRatio: number }[]
  floaters: {
    x: number
    z: number
    amount: number
    kind: string
    kill: boolean
    crit: boolean
    lifeRatio: number
    drift: number
  }[]
  heat: number
  heatMax: number
  mult: number
  score: number
  gold: number
  wave: number
  waveProgress: number
  level: number
  xp: number
  xpToNext: number
  xpProgress: number
  levelFlash: boolean
  beatPhase: number
  /**
   * Live music FFT 0..1, mirrored `[low→high, high→low]` for circular layout (len 128).
   * Empty / zeros when silent.
   */
  audioSpectrum: Float32Array
  /** 0..1 bass / mid / overall from analyser. */
  audioBass: number
  audioMid: number
  audioEnergy: number
  beatFlash: JudgeResult | null
  combo: number
  /** 0..1 punch after a hit. */
  comboFlash: number
  /** 0..1 red after a break. */
  comboBreak: number
  comboMilestone: number | null
  /** Damage multiplier from combo (1..1.75). */
  comboMul: number
  fever: number
  feverMax: number
  feverFlash: number
  /** Fever auto-perfect window. */
  feverActive: boolean
  /** Seconds left in the Fever window (0 if inactive). */
  feverRemain: number
  /** 0..1 remaining cooldown after crash (0 = ready). */
  feverCooldown: number
  timingHint: 'early' | 'late' | null
  pickReason: 'wave' | 'level' | 'drop_minor' | 'drop_major' | 'chest' | null
  starterId: string
  starterName: string
  weapons: HudWeapon[]
  upgrades: HudUpgrade[]
  kills: number
  maxCombo: number
  eliteAlive: boolean
  /** 精英刚出场的地面预告（1→0）。 */
  eliteTele: { x: number; z: number; progress: number } | null
  bossAlive: boolean
  boss: {
    hp: number
    maxHp: number
    name: string
    id: string
    windup: boolean
    phase: number
    teleKind: 'ring' | 'cross' | 'dash' | 'summon' | 'fan' | 'phase' | null
    /** 1 = windup just started → 0 = about to fire */
    teleProgress: number
    x: number
    z: number
    yaw: number
  } | null
  /** Full rhythm highway overlay */
  highway: {
    visible: boolean
    labels: string[]
    notes: HighwayNoteView[]
    songTitle: string
    songProgress: number
    /** 0..1 pulse from last judge. */
    judgePulse: number
    judgeResult: JudgeResult | null
    judgeLane: number
    /** Bumps each judge for VFX. */
    judgeSeq: number
    /** early/late from last hit (mirrors snapshot for highway overlay). */
    timingHint: 'early' | 'late' | null
  }
  offer: UpgradeOffer[] | null
  luck: number
  /** 0..0.5 player DR */
  armorDr: number
  /** 0..0.5 dodge chance */
  dodgeChance: number
  weatherName: string
  weatherBlurb: string
  carapaceStacks: number
  relics: string[]
  /** 出发选定的本局结构。 */
  runMode: 'standard' | 'endless'
  result: {
    won: boolean
    score: number
    kills: number
    maxCombo: number
    banked: number
    waves: number
  } | null
  hint: string
  hubIndex: number
  /** Hub cards for this figure (closet omitted when no wardrobe). */
  hubRows: { name: string; blurb: string }[]
  /** Title backdrop; closet always uses studio lighting. */
  hubThemeId: HubThemeId
  hubThemeName: string
  hubThemeBlurb: string
  optionsRow: number
  /** Shop: selected goods row. */
  shopIndex: number
  /** 出发屏当前行。 */
  prepFocus: PrepFocus
  /** 出发屏当前契约芯片。 */
  prepContractIndex: number
  musicGain: number
  sfxGain: number
  purse: number
  blessingName: string
  /** Prep: 双修所选第二门名；非双修为空。 */
  duoLearnName: string
  duoStarterId: string
  /** Prep: 已勾契约。 */
  contractRows: {
    key: string
    name: string
    blurb: string
    on: boolean
    bankMul: number
  }[]
  contractMul: number
  /** 契约哑火：Fever 键锁死。 */
  feverMute: boolean
  /** 契约素打：拍点不加成。 */
  beatMute: boolean
  shopRows: {
    name: string
    blurb: string
    price: number
    status: 'ok' | 'poor' | 'owned' | 'max'
  }[]
  /** 0 = clear, 1 = full black (wave transition). */
  fadeBlack: number
}

export interface Renderer {
  resize(): void
  draw(snap: FrameSnapshot): void
  /** Closet scene panel; only when the active figure has wardrobe. */
  wardrobe?: import('../../wardrobe/preview').WardrobeApi
  /** Active hero pack caps (hub hides closet when wardrobe is false). */
  heroCaps?: import('../../figures').HeroCaps
}

import type { CharacterId } from '../../content/characters'
import type { KitId } from '../../content/kits'
import type { MagicId, MartialId, StarterId } from '../../content/weapons'
import type { GraftTrait } from '../../content/fusions'
import type { WeatherId, TerrainKind } from '../../content/weather'
import type { HintKind } from '../../content/rules'
import type { UpgradeOffer, OwnedUpgrade } from '../progression/upgrades'
import type { MetaLoadoutMods } from '../progression/meta'
import type { DomainEvent } from '../shared/events'
import type { HeatConfig } from './heat'
import type { RunMode } from './arena'
import type { JudgeResult } from '../rhythm/judge'
import type { Obstacle } from './map'
import type { EnemyMeta } from './enemyMeta'
import type { BulletMeta } from './bulletMeta'
import type { SlashMeta } from './slashMeta'
import type { CraterMeta } from './craterMeta'
import type { ChainMeta } from './chainMeta'
import type { PickupMeta } from '../progression/pickupMeta'

export type { Obstacle } from './map'
export type { EnemyMeta, EnemyRole } from './enemyMeta'
export type { BulletMeta, BulletSource } from './bulletMeta'
export type { SlashMeta } from './slashMeta'
export type { CraterMeta, CraterSource } from './craterMeta'
export type { ChainMeta, ChainSource } from './chainMeta'
export type { PickupMeta, PickupKind } from '../progression/pickupMeta'

export type TerrainPatch = {
  x: number
  z: number
  w: number
  d: number
  kind: TerrainKind
}

export type BossId = 'warden' | 'caller' | 'hex' | 'choir' | 'tyrant'

export type EnemyKind =
  | 'chaser'
  | 'shooter'
  | 'brute'
  | 'spitter'
  | 'frost'
  | 'leech'
  | 'elite'
  | 'boss'
  /** 每波场上宝箱：可击碎，掉三选一。 */
  | 'chest'

/** Debuffs applied when the player is hit. */
export type HitEffect = {
  slowT?: number
  /** Multiplier while slowed (e.g. 0.5). */
  slowMul?: number
  poisonT?: number
  poisonDps?: number
  bleedT?: number
  bleedDps?: number
}

export type Bullet = {
  x: number
  z: number
  vx: number
  vz: number
  life: number
  damage: number
  /** Extra enemies this bullet may pass through after the first. */
  pierce: number
  friendly: boolean
  r: number
  /** Meta 指针：来源 / 火球底表。 */
  meta: BulletMeta
  /** Enemies already damaged by this bullet (prevents multi-hit while overlapping). */
  hit: Set<Enemy>
  /** Status applied to the player on hit (foe bullets). */
  hitFx?: HitEffect
  /** Foe bullets: outgoing damage scale (虚弱). */
  dmgMul?: number
}

export type ElemSource = 'flame' | 'orb' | 'aura' | 'chain' | 'star'

export type Enemy = {
  x: number
  z: number
  hp: number
  maxHp: number
  r: number
  speed: number
  shootCd: number
  kind: EnemyKind
  /** Meta 指针：护甲底 / fodder 表 / boss 表。取数走 meta，别抄表。 */
  meta: EnemyMeta
  /** Seconds left of hit flash. */
  hurtFlash: number
  /** 护甲减伤 0..1 */
  armor: number
  slowT: number
  slowMul: number
  freezeT: number
  ampT: number
  breakT: number
  weakT: number
  explodeLockT: number
  elemStacks: Record<ElemSource, number>
  /** Wave boss archetype (only when kind=boss). */
  bossId?: BossId
  /** Boss AI cooldown (special). */
  aiCd: number
  /** Boss phase / pattern index. */
  aiPhase: number
  /** Boss special telegraph remaining (0 = idle). */
  windupT: number
  /** Initial windup length (for telegraph progress). */
  windupMax: number
  /** Telegraph shape while winding up. */
  windupKind: BossTeleKind | null
  dashT: number
  dashVx: number
  dashVz: number
  /** 风息 / 融合击退剩余滑移。 */
  knockT: number
  knockVx: number
  knockVz: number
  /** Tyrant spiral angle. */
  spin: number
  /** Wave-scaled outgoing attack multiplier (bullets / contact). */
  atkMul: number
}

export type BossTeleKind = 'ring' | 'cross' | 'dash' | 'summon' | 'fan' | 'phase'

export type GroundPickup = {
  id: number
  x: number
  z: number
  kind: 'gold' | 'xp' | 'relic_minor' | 'relic_major'
  /** Meta 指针：寿命 / 磁铁倍率。 */
  meta: PickupMeta
  /** Gold / XP amount when kind is gold or xp */
  amount: number
  life: number
}

export type Player = {
  x: number
  z: number
  hp: number
  maxHp: number
  r: number
  speed: number
  fireCd: number
  meleeCd: number
  auraCd: number
  chainCd: number
  starCd: number
  /** Flame/aura crit anti-strobe. */
  tickCritLock: number
  invuln: number
  /** Seconds left of hit-feedback juice (flash / shake). */
  hurtFlash: number
  /** Facing on XZ (unit). */
  facingX: number
  facingZ: number
  /** Movement slow remaining. */
  slowT: number
  slowMul: number
  poisonT: number
  poisonDps: number
  poisonAcc: number
  bleedT: number
  bleedDps: number
  bleedAcc: number
  /** Fractional incoming HP from 虚弱 hits. */
  hurtAcc: number
  /** 位移闪避剩余冲刺时间。 */
  dashT: number
  dashCd: number
  dashVx: number
  dashVz: number
  lastMoveX: number
  lastMoveZ: number
  /** True this tick if WASD or dash. */
  moving: boolean
  /** 冰面惯性。 */
  iceVx: number
  iceVz: number
  /** 焰地 DoT accumulator. */
  burnAcc: number
  /** 遗物护盾：当前是否有一层。 */
  shieldOn: boolean
  shieldCd: number
  /** 吸血池。 */
  leechBank: number
  /** Bumps when a fireball leaves the player; renderer plays cast. */
  castSeq: number
}

export type Slash = {
  x: number
  z: number
  dirX: number
  dirZ: number
  radius: number
  halfAngle: number
  life: number
  maxLife: number
  damage: number
  /** Meta 指针：武表（风息）。 */
  meta: SlashMeta
  hit: Set<Enemy>
}

export type DamageKind = 'slash' | 'flame' | 'orb' | 'aura' | 'chain' | 'star' | 'fever' | 'hit'

export type DamageFloater = {
  x: number
  z: number
  amount: number
  kind: DamageKind
  kill: boolean
  crit: boolean
  life: number
  maxLife: number
  /** -1..1 sideways jitter so stacked hits don't overlap. */
  drift: number
}

export type Crater = {
  x: number
  z: number
  r: number
  life: number
  maxLife: number
  damage: number
  tickCd: number
  /** Meta 指针：落岩 / 火球爆炸。 */
  meta: CraterMeta
  /** 落岩落点 vs 火元素爆炸（与 meta.style 同源，给渲染用）。 */
  style?: 'earth' | 'fire'
}

export type FxPop = {
  x: number
  z: number
  kind: 'split' | 'knock' | 'emerge' | 'volley'
  dirX?: number
  dirZ?: number
  life: number
  maxLife: number
}

export type ChainBolt = {
  ax: number
  az: number
  bx: number
  bz: number
  life: number
  maxLife: number
  /** 0 = 从玩家出去的第一段。 */
  hop: number
  /** Meta 指针：雷链表。 */
  meta: ChainMeta
}

export type WorldStats = {
  score: number
  kills: number
  wave: number
  heat: number
  mult: number
  beatFlash: JudgeResult | null
  beatFlashT: number
  /** Rhythm combo (soft-breaks on miss). */
  combo: number
  maxCombo: number
  /** 0..feverMax; fills toward Fever window. */
  fever: number
  feverMax: number
  /** Brief FEVER burst VFX. */
  feverFlashT: number
  /** >0 = Fever window (auto-perfect). */
  feverActiveT: number
  /** Duration when Fever started (for HUD drain). */
  feverActiveMax: number
  /** After Fever ends: cannot refill until this elapses. */
  feverCooldownT: number
  /** early | late | null from last hit. */
  timingHint: 'early' | 'late' | null
  timingHintT: number
  /** Pop the combo numeral (seconds). */
  comboFlashT: number
  /** Red flash after a soft-break (seconds). */
  comboBreakT: number
  /** Last crossed milestone (10/25/50/100) while the callout lives. */
  comboMilestone: number | null
  comboMilestoneT: number
  level: number
  xp: number
  xpToNext: number
  pendingLevelUps: number
  /** Brief HUD “LEVEL UP” flash. */
  levelFlashT: number
  gold: number
}

/** Resolved combat numbers after character + martial + magics + upgrades. */
export type Loadout = {
  characterId: CharacterId
  kitId: KitId
  martialId: MartialId
  starterId: StarterId
  /** False if this run didn't start with / learn 风息. */
  hasFlame: boolean
  magicIds: MagicId[]
  meleeRange: number
  meleeHalfAngle: number
  meleeDamage: number
  meleeInterval: number
  meleeLife: number
  beatMeleeMul: number
  /** 发球；未习得则为 null */
  orb: {
    interval: number
    damage: number
    speed: number
    life: number
    radius: number
    count: number
    beatMul: number
  } | null
  /** 霜环 */
  aura: {
    radius: number
    damage: number
    tickInterval: number
    beatMul: number
  } | null
  /** 连锁 */
  chain: {
    range: number
    jumps: number
    jumpRange: number
    damage: number
    interval: number
    beatMul: number
  } | null
  star: {
    interval: number
    damage: number
    craterR: number
    craterLife: number
    range: number
    beatMul: number
    maxCraters: number
  } | null
  spreadExtra: number
  pierce: number
  beatBonus: number
  moveSpeed: number
  maxHp: number
  radius: number
  /** Global outgoing damage multiplier from upgrades. */
  damageMul: number
  /** <1 = faster cooldowns for melee/orb/aura/chain. */
  hasteMul: number
  /** HP restored per second while below max. */
  hpRegen: number
  /** Luck from upgrades; raises high-grade roll odds. */
  luck: number
  /** 0..0.5 incoming damage reduction. */
  armorDr: number
  /** 0..0.5 dodge chance on hit. */
  dodgeChance: number
  /** Fever gauge fill multiplier (blessing 热血 × 热槽，有顶). */
  feverGainMul: number
  feverActiveSec: number
  judgePerfectWin: number
  judgeGoodWin: number
  /** Miss 后保留的连击比例（默认 0.5 = 砍半）. */
  comboBreakKeep: number
  comboDmgCap: number
  /** 契约「哑火」：Fever 键锁死。 */
  muteFever: boolean
  /** 契约「素打」：拍点不加成。 */
  muteBeat: boolean
  /** 契约「盲抽」：三选随机，不能挑。 */
  wildPick: boolean
  /** 0..0.5 */
  critChance: number
  /** Multiplier when a hit crits (default 1.5). */
  critDamage: number
  /** XP multiplier (cap 1.6). */
  xpMul: number
  /** Gold magnet pull radius. */
  magnetR: number
  /** 商店自动拾取：全场吸入，不用踩上去。 */
  autoPickup: boolean
  /** Kit 受伤掉热倍率。 */
  hurtHeatMul: number
  /** 风息出门击退；专精加推远；融合嫁接也可带。 */
  knockback: number
  /** 火球出门分裂代数（人数）；融合嫁接分裂也走这里。 */
  splitN: number
  splitR: number
  /** CD 转好出手几次。落岩专精 / 融合落岩加。 */
  casts: number
  /** 霜环出门减速（乘子 <1）；融合嫁接减速也用。 */
  auraSlowMul: number
  auraSlowT: number
  /** 人物施法距离 / 范围总乘（落点、弹跳吃范围）。 */
  castReachMul: number
  castAreaMul: number
  /** 主手自身 + 已融，按融合顺序。一次施法按此表跑特效轮。 */
  effectOrder: GraftTrait[]
  /** 融合嫁接的传打旗标。 */
  graft: {
    split: boolean
    bounce: boolean
    slow: boolean
    knockback: boolean
    volley: boolean
  }
  /** 本局已融进主手的副手。 */
  fusedOffhands: StarterId[]
  /** 关末元素伤：没拿不记账。 */
  elem: Record<ElemSource, boolean>
  heatCfg: HeatConfig
}

export type World = {
  arena: { half: number }
  player: Player
  enemies: Enemy[]
  bullets: Bullet[]
  slashes: Slash[]
  craters: Crater[]
  chains: ChainBolt[]
  fxPops: FxPop[]
  /** 风息 Perfect 视觉灌油；不改自动锥的伤害范围。 */
  flameBoostT: number
  pickups: GroundPickup[]
  floaters: DamageFloater[]
  /** 0..n seconds of aura flash remaining. */
  auraPulseT: number
  obstacles: Obstacle[]
  /** 本波天气；一波内按曲进度轮换。 */
  weatherId: WeatherId
  /** createWorld 的局种子，切天气时重铺地形。 */
  fieldSeed: number
  weatherCycle: WeatherId[]
  weatherSlot: number
  windX: number
  windZ: number
  terrain: TerrainPatch[]
  stats: WorldStats
  loadout: Loadout
  upgrades: OwnedUpgrade[]
  waveTime: number
  waveDuration: number
  spawnCd: number
  eliteCd: number
  /** 本波是否已生成过精英（含预告落地）。 */
  eliteSpawned: boolean
  bossSpawned: boolean
  /** 本波宝箱落地时刻（曲进度 1/2～2/3）。 */
  chestAtSec: number
  chestSpawned: boolean
  /** After boss dies: seconds before wave may clear / spawns resume stop. */
  lootGraceT: number
  nextPickupId: number
  cleared: boolean
  dead: boolean
  offer: UpgradeOffer[] | null
  /** Why the current pick UI is open. */
  pickReason: 'wave' | 'level' | 'drop_minor' | 'drop_major' | 'chest' | null
  /**
   * Relic (and similar) offers waiting while another pick is open.
   * Picked up immediately off the ground; UI drains this queue.
   */
  offerQueue: Array<{
    mode: 'level' | 'drop_minor' | 'drop_major' | 'wave' | 'chest'
    reason: 'wave' | 'level' | 'drop_minor' | 'drop_major' | 'chest'
  }>
  /** Cross-BC domain events (drained by application later). */
  domainEvents: DomainEvent[]
  rng: () => number
  /** Shop/blessing mods; reapplied on mid-run upgrades. */
  runMeta: MetaLoadoutMods | null
  /** 护甲成长层数（不进人物表）。 */
  carapaceStacks: number
  /** 底栏提示（Boss 读谱 / 天气 / 盲抽…）。 */
  bossHint: string
  bossHintT: number
  hintKind: HintKind | null
  /** 精英出场前地面预告（倒计时到 0 再生成）。 */
  eliteTeleT: number
  eliteTeleMax: number
  eliteTeleX: number
  eliteTeleZ: number
  /** 预告中：尚未 push 精英实体。 */
  elitePending: boolean
  /** 出发选定：标准五波或无限。 */
  runMode: RunMode
}

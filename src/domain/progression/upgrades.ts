import type { StarterId } from '../../content/weapons'
import { DEFAULT_STARTER } from '../../content/weapons'
import {
  isFuseUpgradeId,
  learnIdForOffhand,
  offhandForFuseId,
  type FuseUpgradeId,
} from '../../content/fusions'
import { isRelicId, RELIC_IDS, atRelicCap } from './relics'
import { isRhythmCard } from './rhythmCards'

export type UpgradeId =
  | 'fire_rate'
  | 'spread'
  | 'pierce'
  | 'heat_cap'
  | 'heat_decay'
  | 'move_speed'
  | 'max_hp'
  | 'hp_regen'
  | 'damage'
  | 'haste'
  | 'luck'
  | 'armor'
  | 'dodge'
  | 'crit'
  | 'growth'
  | 'magnet'
  | 'beat_bonus'
  | 'melee_range'
  | 'melee_power'
  | 'aura_widen'
  | 'aura_slow'
  | 'orb_split'
  | 'chain_fork'
  | 'chain_reach'
  | 'star_rain'
  | 'star_crater'
  | 'star_volley'
  | 'elem_break'
  | 'elem_explode'
  | 'elem_freeze'
  | 'elem_amp'
  | 'elem_weak'
  | 'learn_flame'
  | 'learn_orb'
  | 'learn_aura'
  | 'learn_chain'
  | 'learn_star'
  | 'learn_orbit'
  /** 咒语旅团式：对本门投点（伤 / CD / 尺度） */
  | 'spell_flame'
  | 'spell_orb'
  | 'spell_aura'
  | 'spell_chain'
  | 'spell_star'
  | 'spell_orbit'
  | 'orbit_blades'
  | 'orbit_spin'
  | 'elem_cut'
  | 'relic_ward'
  | 'relic_leech'
  | 'relic_carapace'
  | 'relic_greed'
  | 'relic_ember'
  | 'relic_spark'
  | 'rhythm_window'
  | 'rhythm_fever_gain'
  | 'rhythm_fever_hold'
  | 'rhythm_combo_soft'
  | 'rhythm_combo_cap'
  | 'fuse_flame'
  | 'fuse_orb'
  | 'fuse_aura'
  | 'fuse_chain'
  | 'fuse_star'
  | 'fuse_orbit'

/** special = 关底优先；stat = 属性多档（受幸运影响） */
export type UpgradeKind = 'special' | 'stat'

export type UpgradeGrade = 1 | 2 | 3

export type UpgradeDef = {
  id: UpgradeId
  name: string
  desc: string
  kind: UpgradeKind
}

export type OwnedUpgrade = {
  id: UpgradeId
  grade: UpgradeGrade
}

export type UpgradeOffer = UpgradeDef & {
  grade: UpgradeGrade
  /** Display line with grade baked in. */
  label: string
  detail: string
}

export const UPGRADE_POOL: UpgradeDef[] = [
  { id: 'damage', name: '强击', desc: '全伤害提升', kind: 'stat' },
  { id: 'haste', name: '迅捷', desc: '武/魔冷却加快', kind: 'stat' },
  { id: 'fire_rate', name: '加速', desc: '火球冷却缩短', kind: 'stat' },
  { id: 'max_hp', name: '生命', desc: '生命上限提升并回满', kind: 'stat' },
  { id: 'hp_regen', name: '回春', desc: '持续回血', kind: 'stat' },
  { id: 'move_speed', name: '滑步', desc: '移速提升', kind: 'stat' },
  { id: 'heat_decay', name: '保温', desc: '热度回落减慢', kind: 'stat' },
  { id: 'luck', name: '幸运', desc: '更高概率抽到高档属性', kind: 'stat' },
  { id: 'armor', name: '护甲', desc: '挨打少掉血（减伤%，有顶）', kind: 'stat' },
  { id: 'dodge', name: '闪避几率', desc: '受击时有概率不挨打（有顶）', kind: 'stat' },
  { id: 'crit', name: '暴击', desc: '暴击率提升（幸运不管暴击）', kind: 'stat' },
  { id: 'growth', name: '成长', desc: '经验获取提升', kind: 'stat' },
  { id: 'magnet', name: '磁铁', desc: '金币吸得更远', kind: 'stat' },
  { id: 'star_rain', name: '岩雨', desc: '落岩砸得更勤', kind: 'stat' },
  { id: 'chain_reach', name: '施法范围', desc: '雷链首跳距与跳距变长', kind: 'stat' },
  { id: 'melee_power', name: '专精 · 击退', desc: '风息推得更远', kind: 'special' },
  { id: 'orb_split', name: '专精 · 分裂', desc: '火球打中后再找一人打一下', kind: 'special' },
  { id: 'aura_slow', name: '专精 · 缓速', desc: '霜环减速更狠', kind: 'special' },
  { id: 'chain_fork', name: '专精 · 弹射次数', desc: '雷链多跳 1 次', kind: 'special' },
  { id: 'star_volley', name: '专精 · 多发', desc: '落岩一次出手多砸一块', kind: 'special' },
  { id: 'orbit_blades', name: '专精 · 加刃', desc: '环刃多一把', kind: 'special' },
  { id: 'orbit_spin', name: '转速', desc: '环刃转得更快', kind: 'special' },
  { id: 'elem_break', name: '破甲', desc: '风息叠满削他护甲', kind: 'special' },
  { id: 'elem_explode', name: '爆炸', desc: '火球叠满在他身上炸一圈', kind: 'special' },
  { id: 'elem_freeze', name: '冻结', desc: '霜环叠满定身', kind: 'special' },
  { id: 'elem_amp', name: '增伤', desc: '雷链叠满后他更好打', kind: 'special' },
  { id: 'elem_weak', name: '虚弱', desc: '落岩叠满后他打得更弱', kind: 'special' },
  { id: 'elem_cut', name: '割伤', desc: '环刃叠满让他流血', kind: 'special' },
  { id: 'heat_cap', name: '热度上限', desc: '热度上限 +25', kind: 'special' },
  { id: 'beat_bonus', name: '拍点加码', desc: '踩拍时初始武器额外加码', kind: 'special' },
  { id: 'learn_flame', name: '习得 · 风息', desc: '解锁风息短锥（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'learn_orb', name: '习得 · 火球', desc: '解锁火球自动发球（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'learn_aura', name: '习得 · 霜环', desc: '解锁霜环（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'learn_chain', name: '习得 · 雷链', desc: '解锁雷链弹跳（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'learn_star', name: '习得 · 落岩', desc: '解锁落岩砸点溅射（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'learn_orbit', name: '习得 · 环刃', desc: '解锁环刃绕飞（拍点仍只强化初始武器）', kind: 'special' },
  { id: 'spell_flame', name: '灌注 · 风息', desc: '本门伤害↑ 冷却↓ 锥长↑', kind: 'stat' },
  { id: 'spell_orb', name: '灌注 · 火球', desc: '本门伤害↑ 冷却↓', kind: 'stat' },
  { id: 'spell_aura', name: '灌注 · 霜环', desc: '本门伤害↑ 冷却↓ 半径↑', kind: 'stat' },
  { id: 'spell_chain', name: '灌注 · 雷链', desc: '本门伤害↑ 冷却↓ 跳距↑', kind: 'stat' },
  { id: 'spell_star', name: '灌注 · 落岩', desc: '本门伤害↑ 冷却↓ 溅射↑', kind: 'stat' },
  { id: 'spell_orbit', name: '灌注 · 环刃', desc: '本门伤害↑ 转速↑', kind: 'stat' },
  { id: 'fuse_flame', name: '融合 · 风息', desc: '自动：主手×风息达标后吃掉副手风息，主手击中附带击退', kind: 'special' },
  { id: 'fuse_orb', name: '融合 · 火球', desc: '自动：主手×火球达标后吃掉副手火球，主手击中后分裂', kind: 'special' },
  { id: 'fuse_aura', name: '融合 · 霜环', desc: '自动：主手×霜环达标后吃掉副手霜环，主手击中附带减速', kind: 'special' },
  { id: 'fuse_chain', name: '融合 · 雷链', desc: '自动：主手×雷链达标后吃掉副手雷链，主手击中后再串一人', kind: 'special' },
  { id: 'fuse_star', name: '融合 · 落岩', desc: '自动：主手×落岩达标后吃掉副手落岩，主手击中溅射一下', kind: 'special' },
  { id: 'fuse_orbit', name: '融合 · 环刃', desc: '自动：主手×环刃达标后吃掉副手环刃，主手击中额外轻伤附近', kind: 'special' },
  { id: 'relic_ward', name: '护盾', desc: '挡一层，碎了后过几秒或击杀刷新', kind: 'special' },
  { id: 'relic_leech', name: '吸血', desc: '打人回血（有顶、有衰减）', kind: 'special' },
  { id: 'relic_carapace', name: '护甲成长', desc: '每过一波叠一层减伤（有顶）', kind: 'special' },
  { id: 'relic_greed', name: '拾荒', desc: '本局金币获取 +40%', kind: 'special' },
  { id: 'relic_ember', name: '余烬', desc: '位移闪避更省热度', kind: 'special' },
  { id: 'relic_spark', name: '起势', desc: '每波开场 Fever 有一段保底', kind: 'special' },
  { id: 'rhythm_window', name: '宽判', desc: '判定窗略放宽', kind: 'special' },
  { id: 'rhythm_fever_gain', name: '热槽', desc: 'Fever 涨得更快（和热血相乘）', kind: 'special' },
  { id: 'rhythm_fever_hold', name: '延烧', desc: 'Fever 窗口更长', kind: 'special' },
  { id: 'rhythm_combo_soft', name: '韧击', desc: 'Miss 少砍一半连击', kind: 'special' },
  { id: 'rhythm_combo_cap', name: '连击顶', desc: '连击伤顶上移', kind: 'special' },
]

const STACKABLE: UpgradeId[] = [
  'damage',
  'haste',
  'fire_rate',
  'beat_bonus',
  'melee_power',
  'max_hp',
  'hp_regen',
  'aura_slow',
  'orb_split',
  'chain_fork',
  'chain_reach',
  'luck',
  'armor',
  'dodge',
  'crit',
  'growth',
  'magnet',
  'star_rain',
  'star_volley',
  'orbit_blades',
  'orbit_spin',
  'spell_flame',
  'spell_orb',
  'spell_aura',
  'spell_chain',
  'spell_star',
  'spell_orbit',
]

const GRADE_MARK = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'] as const

const MAIN_FUSION: Record<StarterId, UpgradeId> = {
  flame: 'melee_power',
  spirit_orb: 'orb_split',
  ward_aura: 'aura_slow',
  thunder_chain: 'chain_fork',
  starfall: 'star_volley',
  orbit: 'orbit_blades',
}

const MAIN_ELEM: Record<StarterId, UpgradeId> = {
  flame: 'elem_break',
  spirit_orb: 'elem_explode',
  ward_aura: 'elem_freeze',
  thunder_chain: 'elem_amp',
  starfall: 'elem_weak',
  orbit: 'elem_cut',
}

export function totalLuck(owned: OwnedUpgrade[]): number {
  let n = 0
  for (const u of owned) {
    if (u.id === 'luck') n += u.grade
  }
  return n
}

/** Higher luck → more weight on grade 2/3. */
export function rollGrade(luck: number, rng: () => number): UpgradeGrade {
  const t = Math.min(14, Math.max(0, luck))
  let w1 = Math.max(0.12, 0.7 - t * 0.04)
  let w2 = 0.24 + t * 0.022
  let w3 = 0.06 + t * 0.028
  const sum = w1 + w2 + w3
  w1 /= sum
  w2 /= sum
  const r = rng()
  if (r < w1) return 1
  if (r < w1 + w2) return 2
  return 3
}

export function gradeDetail(id: UpgradeId, grade: UpgradeGrade): string {
  switch (id) {
    case 'damage':
      return grade === 1 ? '全伤害 +6%' : grade === 2 ? '全伤害 +10%' : '全伤害 +16%'
    case 'haste':
      return grade === 1 ? '冷却 -5%' : grade === 2 ? '冷却 -10%' : '冷却 -16%'
    case 'fire_rate':
      return grade === 1 ? '火球 CD -6%' : grade === 2 ? '火球 CD -12%' : '火球 CD -20%'
    case 'max_hp':
      return grade === 1 ? '上限 +1 并回满' : grade === 2 ? '上限 +1 并回满' : '上限 +2 并回满'
    case 'hp_regen':
      return grade === 1 ? '回血 +0.12/秒' : grade === 2 ? '回血 +0.20/秒' : '回血 +0.32/秒'
    case 'move_speed':
      return grade === 1 ? '移速 +6%' : grade === 2 ? '移速 +12%' : '移速 +20%'
    case 'heat_decay':
      return grade === 1 ? '回落 -12%' : grade === 2 ? '回落 -22%' : '回落 -35%'
    case 'luck':
      return grade === 1 ? '幸运 +1' : grade === 2 ? '幸运 +2' : '幸运 +3'
    case 'armor':
      return grade === 1 ? '减伤 +5%' : grade === 2 ? '减伤 +8%' : '减伤 +12%'
    case 'dodge':
      return grade === 1 ? '闪避 +5%' : grade === 2 ? '闪避 +8%' : '闪避 +12%'
    case 'crit':
      return grade === 1 ? '暴击率 +5%' : grade === 2 ? '暴击率 +8%、暴伤 158%' : '暴击率 +12%、暴伤 168%'
    case 'growth':
      return grade === 1 ? '经验 +5%' : grade === 2 ? '经验 +10%' : '经验 +16%'
    case 'magnet':
      return grade === 1 ? '吸金半径 +1.5' : grade === 2 ? '吸金半径 +2.5' : '吸金半径 +4'
    case 'spell_flame':
      return grade === 1 ? '风息 伤+8% CD-5% 锥+4%' : grade === 2 ? '风息 伤+12% CD-8% 锥+6%' : '风息 伤+18% CD-12% 锥+10%'
    case 'spell_orb':
      return grade === 1 ? '火球 伤+8% CD-6%' : grade === 2 ? '火球 伤+12% CD-10%' : '火球 伤+18% CD-14%'
    case 'spell_aura':
      return grade === 1 ? '霜环 伤+8% CD-5% 径+5%' : grade === 2 ? '霜环 伤+12% CD-8% 径+8%' : '霜环 伤+18% CD-12% 径+12%'
    case 'spell_chain':
      return grade === 1 ? '雷链 伤+8% CD-5% 跳距+5%' : grade === 2 ? '雷链 伤+12% CD-8% 跳距+8%' : '雷链 伤+18% CD-12% 跳距+12%'
    case 'spell_star':
      return grade === 1 ? '落岩 伤+8% CD-5% 溅+6%' : grade === 2 ? '落岩 伤+12% CD-8% 溅+10%' : '落岩 伤+18% CD-12% 溅+14%'
    case 'spell_orbit':
      return grade === 1 ? '环刃 伤+8% 转速+6%' : grade === 2 ? '环刃 伤+12% 转速+10%' : '环刃 伤+18% 转速+14%'
    case 'star_rain':
      return grade === 1 ? '落岩稍勤' : grade === 2 ? '落岩更勤' : '落岩更勤'
    case 'chain_reach':
      return grade === 1 ? '施法范围小幅提升' : grade === 2 ? '施法范围明显提升' : '施法范围大幅提升'
    default:
      return UPGRADE_POOL.find((u) => u.id === id)?.desc ?? ''
  }
}

function makeOffer(def: UpgradeDef, grade: UpgradeGrade): UpgradeOffer {
  const g = def.kind === 'special' ? 1 : grade
  const mark = def.kind === 'stat' ? GRADE_MARK[g] : ''
  return {
    ...def,
    grade: g,
    label: mark ? `${def.name} ${mark}` : def.name,
    detail: def.kind === 'stat' ? gradeDetail(def.id, g) : def.desc,
  }
}

/** 副手软顶见 magicSlotCap(level)；再出「习得」会淹没主手拍点。 */
const LEARN_IDS: UpgradeId[] = [
  'learn_flame',
  'learn_orb',
  'learn_aura',
  'learn_chain',
  'learn_star',
  'learn_orbit',
]

export function isLearnUpgradeId(id: UpgradeId): boolean {
  return LEARN_IDS.includes(id)
}

/** 咒语旅团式：对本门投点（可叠）。 */
const SPELL_BOOST_IDS: UpgradeId[] = [
  'spell_flame',
  'spell_orb',
  'spell_aura',
  'spell_chain',
  'spell_star',
  'spell_orbit',
]

export function isSpellBoostId(id: UpgradeId): boolean {
  return SPELL_BOOST_IDS.includes(id)
}

function starterOfLearn(id: UpgradeId): StarterId | null {
  switch (id) {
    case 'learn_flame':
      return 'flame'
    case 'learn_orb':
      return 'spirit_orb'
    case 'learn_aura':
      return 'ward_aura'
    case 'learn_chain':
      return 'thunder_chain'
    case 'learn_star':
      return 'starfall'
    case 'learn_orbit':
      return 'orbit'
    default:
      return null
  }
}

/** 仍在自动开火的副手数（融合吃掉的不算）。 */
export function activeOffhandCount(starter: StarterId, owned: OwnedUpgrade[]): number {
  const fused = owned.find((o) => isFuseUpgradeId(o.id))
  const fusedOff =
    fused && isFuseUpgradeId(fused.id) ? offhandForFuseId(fused.id) : null
  let n = 0
  for (const id of LEARN_IDS) {
    if (!owned.some((o) => o.id === id)) continue
    const sid = starterOfLearn(id)
    if (!sid || sid === starter) continue
    if (fusedOff === sid) continue
    n += 1
  }
  return n
}

/**
 * 魔法槽（副手）数量：只装「习得 / 双修」门，主手不占槽。
 * 每 10 级 +1：Lv10→1 · Lv20→2 · Lv30→3（顶）。
 * 已占用的槽不会因等级不够被踢掉（双修开局）。
 */
export const MAGIC_SLOT_MAX = 3
/** 每隔多少级解锁一格魔法槽。 */
export const MAGIC_SLOT_EVERY_LEVELS = 10

export function magicSlotCap(level: number): number {
  const lv = Math.max(1, level)
  return Math.min(MAGIC_SLOT_MAX, Math.floor(lv / MAGIC_SLOT_EVERY_LEVELS))
}

/** @deprecated 用 magicSlotCap(level)；保留别名避免旧引用炸掉。 */
export const OFFHAND_CAP = MAGIC_SLOT_MAX

export function freeMagicSlots(
  starter: StarterId,
  owned: OwnedUpgrade[],
  level: number,
): number {
  const filled = activeOffhandCount(starter, owned)
  return Math.max(0, magicSlotCap(level) - filled)
}

export function atOffhandCap(
  starter: StarterId,
  owned: OwnedUpgrade[],
  level = 99,
): boolean {
  return activeOffhandCount(starter, owned) >= magicSlotCap(level)
}

/** 刚升到该级时新解锁一格魔法槽（10 / 20 / 30…）。 */
export function magicSlotUnlockedAt(level: number): boolean {
  const lv = Math.max(1, level)
  if (lv % MAGIC_SLOT_EVERY_LEVELS !== 0) return false
  const slots = lv / MAGIC_SLOT_EVERY_LEVELS
  return slots >= 1 && slots <= MAGIC_SLOT_MAX
}

function fusedOffhandOf(owned: OwnedUpgrade[]): StarterId | null {
  const f = owned.find((o) => isFuseUpgradeId(o.id))
  return f && isFuseUpgradeId(f.id) ? offhandForFuseId(f.id) : null
}

/** 仍在身上的门（主手 / 未融副手）。已融合吃掉的那门不算持有。 */
function kitFlags(starter: StarterId, owned: OwnedUpgrade[]) {
  const fused = fusedOffhandOf(owned)
  const held = (sid: StarterId, learnId: UpgradeId) => {
    if (starter === sid) return true
    if (fused === sid) return false
    return owned.some((o) => o.id === learnId)
  }
  return {
    flame: held('flame', 'learn_flame'),
    orb: held('spirit_orb', 'learn_orb'),
    aura: held('ward_aura', 'learn_aura'),
    chain: held('thunder_chain', 'learn_chain'),
    star: held('starfall', 'learn_star'),
    orbit: held('orbit', 'learn_orbit'),
    fused,
  }
}

function fitsKit(id: UpgradeId, kit: ReturnType<typeof kitFlags>): boolean {
  switch (id) {
    case 'learn_flame':
      return !kit.flame && kit.fused !== 'flame'
    case 'spell_flame':
    case 'melee_power':
    case 'elem_break':
      return kit.flame
    case 'learn_orb':
      return !kit.orb && kit.fused !== 'spirit_orb'
    case 'spell_orb':
    case 'fire_rate':
    case 'orb_split':
    case 'elem_explode':
      return kit.orb
    case 'learn_aura':
      return !kit.aura && kit.fused !== 'ward_aura'
    case 'spell_aura':
    case 'aura_slow':
    case 'elem_freeze':
      return kit.aura
    case 'learn_chain':
      return !kit.chain && kit.fused !== 'thunder_chain'
    case 'spell_chain':
    case 'chain_fork':
    case 'chain_reach':
    case 'elem_amp':
      return kit.chain
    case 'learn_star':
      return !kit.star && kit.fused !== 'starfall'
    case 'spell_star':
    case 'star_rain':
    case 'star_volley':
    case 'elem_weak':
      return kit.star
    case 'learn_orbit':
      return !kit.orbit && kit.fused !== 'orbit'
    case 'spell_orbit':
    case 'orbit_blades':
    case 'orbit_spin':
    case 'elem_cut':
      return kit.orbit
    case 'fuse_flame':
    case 'fuse_orb':
    case 'fuse_aura':
    case 'fuse_chain':
    case 'fuse_star':
    case 'fuse_orbit':
      return false
    default:
      return true
  }
}

/** 可被融合吃掉的副手（一局已融过则空）。 */
export function ownedFusableOffhands(
  starter: StarterId,
  owned: OwnedUpgrade[],
): StarterId[] {
  if (owned.some((o) => isFuseUpgradeId(o.id))) return []
  const outs: StarterId[] = []
  const tryAdd = (id: StarterId) => {
    if (id === starter) return
    if (owned.some((o) => o.id === learnIdForOffhand(id))) outs.push(id)
  }
  tryAdd('flame')
  tryAdd('spirit_orb')
  tryAdd('ward_aura')
  tryAdd('thunder_chain')
  tryAdd('starfall')
  tryAdd('orbit')
  return outs
}

function availablePool(
  owned: OwnedUpgrade[],
  kind: UpgradeKind | undefined,
  starter: StarterId,
  level: number,
): UpgradeDef[] {
  const kit = kitFlags(starter, owned)
  const offhandFull = atOffhandCap(starter, owned, level)
  return UPGRADE_POOL.filter((u) => {
    if (kind && u.kind !== kind) return false
    if (isRelicId(u.id)) return false
    if (offhandFull && isLearnUpgradeId(u.id)) return false
    if (!fitsKit(u.id, kit)) return false
    if (STACKABLE.includes(u.id)) return true
    return !owned.some((o) => o.id === u.id)
  })
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  return [...arr].sort(() => rng() - 0.5)
}

function pickStats(
  rng: () => number,
  owned: OwnedUpgrade[],
  luck: number,
  n: number,
  starter: StarterId,
  level: number,
): UpgradeOffer[] {
  const pool = shuffle(
    availablePool(owned, 'stat', starter, level).filter((d) => !isSpellBoostId(d.id)),
    rng,
  )
  const out: UpgradeOffer[] = []
  for (let i = 0; i < n && i < pool.length; i++) {
    out.push(makeOffer(pool[i]!, rollGrade(luck, rng)))
  }
  let guard = 0
  while (out.length < n && pool.length > 0 && guard++ < 12) {
    const def = pool[Math.floor(rng() * pool.length)]!
    out.push(makeOffer(def, rollGrade(luck, rng)))
  }
  return out
}

function pickSpellBoosts(
  rng: () => number,
  owned: OwnedUpgrade[],
  luck: number,
  n: number,
  starter: StarterId,
  level: number,
): UpgradeOffer[] {
  if (n <= 0) return []
  const pool = shuffle(
    availablePool(owned, 'stat', starter, level).filter((d) => isSpellBoostId(d.id)),
    rng,
  )
  return pool.slice(0, n).map((d) => makeOffer(d, rollGrade(luck, rng)))
}

function defById(id: UpgradeId): UpgradeDef | undefined {
  return UPGRADE_POOL.find((u) => u.id === id)
}

export type PickMode = 'level' | 'drop_minor' | 'drop_major' | 'wave' | 'chest'

export type PickOpts = {
  /** 无限局里节奏专项更容易进关末三选。 */
  preferRhythm?: boolean
  /** 当前等级：决定魔法槽上限；升级三选可出习得。 */
  level?: number
}

function pickRelics(rng: () => number, owned: OwnedUpgrade[], n: number): UpgradeOffer[] {
  if (atRelicCap(owned)) return []
  const pool = shuffle(
    RELIC_IDS.filter((id) => !owned.some((o) => o.id === id))
      .map((id) => defById(id))
      .filter((d): d is UpgradeDef => !!d),
    rng,
  )
  return pool.slice(0, n).map((d) => makeOffer(d, 1))
}

function pickLearns(
  rng: () => number,
  owned: OwnedUpgrade[],
  starter: StarterId,
  level: number,
  n: number,
): UpgradeOffer[] {
  if (n <= 0 || atOffhandCap(starter, owned, level)) return []
  const pool = shuffle(
    availablePool(owned, 'special', starter, level).filter((d) => isLearnUpgradeId(d.id)),
    rng,
  )
  return pool.slice(0, n).map((d) => makeOffer(d, 1))
}

/**
 * level → 咒语旅团式：空槽优先「习得」、已持有门可「灌注」、再补属性
 * drop_minor / drop_major → 遗物（满了补属性）
 * chest → 宝箱：属性为主，可混灌注（不出习得 / 遗物）
 * wave → 主手专精、元素伤，再遗物/特殊，不足补属性（融合不占池，达标自动）
 */
export function pickThree(
  rng: () => number,
  owned: OwnedUpgrade[],
  mode: PickMode = 'level',
  starter: StarterId = DEFAULT_STARTER,
  opts?: PickOpts,
): UpgradeOffer[] {
  const luck = totalLuck(owned)
  const level = Math.max(1, opts?.level ?? 1)

  if (mode === 'level') {
    const free = freeMagicSlots(starter, owned, level)
    const forceLearn = magicSlotUnlockedAt(level) && free > 0
    // 有空槽必给至少 1 张习得；刚解锁槽时最多 2
    const learnN = free <= 0 ? 0 : forceLearn ? Math.min(2, free) : 1
    const learns = pickLearns(rng, owned, starter, level, learnN)
    let remain = 3 - learns.length
    // 槽满时多给灌注；有空槽时灌注最多 1，留给属性
    const boostN = free <= 0 ? Math.min(2, remain) : Math.min(1, remain)
    const boosts = pickSpellBoosts(rng, owned, luck, boostN, starter, level)
    remain = 3 - learns.length - boosts.length
    const stats = pickStats(rng, owned, luck, remain, starter, level)
    const mixed = [...learns, ...boosts, ...stats].slice(0, 3)
    if (forceLearn && learns.length > 0) return mixed
    return shuffle(mixed, rng)
  }

  if (mode === 'drop_minor' || mode === 'drop_major') {
    const relics = pickRelics(rng, owned, 3)
    if (relics.length >= 3) return relics
    return [...relics, ...pickStats(rng, owned, luck, 3 - relics.length, starter, level)]
  }

  if (mode === 'chest') {
    const boostN = rng() < 0.7 ? 1 : 0
    const boosts = pickSpellBoosts(rng, owned, luck, boostN, starter, level)
    const stats = pickStats(rng, owned, luck, 3 - boosts.length, starter, level)
    return shuffle([...boosts, ...stats], rng).slice(0, 3)
  }

  const kit = kitFlags(starter, owned)
  const used = new Set<UpgradeId>()
  const offers: UpgradeOffer[] = []

  const pushId = (id: UpgradeId) => {
    if (used.has(id) || offers.length >= 3) return
    // 习得只走升级三选（咒语旅团 / 三选一来源 SSOT）
    if (isLearnUpgradeId(id)) return
    if (!fitsKit(id, kit)) return
    if (!STACKABLE.includes(id) && owned.some((o) => o.id === id)) return
    const def = defById(id)
    if (!def) return
    used.add(id)
    offers.push(makeOffer(def, 1))
  }

  pushId(MAIN_FUSION[starter])
  pushId(MAIN_ELEM[starter])
  const relicOffers = pickRelics(rng, owned, 1)
  for (const r of relicOffers) pushId(r.id)

  const specials = shuffle(availablePool(owned, 'special', starter, level), rng)
  const rhythm = specials.filter((d) => isRhythmCard(d.id))
  const rest = specials.filter((d) => !isRhythmCard(d.id))
  const ordered =
    opts?.preferRhythm && rhythm.length > 0 && rng() < 0.78
      ? [...shuffle(rhythm, rng), ...rest]
      : specials
  for (const d of ordered) {
    if (offers.length >= 3) break
    pushId(d.id)
  }
  if (offers.length < 3) {
    offers.push(...pickStats(rng, owned, luck, 3 - offers.length, starter, level))
  }
  return offers.slice(0, 3)
}

export type { FuseUpgradeId }

/** @deprecated use UpgradeOffer; kept for type aliases in UI */
export type UpgradeTier = UpgradeKind

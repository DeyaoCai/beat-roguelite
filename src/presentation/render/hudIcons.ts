/** Canvas HUD glyphs — skills, stats, relics. No image assets. */

export type HudIcon =
  | 'flame'
  | 'orb'
  | 'aura'
  | 'chain'
  | 'star'
  | 'damage'
  | 'luck'
  | 'hp'
  | 'magnet'
  | 'growth'
  | 'range'
  | 'armor'
  | 'haste'
  | 'crit'
  | 'dodge'
  | 'relic'
  | 'rhythm'
  | 'heat'
  | 'learn'
  | 'infuse'
  | 'fork'
  | 'empty'
  | 'lock'

const ID_ICON: Record<string, HudIcon> = {
  flame: 'flame',
  spirit_orb: 'orb',
  ward_aura: 'aura',
  thunder_chain: 'chain',
  starfall: 'star',
  learn_flame: 'flame',
  learn_orb: 'orb',
  learn_aura: 'aura',
  learn_chain: 'chain',
  learn_star: 'star',
  flame_dmg: 'flame',
  flame_cd: 'flame',
  orb_dmg: 'orb',
  aura_dmg: 'aura',
  aura_cd: 'aura',
  aura_widen: 'aura',
  chain_dmg: 'chain',
  chain_cd: 'chain',
  star_dmg: 'star',
  star_scale: 'star',
  fuse_flame: 'flame',
  fuse_orb: 'orb',
  fuse_aura: 'aura',
  fuse_chain: 'chain',
  fuse_star: 'star',
  melee_power: 'flame',
  orb_split: 'orb',
  aura_slow: 'aura',
  chain_fork: 'chain',
  chain_reach: 'chain',
  star_rain: 'star',
  star_volley: 'star',
  fire_rate: 'orb',
  elem_break: 'armor',
  elem_explode: 'heat',
  elem_freeze: 'dodge',
  elem_amp: 'damage',
  elem_weak: 'armor',
  damage: 'damage',
  luck: 'luck',
  max_hp: 'hp',
  hp_regen: 'hp',
  magnet: 'magnet',
  cast_reach: 'range',
  cast_area: 'range',
  growth: 'growth',
  armor: 'armor',
  haste: 'haste',
  move_speed: 'haste',
  crit: 'crit',
  dodge: 'dodge',
  melee_range: 'flame',
  spread: 'orb',
  pierce: 'orb',
  star_crater: 'star',
  heat_cap: 'heat',
  heat_decay: 'heat',
  beat_bonus: 'rhythm',
  relic_ward: 'armor',
  relic_leech: 'hp',
  relic_carapace: 'armor',
  relic_greed: 'luck',
  relic_ember: 'heat',
  relic_spark: 'rhythm',
  rhythm_window: 'rhythm',
  rhythm_fever_gain: 'heat',
  rhythm_fever_hold: 'heat',
  rhythm_combo_soft: 'rhythm',
  rhythm_combo_cap: 'rhythm',
}

export function iconForId(id: string): HudIcon {
  if (ID_ICON[id]) return ID_ICON[id]!
  if (id.startsWith('relic_')) return 'relic'
  if (id.startsWith('rhythm_')) return 'rhythm'
  if (id.startsWith('fuse_') || id.startsWith('learn_')) return 'damage'
  return 'damage'
}

/** 五门标签色：风 / 火 / 霜 / 雷 / 岩。 */
export const SKILL_INK: Partial<Record<HudIcon, string>> = {
  flame: '#4ade80',
  orb: '#fb923c',
  aura: '#7dd3fc',
  chain: '#fde047',
  star: '#d6b08a',
}

export function inkForId(id: string, fallback = '#f3ead8'): string {
  return SKILL_INK[iconForId(id)] ?? fallback
}

export type OfferGroup = 'skill' | 'combat' | 'support' | 'growth' | 'rhythm' | 'relic' | 'elem' | 'heat'

export type OfferFace = {
  group: OfferGroup
  groupLabel: string
  mainIcon: HudIcon
  mainInk: string
  mainLabel: string
  dirIcon: HudIcon
  dirInk: string
  dirLabel: string
}

const GROUP_INK: Record<OfferGroup, string> = {
  skill: '#f3ead8',
  combat: '#fb7185',
  support: '#c4b5fd',
  growth: '#e8a04a',
  rhythm: '#fde047',
  relic: '#e879f9',
  elem: '#a78bfa',
  heat: '#fb923c',
}

const SKILL_NAME: Partial<Record<HudIcon, string>> = {
  flame: '风息',
  orb: '火球',
  aura: '霜环',
  chain: '雷链',
  star: '落岩',
}

const DIR_INK = '#e8ddd0'

const DIR_PLATE_INK: Partial<Record<HudIcon, string>> = {
  damage: '#fb7185',
  haste: '#facc15',
  range: '#38bdf8',
  learn: '#4ade80',
  infuse: '#c4b5fd',
  fork: '#fb923c',
  armor: '#d6b08a',
  heat: '#fb923c',
  dodge: '#7dd3fc',
  relic: '#e879f9',
  hp: '#f9a8d4',
  luck: '#e8a04a',
  growth: '#86efac',
  magnet: '#a78bfa',
  rhythm: '#fde047',
  crit: '#fb7185',
  empty: '#e8ddd0',
}

function skillFace(
  skill: HudIcon,
  dirIcon: HudIcon,
  dirLabel: string,
): OfferFace {
  return {
    group: 'skill',
    groupLabel: '技能',
    mainIcon: skill,
    mainInk: SKILL_INK[skill] ?? '#f3ead8',
    mainLabel: SKILL_NAME[skill] ?? '',
    dirIcon,
    dirInk: DIR_PLATE_INK[dirIcon] ?? DIR_INK,
    dirLabel,
  }
}

function groupFace(
  group: Exclude<OfferGroup, 'skill'>,
  dirIcon: HudIcon,
  dirLabel: string,
  mainLabel?: string,
): OfferFace {
  const label =
    group === 'combat'
      ? '战斗'
      : group === 'support'
        ? '辅助'
        : group === 'growth'
          ? '成长'
          : group === 'rhythm'
            ? '节拍'
            : group === 'elem'
              ? '满层'
              : group === 'heat'
                ? '热度'
                : '遗物'
  const icon: HudIcon =
    group === 'combat'
      ? 'damage'
      : group === 'support'
        ? 'hp'
        : group === 'growth'
          ? 'growth'
          : group === 'rhythm'
            ? 'rhythm'
            : group === 'elem'
              ? 'armor'
              : group === 'heat'
                ? 'heat'
                : 'relic'
  return {
    group,
    groupLabel: label,
    mainIcon: icon,
    mainInk: GROUP_INK[group],
    mainLabel: mainLabel ?? label,
    dirIcon,
    dirInk: DIR_PLATE_INK[dirIcon] ?? DIR_INK,
    dirLabel,
  }
}

const FACE_BY_ID: Record<string, OfferFace> = {
  learn_flame: skillFace('flame', 'learn', '习得'),
  learn_orb: skillFace('orb', 'learn', '习得'),
  learn_aura: skillFace('aura', 'learn', '习得'),
  learn_chain: skillFace('chain', 'learn', '习得'),
  learn_star: skillFace('star', 'learn', '习得'),
  flame_dmg: skillFace('flame', 'damage', '伤'),
  flame_cd: skillFace('flame', 'haste', '冷却'),
  melee_range: skillFace('flame', 'range', '范围'),
  orb_dmg: skillFace('orb', 'damage', '伤'),
  fire_rate: skillFace('orb', 'haste', '冷却'),
  aura_dmg: skillFace('aura', 'damage', '伤'),
  aura_cd: skillFace('aura', 'haste', '冷却'),
  aura_widen: skillFace('aura', 'range', '范围'),
  chain_dmg: skillFace('chain', 'damage', '伤'),
  chain_cd: skillFace('chain', 'haste', '冷却'),
  chain_reach: skillFace('chain', 'range', '范围'),
  star_dmg: skillFace('star', 'damage', '伤'),
  star_rain: skillFace('star', 'haste', '勤'),
  star_scale: skillFace('star', 'range', '范围'),
  fuse_flame: skillFace('flame', 'relic', '融合'),
  fuse_orb: skillFace('orb', 'relic', '融合'),
  fuse_aura: skillFace('aura', 'relic', '融合'),
  fuse_chain: skillFace('chain', 'relic', '融合'),
  fuse_star: skillFace('star', 'relic', '融合'),
  melee_power: skillFace('flame', 'damage', '击退'),
  orb_split: skillFace('orb', 'fork', '分裂'),
  aura_slow: skillFace('aura', 'dodge', '缓速'),
  chain_fork: skillFace('chain', 'fork', '弹射'),
  star_volley: skillFace('star', 'fork', '多发'),
  star_crater: skillFace('star', 'heat', '坑'),
  elem_break: groupFace('elem', 'armor', '破甲', '满层'),
  elem_explode: groupFace('elem', 'heat', '爆炸', '满层'),
  elem_freeze: groupFace('elem', 'dodge', '冻结', '满层'),
  elem_amp: groupFace('elem', 'damage', '增伤', '满层'),
  elem_weak: groupFace('elem', 'armor', '虚弱', '满层'),
  damage: groupFace('combat', 'damage', '伤', '战斗'),
  haste: groupFace('combat', 'haste', '冷却', '战斗'),
  crit: groupFace('combat', 'crit', '暴击', '战斗'),
  spread: groupFace('combat', 'range', '散射', '战斗'),
  pierce: groupFace('combat', 'damage', '穿透', '战斗'),
  max_hp: groupFace('support', 'hp', '生命'),
  hp_regen: groupFace('support', 'hp', '回春'),
  armor: groupFace('support', 'armor', '护甲'),
  dodge: groupFace('support', 'dodge', '闪避'),
  move_speed: groupFace('support', 'haste', '滑步'),
  luck: groupFace('growth', 'luck', '幸运'),
  growth: groupFace('growth', 'growth', '经验'),
  magnet: groupFace('growth', 'magnet', '磁铁'),
  cast_reach: groupFace('combat', 'range', '距离', '战斗'),
  cast_area: groupFace('combat', 'range', '范围', '战斗'),
  heat_cap: groupFace('heat', 'heat', '热上限', '热度'),
  heat_decay: groupFace('heat', 'heat', '保温', '热度'),
  beat_bonus: groupFace('rhythm', 'rhythm', '拍点'),
  rhythm_window: groupFace('rhythm', 'rhythm', '宽判'),
  rhythm_fever_gain: groupFace('rhythm', 'heat', '热槽'),
  rhythm_fever_hold: groupFace('rhythm', 'heat', '延烧'),
  rhythm_combo_soft: groupFace('rhythm', 'rhythm', '韧击'),
  rhythm_combo_cap: groupFace('rhythm', 'rhythm', '连击顶'),
  relic_ward: groupFace('relic', 'armor', '护盾'),
  relic_leech: groupFace('relic', 'hp', '吸血'),
  relic_carapace: groupFace('relic', 'armor', '甲成长'),
  relic_greed: groupFace('relic', 'luck', '拾荒'),
  relic_ember: groupFace('relic', 'heat', '余烬'),
  relic_spark: groupFace('relic', 'rhythm', '起势'),
}

export function offerFace(id: string): OfferFace {
  if (FACE_BY_ID[id]) return FACE_BY_ID[id]!
  if (id.startsWith('learn_')) return skillFace(iconForId(id), 'learn', '习得')
  if (id.startsWith('fuse_')) return skillFace(iconForId(id), 'relic', '融合')
  if (id.startsWith('relic_')) return groupFace('relic', 'relic', '遗物')
  if (id.startsWith('rhythm_')) return groupFace('rhythm', 'rhythm', '节拍')
  return groupFace('combat', iconForId(id), '强化', '战斗')
}

export function drawHudIcon(
  ctx: CanvasRenderingContext2D,
  icon: HudIcon,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  const s = size * 0.42
  ctx.save()
  ctx.translate(cx, cy)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = Math.max(1.2, size * 0.08)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  switch (icon) {
    case 'flame':
      drawWind(ctx, s)
      break
    case 'orb':
      drawFire(ctx, s)
      break
    case 'aura':
      drawFrost(ctx, s)
      break
    case 'chain':
      drawBolt(ctx, s)
      break
    case 'star':
      drawRock(ctx, s)
      break
    case 'damage':
      drawStrike(ctx, s)
      break
    case 'luck':
      drawStar(ctx, s)
      break
    case 'hp':
      drawHeart(ctx, s)
      break
    case 'magnet':
      drawMagnet(ctx, s)
      break
    case 'growth':
      drawSprout(ctx, s)
      break
    case 'range':
      drawRings(ctx, s)
      break
    case 'armor':
      drawShield(ctx, s)
      break
    case 'haste':
      drawBolt(ctx, s * 0.85)
      break
    case 'crit':
      drawStrike(ctx, s)
      break
    case 'dodge':
      drawDash(ctx, s)
      break
    case 'relic':
      drawGem(ctx, s)
      break
    case 'rhythm':
      drawNote(ctx, s)
      break
    case 'heat':
      drawFire(ctx, s * 0.9)
      break
    case 'learn':
      drawPlusRing(ctx, s)
      break
    case 'infuse':
      drawDrop(ctx, s)
      break
    case 'fork':
      drawFork(ctx, s)
      break
    case 'empty':
      ctx.globalAlpha = 0.45
      ctx.beginPath()
      ctx.moveTo(-s * 0.35, 0)
      ctx.lineTo(s * 0.35, 0)
      ctx.moveTo(0, -s * 0.35)
      ctx.lineTo(0, s * 0.35)
      ctx.stroke()
      break
    case 'lock':
      drawLock(ctx, s)
      break
  }
  ctx.restore()
}

function drawWind(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(-s * 0.7, -s * 0.35)
  ctx.quadraticCurveTo(s * 0.15, -s * 0.7, s * 0.75, -s * 0.15)
  ctx.moveTo(-s * 0.75, 0.05 * s)
  ctx.quadraticCurveTo(s * 0.2, -s * 0.15, s * 0.8, s * 0.2)
  ctx.moveTo(-s * 0.55, s * 0.4)
  ctx.quadraticCurveTo(s * 0.1, s * 0.55, s * 0.55, s * 0.35)
  ctx.stroke()
}

function drawFire(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.85)
  ctx.quadraticCurveTo(s * 0.7, -s * 0.1, s * 0.35, s * 0.55)
  ctx.quadraticCurveTo(0, s * 0.85, -s * 0.35, s * 0.55)
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.1, 0, -s * 0.85)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, s * 0.12, s * 0.22, 0, Math.PI * 2)
  ctx.stroke()
}

function drawFrost(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.38, 0, Math.PI * 2)
  ctx.stroke()
}

function drawBolt(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(s * 0.12, -s * 0.85)
  ctx.lineTo(-s * 0.18, -s * 0.05)
  ctx.lineTo(s * 0.22, -s * 0.05)
  ctx.lineTo(-s * 0.12, s * 0.85)
  ctx.stroke()
}

function drawRock(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.8)
  ctx.lineTo(s * 0.7, -s * 0.1)
  ctx.lineTo(s * 0.4, s * 0.75)
  ctx.lineTo(-s * 0.45, s * 0.7)
  ctx.lineTo(-s * 0.75, -s * 0.05)
  ctx.closePath()
  ctx.stroke()
}

function drawStrike(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(-s * 0.15, s * 0.75)
  ctx.lineTo(s * 0.1, -s * 0.15)
  ctx.lineTo(-s * 0.35, -s * 0.05)
  ctx.lineTo(s * 0.2, -s * 0.8)
  ctx.stroke()
}

function drawStar(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const x = Math.cos(a) * s * 0.75
    const y = Math.sin(a) * s * 0.75
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.stroke()
}

function drawHeart(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, s * 0.7)
  ctx.bezierCurveTo(s * 0.9, s * 0.1, s * 0.55, -s * 0.65, 0, -s * 0.2)
  ctx.bezierCurveTo(-s * 0.55, -s * 0.65, -s * 0.9, s * 0.1, 0, s * 0.7)
  ctx.stroke()
}

function drawMagnet(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(0, s * 0.15, s * 0.55, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.5, s * 0.2)
  ctx.lineTo(-s * 0.5, -s * 0.55)
  ctx.moveTo(s * 0.5, s * 0.2)
  ctx.lineTo(s * 0.5, -s * 0.55)
  ctx.stroke()
}

function drawSprout(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, s * 0.75)
  ctx.lineTo(0, -s * 0.15)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0, s * 0.05)
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.2, -s * 0.15, -s * 0.75)
  ctx.moveTo(0, s * 0.05)
  ctx.quadraticCurveTo(s * 0.7, -s * 0.05, s * 0.35, -s * 0.65)
  ctx.stroke()
}

function drawRings(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.32, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.62, -0.4, Math.PI * 1.2)
  ctx.stroke()
}

function drawShield(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.8)
  ctx.lineTo(s * 0.7, -s * 0.4)
  ctx.lineTo(s * 0.55, s * 0.25)
  ctx.quadraticCurveTo(0, s * 0.9, -s * 0.55, s * 0.25)
  ctx.lineTo(-s * 0.7, -s * 0.4)
  ctx.closePath()
  ctx.stroke()
}

function drawDash(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(-s * 0.7, s * 0.15)
  ctx.lineTo(s * 0.15, s * 0.15)
  ctx.lineTo(-s * 0.05, -s * 0.55)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.35, s * 0.45)
  ctx.lineTo(s * 0.75, s * 0.45)
  ctx.stroke()
}

function drawGem(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.75)
  ctx.lineTo(s * 0.65, 0)
  ctx.lineTo(0, s * 0.75)
  ctx.lineTo(-s * 0.65, 0)
  ctx.closePath()
  ctx.stroke()
}

function drawNote(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(-s * 0.25, s * 0.45, s * 0.28, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.02, s * 0.45)
  ctx.lineTo(-s * 0.02, -s * 0.7)
  ctx.lineTo(s * 0.55, -s * 0.45)
  ctx.stroke()
}

function drawPlusRing(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-s * 0.32, 0)
  ctx.lineTo(s * 0.32, 0)
  ctx.moveTo(0, -s * 0.32)
  ctx.lineTo(0, s * 0.32)
  ctx.stroke()
}

function drawDrop(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.82)
  ctx.quadraticCurveTo(s * 0.7, s * 0.05, 0, s * 0.72)
  ctx.quadraticCurveTo(-s * 0.7, s * 0.05, 0, -s * 0.82)
  ctx.stroke()
}

function drawFork(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.moveTo(0, s * 0.75)
  ctx.lineTo(0, 0)
  ctx.lineTo(-s * 0.55, -s * 0.7)
  ctx.moveTo(0, 0)
  ctx.lineTo(s * 0.55, -s * 0.7)
  ctx.stroke()
}

function drawLock(ctx: CanvasRenderingContext2D, s: number) {
  ctx.beginPath()
  ctx.rect(-s * 0.45, -s * 0.05, s * 0.9, s * 0.7)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -s * 0.08, s * 0.32, Math.PI, 0)
  ctx.stroke()
}

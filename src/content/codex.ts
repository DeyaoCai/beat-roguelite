/**
 * 枢纽图鉴：人物 / 怪物介绍。玩法数字仍以 rules 为准，这里只陈列给玩家看的话。
 */
import { ARMOR_BY_KIND, BOSS_BY_WAVE, FODDER_KINDS, FODDER_UNLOCK_WAVE, SPECIAL_HP } from './rules'
import type { SpawnFodderKind } from './rules'

export type CodexTab = 'people' | 'foes'

/** 图鉴 3D：当前枢纽外形 / 通讯员 / 怪物低模。 */
export type CodexSubject = 'hero' | 'radio' | 'foe'

export type CodexPreview = {
  subject: CodexSubject
  /** 人物包 id；null = 枢纽当前外形（先锋）。 */
  packId: string | null
  /** 怪物 visual kind。 */
  foeKind: string | null
}

export type CodexEntry = {
  id: string
  tab: CodexTab
  name: string
  kicker: string
  glyph: string
  tag: string
  /** CSS / canvas fill */
  color: string
  blurb: string
  lines: string[]
  facts: string[]
}

export const CODEX_TABS: { id: CodexTab; name: string }[] = [
  { id: 'people', name: '人物' },
  { id: 'foes', name: '怪物' },
]

function fodderFacts(kind: SpawnFodderKind, extra: string[]): string[] {
  const r = FODDER_KINDS[kind]
  const unlock = FODDER_UNLOCK_WAVE[kind]
  const armor = ARMOR_BY_KIND[kind] ?? 0
  return [
    unlock ? `第 ${unlock} 波起刷` : '第 1 波就刷',
    `血量 ×${r.hpMul}（相对杂兵基准）`,
    r.role === 'tank' ? '重装：慢、肉、防高' : '垃圾：偏快偏脆',
    armor > 0.04 ? `基础护甲 ${Math.round(armor * 100)}%` : '几乎无甲',
    ...extra,
  ]
}

function bossFacts(wave: number, extra: string[]): string[] {
  const d = BOSS_BY_WAVE[wave]!
  const armor = ARMOR_BY_KIND.boss ?? 0
  return [
    `标准第 ${wave} 波 · 无限按 1–5 循环`,
    `血量 ×${d.hpMul}（波 5 表值，早关略软）`,
    `基础护甲 ${Math.round(armor * 100)}%`,
    ...extra,
  ]
}

const PEOPLE: CodexEntry[] = [
  {
    id: 'vie',
    tab: 'people',
    name: 'Vie',
    kicker: 'Vilushina · 红铠',
    glyph: 'V',
    tag: '外形',
    color: '#fb7185',
    blurb: '枢纽转台上的红衣圣骑。换她只换脸与铠，不换这一局怎么打。',
    lines: [
      '三姐妹之一。枢纽「外形」A/D 选中她，局内战斗语音走日文骑士腔。',
      'Look，不是第二套 Kit：出门技能、契约、祝福都还是先锋那一套。',
    ],
    facts: ['包 holysee-vie', '战斗语音跟外形走', '不改 Kit'],
  },
  {
    id: 'lite',
    tab: 'people',
    name: 'Lite',
    kicker: 'LittelynMaer · 蓝铠',
    glyph: 'L',
    tag: '外形',
    color: '#7dd3fc',
    blurb: '蓝铠那一位。和 Vie / Iru 同骨，只是盔甲与脸不同。',
    lines: [
      '枢纽外形循环里的第二位。局内走路、待机、出手动画共用骨骼。',
      '切到她不会清空钱袋、也不会改主手。她是这具身体此刻的样子。',
    ],
    facts: ['包 holysee-lite', '战斗语音跟外形走', '不改 Kit'],
  },
  {
    id: 'iru',
    tab: 'people',
    name: 'Iru',
    kicker: 'Irunia · 黑铠',
    glyph: 'I',
    tag: '外形',
    color: '#c4b5fd',
    blurb: '黑铠。三姐妹里最沉的那套涂装。',
    lines: [
      '枢纽外形循环第三位。刷新后仍记住你选的人。',
      '衣橱目前不接这三包；想换装得另开有 wardrobe 的调试包。',
    ],
    facts: ['包 holysee-iru', '战斗语音跟外形走', '不改 Kit'],
  },
  {
    id: 'sofia',
    tab: 'people',
    name: 'Sofia',
    kicker: '通讯员 · 也可出门',
    glyph: 'S',
    tag: '通讯',
    color: '#fde68a',
    blurb: '坐在局内左上通讯窗；枢纽外形也可以切到她。报话仍走她的声库。',
    lines: [
      '英文闲聊与战场报话走她自己的声库。切三姐妹 / Folgi 不清通讯窗里的她。',
      '转台上选她只换 Look，不把 Kit 换成「Sofia 打法」。',
    ],
    facts: ['包 skyrim-female', 'HUD 左上通讯窗', '外形循环可切'],
  },
  {
    id: 'folgi',
    tab: 'people',
    name: 'Folgi',
    kicker: 'Lightbringer · 玛拉圣骑',
    glyph: 'F',
    tag: '外形',
    color: '#fcd34d',
    blurb: '脸模随从。包里没有独立盔甲网格，身体先用 3BA。',
    lines: [
      '枢纽外形循环第四位。没有自己的战斗语音，出门仍是先锋 Kit。',
      'Nyr / Ichigo 的压缩包还是坏的，下完再导。',
    ],
    facts: ['包 skyrim-folgi', 'Facegen + 3BA', '不改 Kit'],
  },
  {
    id: 'vanguard',
    tab: 'people',
    name: '先锋',
    kicker: '这一局的身份',
    glyph: '锋',
    tag: '身份',
    color: '#e8a04a',
    blurb: '目前唯一的 Character。出门底子叫先锋底，默认主手风息。',
    lines: [
      '换外形、换衣服都不改她：武器、祝福、契约叠在这套 Kit 上。',
      '生命、移速、热度衰减是出门数字；商店买的永久底子也加在她身上。',
    ],
    facts: ['Character vanguard', 'Kit 先锋底 · 默认风息', 'HP 7 · 不是第二角色'],
  },
]

const FOES: CodexEntry[] = [
  {
    id: 'chaser',
    tab: 'foes',
    name: '追击者',
    kicker: '快脆 · 突进',
    glyph: '追',
    tag: '小兵',
    color: '#fb923c',
    blurb: '橙楔形跑者。开场就会涌上来，教你别站着挨打。',
    lines: [
      '贴脸突进，血薄。被风息推开或火球点掉都很快。',
      '场上垃圾的底色：清完会加速补刷，别指望空场太久。',
    ],
    facts: fodderFacts('chaser', ['近战扑']),
  },
  {
    id: 'shooter',
    tab: 'foes',
    name: '射手',
    kicker: '风筝 · 点射',
    glyph: '射',
    tag: '小兵',
    color: '#c084fc',
    blurb: '紫核漂浮体，炮口朝你。站桩会被点名。',
    lines: [
      '保持距离吐弹，自己不太肯贴过来。',
      '优先清掉比追击者烦：弹幕密度往往是他们抬起来的。',
    ],
    facts: fodderFacts('shooter', ['远程点射']),
  },
  {
    id: 'brute',
    tab: 'foes',
    name: '重装',
    kicker: '慢 · 肉 · 冲锋',
    glyph: '重',
    tag: '小兵',
    color: '#fb7185',
    blurb: '宽肩红块。不要用打追击者的节奏硬刚它。',
    lines: [
      '血厚、有甲、走得慢，急了会冲。',
      '第 2 波起进权重。场上同时不会堆太多，但漏一只就很疼。',
    ],
    facts: fodderFacts('brute', ['偶尔冲锋']),
  },
  {
    id: 'spitter',
    tab: 'foes',
    name: '喷吐',
    kicker: '绕圈 · 吐弹',
    glyph: '喷',
    tag: '小兵',
    color: '#4ade80',
    blurb: '侧向游走的吐者。比射手更绕，弹更黏。',
    lines: [
      '第 2 波起出现。喜欢在你视野边缘画圈。',
      '别追着转：让主手扫过弧线，或用霜环等人进圈。',
    ],
    facts: fodderFacts('spitter', ['绕圈吐弹']),
  },
  {
    id: 'frost',
    tab: 'foes',
    name: '霜行',
    kicker: '稍肉 · 冰感',
    glyph: '霜',
    tag: '小兵',
    color: '#67e8f9',
    blurb: '发青的行者。比追击者耐打，逼你把输出留在一个人身上。',
    lines: [
      '第 2 波起刷。不像重装那么横，但也不脆。',
      '打中你有减速感的时候，优先把它从人群里摘出来。',
    ],
    facts: fodderFacts('frost', ['偏肉的垃圾']),
  },
  {
    id: 'leech',
    tab: 'foes',
    name: '吸血',
    kicker: '侧扑 · 贴身',
    glyph: '吸',
    tag: '小兵',
    color: '#f472b6',
    blurb: '粉红侧扑。贴上就烦，别让它在你身上停留。',
    lines: [
      '第 3 波起刷。不怎么远程，专往你侧面抄。',
      '移速高。闪避或风息推开比硬换血划算。',
    ],
    facts: fodderFacts('leech', ['近战侧扑', '几乎不远程']),
  },
  {
    id: 'elite',
    tab: 'foes',
    name: '精英',
    kicker: '黄环预告 · 专精掉落',
    glyph: '精',
    tag: '精英',
    color: '#fbbf24',
    blurb: '出场先在地上画黄环。看见环再决定要不要接。',
    lines: [
      '预警大约一秒半后才生成。血厚、甲高，击杀掉技能专属三选（专精 / 元素伤）。',
      'Boss 出场前这一波至少会来一只。',
    ],
    facts: [
      '约 12 秒后才可能首只',
      `血量约 ×${SPECIAL_HP.eliteMulWave1} 起（随波涨）`,
      `基础护甲 ${Math.round((ARMOR_BY_KIND.elite ?? 0) * 100)}%`,
      '击杀立刻开专精 / 元素伤三选',
    ],
  },
  {
    id: 'warden',
    tab: 'foes',
    name: '节拍监守',
    kicker: '第 1 波 · 学躲环',
    glyph: '监',
    tag: 'Boss',
    color: '#f59e0b',
    blurb: '慢追、小扇射、脉冲环。这一关就是教你走开。',
    lines: [
      '特技前摇时它会发黄，底栏写「脉冲环 · 走开」，地上有环。',
      '血条标 · ! 的时候不要贪刀。环扩开再贴回去。',
    ],
    facts: bossFacts(1, ['扇 3 弹', '脉冲环 ~4 秒']),
  },
  {
    id: 'caller',
    tab: 'foes',
    name: '猎群号手',
    kicker: '第 2 波 · 清增援',
    glyph: '号',
    tag: 'Boss',
    color: '#38bdf8',
    blurb: '自己打得不疼，会周期性喊小兵。先清增援。',
    lines: [
      '召兵前摇会提示。出生的追击带闪白，方便一眼抓住。',
      '忽略增援只盯 Boss，会被数量淹死。',
    ],
    facts: bossFacts(2, ['弱扇射', '召 2～3 追击 ~5 秒']),
  },
  {
    id: 'hex',
    tab: 'foes',
    name: '镜咒法师',
    kicker: '第 3 波 · 预判落点',
    glyph: '咒',
    tag: 'Boss',
    color: '#a78bfa',
    blurb: '走得极慢，却会闪现换位，十字弹从新落点打出。',
    lines: [
      '前摇后瞬移。看地面十字，不要看它现在站哪。',
      '闪现空档可以输出；落地瞬间先侧步。',
    ],
    facts: bossFacts(3, ['十字弹', '闪现 ~5.5 秒']),
  },
  {
    id: 'choir',
    tab: 'foes',
    name: '铁律合唱',
    kicker: '第 4 波 · 读窗口',
    glyph: '律',
    tag: 'Boss',
    color: '#f8fafc',
    blurb: '全环弹幕和冲锋交替。中间有一段可以打的窗。',
    lines: [
      '环的时候走开；冲的时候让开直线，落地有扇射。',
      '两招之间留了可读的空档。别在环上硬换。',
    ],
    facts: bossFacts(4, ['环 16 弹 ↔ 冲锋', '交替 ~3.4 秒']),
  },
  {
    id: 'tyrant',
    tab: 'foes',
    name: '终曲暴君',
    kicker: '第 5 波 · 半血变相',
    glyph: '君',
    tag: 'Boss',
    color: '#e11d48',
    blurb: '双阶段终 Boss。半血之后不再是同一只怪。',
    lines: [
      '上半场是更凶的扇射。半血有大红环前摇，然后爆发。',
      '狂暴后追得更快，螺旋弹 + 扇。无限模式 6 波以后它会再来。',
    ],
    facts: bossFacts(5, ['半血切阶段', '狂暴螺旋弹']),
  },
]

const BY_TAB: Record<CodexTab, CodexEntry[]> = {
  people: PEOPLE,
  foes: FOES,
}

export function codexEntries(tab: CodexTab): CodexEntry[] {
  return BY_TAB[tab]
}

export function wrapCodexIndex(tab: CodexTab, index: number): number {
  const n = BY_TAB[tab].length
  if (n <= 0) return 0
  return ((index % n) + n) % n
}

export function codexAt(tab: CodexTab, index: number): CodexEntry {
  const rows = BY_TAB[tab]
  return rows[wrapCodexIndex(tab, index)]!
}

export function codexPreviewOf(entry: CodexEntry): CodexPreview {
  if (entry.tab === 'foes') return { subject: 'foe', packId: null, foeKind: entry.id }
  if (entry.id === 'sofia') return { subject: 'radio', packId: null, foeKind: null }
  if (entry.id === 'vie') return { subject: 'hero', packId: 'holysee-vie', foeKind: null }
  if (entry.id === 'lite') return { subject: 'hero', packId: 'holysee-lite', foeKind: null }
  if (entry.id === 'iru') return { subject: 'hero', packId: 'holysee-iru', foeKind: null }
  if (entry.id === 'folgi') return { subject: 'hero', packId: 'skyrim-folgi', foeKind: null }
  return { subject: 'hero', packId: null, foeKind: null }
}

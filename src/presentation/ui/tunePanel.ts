import type { World } from '../../domain/combat/types'

export type TuneField = {
  key: string
  label: string
  min: number
  max: number
  step: number
  get: (w: World) => number
  set: (w: World, v: number) => void
}

const FIELDS: TuneField[] = [
  {
    key: 'moveSpeed',
    label: '移速',
    min: 2,
    max: 20,
    step: 0.1,
    get: (w) => w.player.speed,
    set: (w, v) => {
      w.player.speed = v
      w.loadout.moveSpeed = v
    },
  },
  {
    key: 'maxHp',
    label: '生命上限',
    min: 1,
    max: 20,
    step: 1,
    get: (w) => w.player.maxHp,
    set: (w, v) => {
      w.player.maxHp = v
      w.loadout.maxHp = v
      w.player.hp = Math.min(w.player.hp, v)
    },
  },
  {
    key: 'hp',
    label: '当前生命',
    min: 0,
    max: 20,
    step: 1,
    get: (w) => w.player.hp,
    set: (w, v) => {
      w.player.hp = Math.min(v, w.player.maxHp)
    },
  },
  {
    key: 'fireInterval',
    label: '火球间隔',
    min: 0.05,
    max: 1.2,
    step: 0.01,
    get: (w) => w.loadout.orb?.interval ?? 0.28,
    set: (w, v) => {
      if (w.loadout.orb) w.loadout.orb.interval = v
    },
  },
  {
    key: 'bulletDamage',
    label: '火球伤害',
    min: 0.2,
    max: 10,
    step: 0.1,
    get: (w) => w.loadout.orb?.damage ?? 0,
    set: (w, v) => {
      if (w.loadout.orb) w.loadout.orb.damage = v
    },
  },
  {
    key: 'bulletSpeed',
    label: '火球速度',
    min: 4,
    max: 30,
    step: 0.5,
    get: (w) => w.loadout.orb?.speed ?? 12,
    set: (w, v) => {
      if (w.loadout.orb) w.loadout.orb.speed = v
    },
  },
  {
    key: 'pierce',
    label: '穿透(+目标数)',
    min: 0,
    max: 8,
    step: 1,
    get: (w) => w.loadout.pierce,
    set: (w, v) => {
      w.loadout.pierce = Math.round(v)
    },
  },
  {
    key: 'spreadExtra',
    label: '散射额外',
    min: 0,
    max: 5,
    step: 1,
    get: (w) => w.loadout.spreadExtra,
    set: (w, v) => {
      w.loadout.spreadExtra = Math.round(v)
    },
  },
  {
    key: 'meleeInterval',
    label: '风息间隔',
    min: 0.1,
    max: 1.5,
    step: 0.01,
    get: (w) => w.loadout.meleeInterval,
    set: (w, v) => {
      w.loadout.meleeInterval = v
    },
  },
  {
    key: 'meleeRange',
    label: '风息锥长',
    min: 1,
    max: 8,
    step: 0.1,
    get: (w) => w.loadout.meleeRange,
    set: (w, v) => {
      w.loadout.meleeRange = v
    },
  },
  {
    key: 'meleeDamage',
    label: '近战伤害',
    min: 0.2,
    max: 12,
    step: 0.1,
    get: (w) => w.loadout.meleeDamage,
    set: (w, v) => {
      w.loadout.meleeDamage = v
    },
  },
  {
    key: 'meleeHalfAngle',
    label: '近战半角',
    min: 0.2,
    max: Math.PI,
    step: 0.05,
    get: (w) => w.loadout.meleeHalfAngle,
    set: (w, v) => {
      w.loadout.meleeHalfAngle = v
    },
  },
  {
    key: 'auraRadius',
    label: '霜环半径',
    min: 0.8,
    max: 8,
    step: 0.1,
    get: (w) => w.loadout.aura?.radius ?? 0,
    set: (w, v) => {
      if (w.loadout.aura) w.loadout.aura.radius = v
    },
  },
  {
    key: 'chainJumps',
    label: '雷链跳数',
    min: 1,
    max: 8,
    step: 1,
    get: (w) => w.loadout.chain?.jumps ?? 0,
    set: (w, v) => {
      if (w.loadout.chain) w.loadout.chain.jumps = Math.round(v)
    },
  },
  {
    key: 'beatBonus',
    label: '拍点加成层',
    min: 0,
    max: 5,
    step: 1,
    get: (w) => w.loadout.beatBonus,
    set: (w, v) => {
      w.loadout.beatBonus = Math.round(v)
    },
  },
  {
    key: 'heat',
    label: '热度',
    min: 0,
    max: 200,
    step: 1,
    get: (w) => w.stats.heat,
    set: (w, v) => {
      w.stats.heat = Math.min(v, w.loadout.heatCfg.max)
    },
  },
  {
    key: 'heatMax',
    label: '热度上限',
    min: 50,
    max: 300,
    step: 5,
    get: (w) => w.loadout.heatCfg.max,
    set: (w, v) => {
      w.loadout.heatCfg.max = v
      w.stats.heat = Math.min(w.stats.heat, v)
    },
  },
  {
    key: 'heatDecay',
    label: '热度回落/秒',
    min: 0,
    max: 20,
    step: 0.5,
    get: (w) => w.loadout.heatCfg.decayPerSec,
    set: (w, v) => {
      w.loadout.heatCfg.decayPerSec = v
    },
  },
]

export type TunePanel = {
  root: HTMLElement
  setOpen: (open: boolean) => void
  isOpen: () => boolean
  syncFromWorld: (w: World | null) => void
  dispose: () => void
}

export function createTunePanel(
  host: HTMLElement,
  opts: {
    onResume?: () => void
    onMusicGain?: (v: number) => void
    getMusicGain?: () => number
    onSfxGain?: (v: number) => void
    getSfxGain?: () => number
  } = {},
): TunePanel {
  const root = document.createElement('div')
  root.className = 'tune-panel'
  root.style.cssText = `
    display:none; position:absolute; inset:0; z-index:30;
    background:rgba(10,6,4,0.72); pointer-events:auto;
    font-family:Segoe UI,PingFang SC,Microsoft YaHei,sans-serif; color:#f3ead8;
  `

  const card = document.createElement('div')
  card.style.cssText = `
    position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
    width:min(440px,92vw); max-height:min(78vh,640px); overflow:auto;
    background:#1c120c; border:1px solid rgba(180,140,90,0.35);
    border-radius:14px; padding:16px 18px 18px; box-shadow:0 12px 40px rgba(0,0,0,0.45);
  `
  root.appendChild(card)

  const title = document.createElement('div')
  title.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;'
  title.innerHTML = `<strong style="font-size:18px">调试 · 属性面板</strong>
    <span style="font-size:12px;color:#b8a894">Esc 关闭</span>`
  card.appendChild(title)

  const hint = document.createElement('div')
  hint.style.cssText = 'font-size:12px;color:#b8a894;margin-bottom:12px;'
  hint.textContent = '调试用 DOM 面板，拖动立即改本局数值。'
  card.appendChild(hint)

  const rows = document.createElement('div')
  rows.style.cssText = 'display:flex;flex-direction:column;gap:10px;'
  card.appendChild(rows)

  type Row = { field: TuneField; input: HTMLInputElement; val: HTMLSpanElement }
  const rowRefs: Row[] = []

  for (const field of FIELDS) {
    const row = document.createElement('label')
    row.style.cssText =
      'display:grid;grid-template-columns:118px 1fr 48px;gap:8px;align-items:center;font-size:13px;'
    const name = document.createElement('span')
    name.textContent = field.label
    name.style.color = '#d4c4b0'
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(field.min)
    input.max = String(field.max)
    input.step = String(field.step)
    input.style.width = '100%'
    const val = document.createElement('span')
    val.style.cssText = 'text-align:right;color:#e8a04a;font-variant-numeric:tabular-nums;'
    val.textContent = '—'
    row.append(name, input, val)
    rows.appendChild(row)
    rowRefs.push({ field, input, val })
  }

  // music gain
  const gainRow = document.createElement('label')
  gainRow.style.cssText =
    'display:grid;grid-template-columns:118px 1fr 48px;gap:8px;align-items:center;font-size:13px;margin-top:4px;'
  const gainName = document.createElement('span')
  gainName.textContent = '音乐音量'
  gainName.style.color = '#d4c4b0'
  const gainInput = document.createElement('input')
  gainInput.type = 'range'
  gainInput.min = '0'
  gainInput.max = '1'
  gainInput.step = '0.01'
  gainInput.value = String(opts.getMusicGain?.() ?? 0.85)
  const gainVal = document.createElement('span')
  gainVal.style.cssText = 'text-align:right;color:#e8a04a;'
  gainVal.textContent = gainInput.value
  gainRow.append(gainName, gainInput, gainVal)
  rows.appendChild(gainRow)
  gainInput.addEventListener('input', () => {
    const v = Number(gainInput.value)
    gainVal.textContent = v.toFixed(2)
    opts.onMusicGain?.(v)
  })

  const sfxRow = document.createElement('label')
  sfxRow.style.cssText =
    'display:grid;grid-template-columns:118px 1fr 48px;gap:8px;align-items:center;font-size:13px;margin-top:4px;'
  const sfxName = document.createElement('span')
  sfxName.textContent = '音效音量'
  sfxName.style.color = '#d4c4b0'
  const sfxInput = document.createElement('input')
  sfxInput.type = 'range'
  sfxInput.min = '0'
  sfxInput.max = '1'
  sfxInput.step = '0.01'
  sfxInput.value = String(opts.getSfxGain?.() ?? 0.72)
  const sfxVal = document.createElement('span')
  sfxVal.style.cssText = 'text-align:right;color:#e8a04a;'
  sfxVal.textContent = sfxInput.value
  sfxRow.append(sfxName, sfxInput, sfxVal)
  rows.appendChild(sfxRow)
  sfxInput.addEventListener('input', () => {
    const v = Number(sfxInput.value)
    sfxVal.textContent = v.toFixed(2)
    opts.onSfxGain?.(v)
  })

  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;gap:10px;margin-top:16px;justify-content:flex-end;'
  const resumeBtn = document.createElement('button')
  resumeBtn.textContent = '继续游戏'
  resumeBtn.style.cssText = `
    background:#e8a04a;color:#1a1008;border:0;border-radius:8px;
    padding:8px 14px;font-weight:700;cursor:pointer;
  `
  resumeBtn.addEventListener('click', () => opts.onResume?.())
  actions.appendChild(resumeBtn)
  card.appendChild(actions)

  // stop key events from reaching game while typing/sliding
  root.addEventListener('keydown', (e) => e.stopPropagation())
  root.addEventListener('keyup', (e) => e.stopPropagation())

  let open = false
  let boundWorld: World | null = null

  const bindInputs = (w: World) => {
    for (const { field, input, val } of rowRefs) {
      const v = field.get(w)
      input.value = String(v)
      val.textContent = formatNum(v)
      input.oninput = () => {
        const n = Number(input.value)
        field.set(w, n)
        val.textContent = formatNum(n)
        // keep hp slider max in sync visually
        if (field.key === 'maxHp') {
          const hpRow = rowRefs.find((r) => r.field.key === 'hp')
          if (hpRow) {
            hpRow.input.max = String(n)
            hpRow.input.value = String(w.player.hp)
            hpRow.val.textContent = formatNum(w.player.hp)
          }
        }
      }
    }
  }

  host.appendChild(root)

  return {
    root,
    setOpen: (v) => {
      open = v
      root.style.display = v ? 'block' : 'none'
      if (v && boundWorld) bindInputs(boundWorld)
    },
    isOpen: () => open,
    syncFromWorld: (w) => {
      boundWorld = w
      if (open && w) bindInputs(w)
    },
    dispose: () => root.remove(),
  }
}

function formatNum(v: number): string {
  if (Number.isInteger(v)) return String(v)
  return v.toFixed(2).replace(/\.?0+$/, '')
}

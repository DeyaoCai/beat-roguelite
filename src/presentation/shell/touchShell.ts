import { CONTRACTS, SHOP_GOODS } from '../../content/meta'
import { loadMeta, shopStatus } from '../../content/metaStore'
import { STARTERS } from '../../content/weapons'
import { isRhythmEnabled } from '../../lib/rhythmEnabled'
import type { FrameSnapshot } from '../render/types'

export type TouchShellHooks = {
  enterHub: (index: number) => void
  stepFigure: (dir: 1 | -1) => void
  backToHub: () => void
  injectKey: (key: string, code?: string | null) => void
  setPaused: (v: boolean) => void
  abandon: () => void
  startRun: () => void
  setRunMode: (mode: 'standard' | 'endless') => void
  setStarter: (id: string) => void
  cycleBlessing: (dir: 1 | -1) => void
  toggleContract: (id: string) => void
  buyShop: (index: number) => void
  nudgeOptionAt: (row: number, dir: 1 | -1) => void
  setCodexTab: (tab: 'people' | 'foes') => void
  stepCodexEntry: (dir: 1 | -1) => void
  focusPrep: (focus: 'track' | 'fuse') => void
}

export type TouchShell = {
  sync: (snap: FrameSnapshot, opts: { touch: boolean; paused: boolean }) => void
  dispose: () => void
}

function el(tag: string, className?: string, text?: string): HTMLElement {
  const n = document.createElement(tag)
  if (className) n.className = className
  if (text != null) n.textContent = text
  return n
}

function btn(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = className
  b.textContent = label
  b.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    onClick()
  })
  return b
}

function chip(label: string, on: boolean, onClick: () => void): HTMLButtonElement {
  return btn(label, `touch-shell__chip${on ? ' touch-shell__chip--on' : ''}`, onClick)
}

function headerBar(title: string, onBack: () => void, right?: string): HTMLElement {
  const bar = el('div', 'touch-shell__header')
  bar.append(btn('←', 'touch-shell__back-icon', onBack))
  bar.append(el('div', 'touch-shell__header-title', title))
  if (right) bar.append(el('div', 'touch-shell__purse-pill', right))
  else bar.append(el('div', 'touch-shell__header-spacer'))
  return bar
}

function section(label: string): HTMLElement {
  const s = el('div', 'touch-shell__section')
  s.append(el('div', 'touch-shell__section-label', label))
  return s
}

/**
 * DOM menus for touch UI. Canvas draws underneath; this is the primary tap path.
 */
export function createTouchShell(host: HTMLElement, hooks: TouchShellHooks): TouchShell {
  const root = el('div', 'touch-shell')
  root.style.display = 'none'
  host.appendChild(root)

  const menu = el('div', 'touch-shell__menu')
  const offerBox = el('div', 'touch-shell__offer')
  const pauseBox = el('div', 'touch-shell__pause')
  root.append(menu, offerBox, pauseBox)

  const pauseCard = el('div', 'touch-shell__card touch-shell__card--pause')
  pauseCard.append(
    el('div', 'touch-shell__card-title', '已暂停'),
    el('div', 'touch-shell__meta', '结束本局按阵亡结算 · 50% 入袋'),
    btn('继续', 'touch-shell__cta touch-shell__cta--primary', () => hooks.setPaused(false)),
    btn('结束本局', 'touch-shell__cta touch-shell__cta--danger', () => hooks.abandon()),
  )
  pauseBox.append(pauseCard)

  let lastSig = ''

  const hidePanels = () => {
    menu.style.display = 'none'
    offerBox.style.display = 'none'
    pauseBox.style.display = 'none'
    menu.className = 'touch-shell__menu'
    menu.replaceChildren()
    offerBox.replaceChildren()
  }

  const paintHub = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--hub'
    const dock = el('div', 'touch-shell__dock')

    const brand = el('div', 'touch-shell__brand')
    brand.append(el('div', 'touch-shell__brand-name', 'Beat Roguelite'))
    brand.append(el('div', 'touch-shell__brand-sub', '弹幕肉鸽 · 触控'))
    dock.append(brand)

    const top = el('div', 'touch-shell__dock-top')
    top.append(el('div', 'touch-shell__purse-pill', `钱袋 ${snap.purse}`))
    dock.append(top)

    const prepIdx = snap.hubRows.findIndex((r) => r.name === '出发')
    if (prepIdx >= 0) {
      dock.append(
        btn('出发', 'touch-shell__cta touch-shell__cta--primary touch-shell__cta--hero', () =>
          hooks.enterHub(prepIdx),
        ),
      )
    }

    const grid = el('div', 'touch-shell__grid')
    snap.hubRows.forEach((row, i) => {
      if (row.name === '出发' || row.name === '外形' || row.name === '衣橱') return
      const b = btn(row.name, 'touch-shell__cell', () => hooks.enterHub(i))
      b.append(el('div', 'touch-shell__cell-blurb', row.blurb))
      grid.append(b)
    })
    dock.append(grid)

    const figure = snap.hubRows.find((r) => r.name === '外形')
    if (figure) {
      const strip = el('div', 'touch-shell__figure-strip')
      strip.append(el('div', 'touch-shell__figure-caption', figure.blurb || '外形'))
      const steppers = el('div', 'touch-shell__steppers')
      steppers.append(
        btn('◀', 'touch-shell__mini', () => hooks.stepFigure(-1)),
        btn('▶', 'touch-shell__mini', () => hooks.stepFigure(1)),
      )
      strip.append(steppers)
      dock.append(strip)
    }

    menu.append(dock)
  }

  const paintPrep = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--sheet'
    const sheet = el('div', 'touch-shell__sheet')
    sheet.append(headerBar('出发', () => hooks.backToHub(), `钱袋 ${snap.purse}`))

    const body = el('div', 'touch-shell__sheet-body')

    {
      const sec = section('模式')
      const row = el('div', 'touch-shell__chips')
      row.append(
        chip('标准五波', snap.runMode === 'standard', () => hooks.setRunMode('standard')),
        chip('无限', snap.runMode === 'endless', () => hooks.setRunMode('endless')),
      )
      sec.append(row)
      body.append(sec)
    }

    if (snap.rhythmEnabled && isRhythmEnabled()) {
      const sec = section('曲目')
      const row = el('div', 'touch-shell__row')
      row.append(
        btn('◀', 'touch-shell__mini', () => {
          hooks.focusPrep('track')
          hooks.injectKey('ArrowLeft')
        }),
        el('span', 'touch-shell__value', snap.highway.songTitle || '—'),
        btn('▶', 'touch-shell__mini', () => {
          hooks.focusPrep('track')
          hooks.injectKey('ArrowRight')
        }),
      )
      sec.append(row)
      body.append(sec)
    }

    {
      const sec = section('主手')
      const row = el('div', 'touch-shell__chips')
      for (const st of STARTERS) {
        row.append(chip(st.name, snap.starterId === st.id, () => hooks.setStarter(st.id)))
      }
      sec.append(row)
      body.append(sec)
    }

    {
      const sec = section('祝福')
      const row = el('div', 'touch-shell__row')
      row.append(
        btn('◀', 'touch-shell__mini', () => hooks.cycleBlessing(-1)),
        el('span', 'touch-shell__value', snap.blessingName || '无'),
        btn('▶', 'touch-shell__mini', () => hooks.cycleBlessing(1)),
      )
      sec.append(row)
      body.append(sec)
    }

    if (snap.startFuseNeed > 0) {
      const sec = section(`开局融合 · 需 ${snap.startFuseNeed}`)
      const row = el('div', 'touch-shell__row')
      row.append(
        btn('◀', 'touch-shell__mini', () => hooks.injectKey('q')),
        el('span', 'touch-shell__value', snap.duoLearnName || '选一门'),
        btn('▶', 'touch-shell__mini', () => hooks.injectKey('e')),
        btn('勾选', 'touch-shell__mini', () => {
          hooks.focusPrep('fuse')
          hooks.injectKey('Enter')
        }),
      )
      sec.append(row)
      body.append(sec)
    }

    {
      const sec = section('契约')
      const row = el('div', 'touch-shell__chips')
      for (const c of CONTRACTS) {
        const on = snap.contractRows.some((r) => r.name === c.name && r.on)
        row.append(chip(c.name, on, () => hooks.toggleContract(c.id)))
      }
      sec.append(row)
      if (snap.contractMul > 1.001) {
        sec.append(el('div', 'touch-shell__meta', `入袋 ×${snap.contractMul.toFixed(2)}`))
      }
      body.append(sec)
    }

    sheet.append(body)

    const foot = el('div', 'touch-shell__sheet-foot')
    foot.append(
      btn(
        snap.hint?.includes('失败') ? '曲目加载失败 · 仍可开局' : '开局',
        'touch-shell__cta touch-shell__cta--primary',
        () => hooks.startRun(),
      ),
    )
    sheet.append(foot)
    menu.append(sheet)
  }

  const paintShop = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--sheet'
    const sheet = el('div', 'touch-shell__sheet')
    sheet.append(headerBar('商店', () => hooks.backToHub(), `钱袋 ${snap.purse}`))
    const body = el('div', 'touch-shell__sheet-body')
    const list = el('div', 'touch-shell__shelf')
    const meta = loadMeta()
    snap.shopRows.forEach((row, i) => {
      const good = SHOP_GOODS[i]
      if (!good) return
      const st = shopStatus(meta, good.id)
      const item = btn('', 'touch-shell__shelf-item', () => hooks.buyShop(i))
      if (st !== 'ok') item.disabled = true
      const left = el('div', 'touch-shell__shelf-main')
      left.append(el('div', 'touch-shell__shelf-name', row.name))
      left.append(el('div', 'touch-shell__cell-blurb', row.blurb))
      const price = el(
        'div',
        `touch-shell__shelf-price${st === 'ok' ? '' : ' touch-shell__shelf-price--mute'}`,
        st === 'max' ? '满' : st === 'owned' ? '已有' : st === 'poor' ? '不够' : `${row.price}`,
      )
      item.append(left, price)
      list.append(item)
    })
    body.append(list)
    sheet.append(body)
    menu.append(sheet)
  }

  const paintOptions = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--sheet'
    const sheet = el('div', 'touch-shell__sheet touch-shell__sheet--compact')
    sheet.append(headerBar('选项', () => hooks.backToHub()))
    const body = el('div', 'touch-shell__sheet-body')
    const row = (label: string, value: string, r: number) => {
      const sec = section(label)
      const line = el('div', 'touch-shell__row')
      line.append(
        btn('◀', 'touch-shell__mini', () => hooks.nudgeOptionAt(r, -1)),
        el('span', 'touch-shell__value', value),
        btn('▶', 'touch-shell__mini', () => hooks.nudgeOptionAt(r, 1)),
      )
      sec.append(line)
      body.append(sec)
    }
    row('音乐', `${Math.round(snap.musicGain * 100)}%`, 0)
    row('音效', `${Math.round(snap.sfxGain * 100)}%`, 1)
    row('主页风格', snap.hubThemeName, 2)
    sheet.append(body)
    menu.append(sheet)
  }

  const paintCodex = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--codex'
    const dock = el('div', 'touch-shell__dock touch-shell__dock--slim')
    dock.append(headerBar('图鉴', () => hooks.backToHub()))
    const tabs = el('div', 'touch-shell__chips')
    tabs.append(
      chip('人物', snap.codexTab === 'people', () => hooks.setCodexTab('people')),
      chip('怪物', snap.codexTab === 'foes', () => hooks.setCodexTab('foes')),
    )
    dock.append(tabs)
    const entry = el('div', 'touch-shell__row')
    entry.append(
      btn('▲', 'touch-shell__mini', () => hooks.stepCodexEntry(-1)),
      el('span', 'touch-shell__value', `条目 ${snap.codexIndex + 1}`),
      btn('▼', 'touch-shell__mini', () => hooks.stepCodexEntry(1)),
    )
    dock.append(entry)
    dock.append(el('div', 'touch-shell__meta', '上半屏看模型 · 可拖转'))
    menu.append(dock)
  }

  const paintResult = (snap: FrameSnapshot) => {
    menu.className = 'touch-shell__menu touch-shell__menu--center'
    const r = snap.result
    const card = el('div', 'touch-shell__card touch-shell__card--result')
    card.append(el('div', 'touch-shell__kicker', r?.won ? 'CLEAR' : 'DOWN'))
    card.append(el('div', 'touch-shell__card-title touch-shell__card-title--lg', r?.won ? '通关' : '阵亡'))
    if (r) {
      card.append(
        el('div', 'touch-shell__meta', `第 ${r.waves} 波 · 得分 ${r.score} · 击杀 ${r.kills}`),
        el('div', 'touch-shell__banked', `入袋 +${r.banked}`),
        el('div', 'touch-shell__meta', `钱袋 ${snap.purse}`),
      )
    }
    card.append(
      btn('回枢纽', 'touch-shell__cta touch-shell__cta--primary', () => hooks.injectKey('Enter')),
    )
    menu.append(card)
  }

  const paintOffer = (snap: FrameSnapshot) => {
    const title =
      snap.pickReason === 'wave'
        ? '关末融合'
        : snap.pickReason === 'chest'
          ? '宝箱遗物'
          : snap.pickReason === 'drop_major'
            ? 'Boss 掉落'
            : snap.pickReason === 'drop_minor'
              ? '精英掉落'
              : '升级'
    const card = el('div', 'touch-shell__card')
    card.append(el('div', 'touch-shell__card-title', title))
    card.append(el('div', 'touch-shell__meta', '点选一张'))
    const list = el('div', 'touch-shell__list')
    for (let i = 0; i < (snap.offer?.length ?? 0); i++) {
      const o = snap.offer![i]!
      const name = o.name || o.id
      const desc = o.desc || ''
      const b = btn(name, 'touch-shell__list-item', () => hooks.injectKey(String(i + 1)))
      if (desc) b.append(el('div', 'touch-shell__cell-blurb', desc))
      list.append(b)
    }
    card.append(list)
    offerBox.append(card)
  }

  return {
    sync(snap, opts) {
      if (!opts.touch) {
        if (lastSig !== 'off') {
          hidePanels()
          root.style.display = 'none'
          lastSig = 'off'
        }
        return
      }
      root.style.display = 'block'

      if (snap.scene === 'play' && opts.paused) {
        if (lastSig !== 'pause') {
          hidePanels()
          pauseBox.style.display = 'flex'
          lastSig = 'pause'
        }
        return
      }

      if (snap.scene === 'play' && snap.offer && snap.pickReason) {
        const sig = `offer:${snap.pickReason}:${snap.offer.map((o) => `${o.id}:${o.grade}`).join(',')}`
        if (lastSig !== sig) {
          hidePanels()
          offerBox.style.display = 'flex'
          paintOffer(snap)
          lastSig = sig
        }
        return
      }

      if (snap.scene === 'play' || snap.scene === 'pick' || snap.scene === 'closet') {
        if (lastSig !== 'play') {
          hidePanels()
          lastSig = 'play'
        }
        return
      }

      const sig = [
        snap.scene,
        snap.purse,
        snap.hubIndex,
        snap.starterId,
        snap.runMode,
        snap.blessingName,
        snap.duoLearnName,
        snap.codexTab,
        snap.codexIndex,
        snap.musicGain,
        snap.sfxGain,
        snap.hubThemeId,
        snap.highway.songTitle,
        snap.result?.banked,
        snap.contractMul,
        snap.contractRows.map((c) => `${c.name}:${c.on}`).join('|'),
        snap.shopRows.map((r) => r.status).join(','),
        snap.hint,
      ].join('~')
      if (sig === lastSig) return
      hidePanels()
      menu.style.display = 'flex'
      if (snap.scene === 'title') paintHub(snap)
      else if (snap.scene === 'prep') paintPrep(snap)
      else if (snap.scene === 'shop') paintShop(snap)
      else if (snap.scene === 'options') paintOptions(snap)
      else if (snap.scene === 'codex') paintCodex(snap)
      else if (snap.scene === 'result') paintResult(snap)
      lastSig = sig
    },
    dispose: () => root.remove(),
  }
}

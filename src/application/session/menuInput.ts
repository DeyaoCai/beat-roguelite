import { CODEX_TABS, codexEntries, wrapCodexIndex } from '../../content/codex'
import { SHOP_GOODS } from '../../content/meta'
import { tryBuy } from '../../content/metaStore'
import { navDir } from './nav'
import type { SessionIO, SessionState } from './types'

export function handleMenuKey(s: SessionState, k: string, io: SessionIO): void {
  if (s.scene === 'title') {
    const n = io.hubList().length
    const d = navDir(k)
    if (d.row && n > 0) {
      s.hubIndex = (s.hubIndex + d.row + n) % n
      io.clock.beep('ui')
    } else if (d.col) {
      const it = io.hubList()[s.hubIndex]
      if (it?.scene === 'figure') io.stepFigure(d.col > 0 ? 1 : -1)
      else io.stepHubTheme(d.col > 0 ? 1 : -1)
    } else if (k === 'Enter' || k === ' ') {
      io.enterHubItem(s.hubIndex)
    }
    return
  }
  if (s.scene === 'shop') {
    const n = SHOP_GOODS.length
    const d = navDir(k)
    if (d.row && n > 0) {
      s.shopIndex = (s.shopIndex + d.row + n) % n
      io.clock.beep('ui')
    } else if ((k === 'Enter' || k === ' ') && n > 0) {
      const id = SHOP_GOODS[s.shopIndex]!.id
      const r = tryBuy(id)
      io.clock.beep(r.ok ? 'ui_ok' : 'ui_back')
    }
    return
  }
  if (s.scene === 'codex') {
    const d = navDir(k)
    if (d.col) {
      const i = CODEX_TABS.findIndex((t) => t.id === s.codexTab)
      const next = CODEX_TABS[(i + (d.col > 0 ? 1 : -1) + CODEX_TABS.length) % CODEX_TABS.length]!
      if (next.id !== s.codexTab) {
        s.codexTab = next.id
        s.codexIndex = 0
        io.clock.beep('ui')
      }
    } else if (d.row) {
      const n = codexEntries(s.codexTab).length
      if (n > 0) {
        s.codexIndex = wrapCodexIndex(s.codexTab, s.codexIndex + d.row)
        io.clock.beep('ui')
      }
    }
    return
  }
  if (s.scene === 'options') {
    const d = navDir(k)
    const optionCount = 3
    if (d.row) {
      const next = (s.optionsRow + d.row + optionCount) % optionCount
      if (s.optionsRow !== next) {
        s.optionsRow = next
        io.clock.beep('ui')
      }
    } else if (d.col) {
      if (s.optionsRow === 0) {
        io.applyMusicGain(io.clock.getMusicGain() + 0.05 * d.col)
        io.clock.beep('ui_tick')
      } else if (s.optionsRow === 1) {
        io.applySfxGain(io.clock.getSfxGain() + 0.05 * d.col)
        io.clock.beep('ui_tick')
      } else {
        io.stepHubTheme(d.col > 0 ? 1 : -1)
      }
    }
    return
  }
  if (s.scene === 'result' && (k === 'Enter' || k === ' ')) {
    io.clock.beep('ui_ok')
    s.scene = 'title'
    s.world = null
    io.clock.stop()
  }
}

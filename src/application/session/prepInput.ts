import { loadMeta } from '../../content/metaStore'
import { CONTRACTS, type BlessingId } from '../../content/meta'
import { isRhythmEnabled } from '../../lib/rhythmEnabled'
import { listTracks } from '../../content/tracks'
import { STARTERS, type StarterId } from '../../content/weapons'
import {
  contractFromKey,
  cycleDuoLearn,
  cycleStartFuseCursor,
  toggleContract,
  toggleStartFuse,
} from '../../domain/progression'
import { navDir } from './nav'
import type { SessionIO, SessionState } from './types'
import type { PrepFocus } from '../../presentation/render/types'

function prepRows(fuseNeed: number): PrepFocus[] {
  const rows: PrepFocus[] = ['mode']
  if (isRhythmEnabled()) rows.push('track')
  rows.push('starter', 'blessing')
  if (fuseNeed > 0) rows.push('fuse')
  rows.push('contract', 'go')
  return rows
}

function movePrepRow(s: SessionState, dir: -1 | 1, io: SessionIO): void {
  const rows = prepRows(io.fuseNeedNow())
  const i = Math.max(0, rows.indexOf(s.prepFocus))
  s.prepFocus = rows[(i + dir + rows.length) % rows.length]!
  io.clock.beep('ui')
}

function setStarter(s: SessionState, id: StarterId, io: SessionIO): void {
  s.starterId = id
  io.clampFusePicks()
  io.persistPrep()
  io.clock.beep('ui')
}

function stepTrack(s: SessionState, dir: -1 | 1, io: SessionIO): void {
  const tracks = listTracks()
  if (tracks.length === 0) return
  s.trackIndex = (s.trackIndex + dir + tracks.length) % tracks.length
  s.track = tracks[s.trackIndex]!
  io.persistPrep()
  void io.prepareTrack(s.track)
  io.clock.beep('ui')
}

function stepDuo(s: SessionState, dir: 1 | -1, io: SessionIO): void {
  if (io.fuseNeedNow() <= 0) {
    io.clock.beep('ui_back')
    return
  }
  const need = io.fuseNeedNow()
  if (need <= 1) {
    s.duoLearnId = cycleDuoLearn(s.starterId, s.fuseLearnIds[0] ?? s.duoLearnId, dir)
    s.fuseLearnIds = [s.duoLearnId]
    s.fuseCursorId = s.duoLearnId
  } else {
    s.fuseCursorId = cycleStartFuseCursor(s.starterId, s.fuseCursorId, dir)
  }
  io.persistPrep()
  io.clock.beep('ui')
}

function toggleFusePick(s: SessionState, io: SessionIO): void {
  const need = io.fuseNeedNow()
  if (need <= 0) {
    io.clock.beep('ui_back')
    return
  }
  if (need <= 1) {
    stepDuo(s, 1, io)
    return
  }
  s.fuseLearnIds = toggleStartFuse(s.starterId, s.fuseLearnIds, s.fuseCursorId, need)
  s.duoLearnId = s.fuseLearnIds[0] ?? s.duoLearnId
  io.persistPrep()
  io.clock.beep('ui')
}

function stepStarter(s: SessionState, dir: -1 | 1, io: SessionIO): void {
  const i = STARTERS.findIndex((st) => st.id === s.starterId)
  const from = i < 0 ? 0 : i
  setStarter(s, STARTERS[(from + dir + STARTERS.length) % STARTERS.length]!.id, io)
}

function cycleBlessing(s: SessionState, dir: 1 | -1, io: SessionIO): void {
  const unlocked = loadMeta().blessings
  if (unlocked.length === 0) {
    io.clock.beep('ui_back')
    return
  }
  const ids: (BlessingId | null)[] = [null, ...unlocked]
  const cur = ids.indexOf(s.blessingId)
  const i = cur < 0 ? 0 : (cur + dir + ids.length) % ids.length
  s.blessingId = ids[i]!
  io.clampFusePicks()
  if (s.prepFocus === 'fuse' && io.fuseNeedNow() <= 0) {
    s.prepFocus = 'blessing'
  }
  io.persistPrep()
  io.clock.beep('ui')
}

export function handlePrepKey(
  s: SessionState,
  k: string,
  code: string | null,
  io: SessionIO,
): void {
  const cid = contractFromKey(k, code)
  if (cid) {
    const r = toggleContract(s.contractIds, cid)
    s.contractIds = r.next
    io.persistPrep()
    io.clock.beep(r.ok ? 'ui' : 'ui_back')
    return
  }
  if (k === 'q' || k === 'Q' || k === 'z' || k === 'Z') {
    if (io.fuseNeedNow() > 0) s.prepFocus = 'fuse'
    stepDuo(s, -1, io)
    return
  }
  if (k === 'e' || k === 'E' || k === 'x' || k === 'X') {
    if (io.fuseNeedNow() > 0) s.prepFocus = 'fuse'
    stepDuo(s, 1, io)
    return
  }
  const d = navDir(k)
  if (d.row) {
    movePrepRow(s, d.row, io)
    return
  }
  if (d.col) {
    const col = d.col > 0 ? 1 : -1
    if (s.prepFocus === 'mode') {
      s.runMode = s.runMode === 'standard' ? 'endless' : 'standard'
      io.persistPrep()
      io.clock.beep('ui')
    } else if (s.prepFocus === 'track') {
      stepTrack(s, col, io)
    } else if (s.prepFocus === 'starter') {
      stepStarter(s, col, io)
    } else if (s.prepFocus === 'blessing') {
      cycleBlessing(s, col, io)
    } else if (s.prepFocus === 'fuse') {
      stepDuo(s, col, io)
    } else if (s.prepFocus === 'contract') {
      const n = CONTRACTS.length
      if (n > 0) {
        s.prepContractIndex = (s.prepContractIndex + col + n) % n
        io.clock.beep('ui')
      }
    }
    return
  }
  if (k === 'Enter' || k === ' ') {
    if (s.prepFocus === 'mode') {
      s.runMode = s.runMode === 'standard' ? 'endless' : 'standard'
      io.persistPrep()
      io.clock.beep('ui')
    } else if (s.prepFocus === 'blessing') {
      cycleBlessing(s, 1, io)
    } else if (s.prepFocus === 'fuse') {
      toggleFusePick(s, io)
    } else if (s.prepFocus === 'contract') {
      const id = CONTRACTS[s.prepContractIndex]?.id
      if (id) {
        const r = toggleContract(s.contractIds, id)
        s.contractIds = r.next
        io.persistPrep()
        io.clock.beep(r.ok ? 'ui' : 'ui_back')
      }
    } else if (s.prepFocus === 'go' && !s.loading) {
      io.clock.beep('ui_ok')
      void io.startRun()
    }
  }
}

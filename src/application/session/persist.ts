import { loadMeta } from '../../content/metaStore'
import { loadPrep, savePrep, type PrepPersist } from '../../content/prepStore'
import { listTracks } from '../../content/tracks'
import {
  duoLearnPool,
  ensureDuoLearn,
  ensureStartFuses,
  type UpgradeId,
} from '../../domain/progression'
import type { SessionState } from './types'

export function writePrep(s: SessionState): void {
  savePrep({
    trackId: s.track.id,
    starterId: s.starterId,
    blessingId: s.blessingId,
    duoLearnId: s.duoLearnId,
    fuseLearnIds: s.fuseLearnIds,
    contractIds: s.contractIds,
    runMode: s.runMode,
  })
}

export function hydratePrep(
  s: SessionState,
  saved: PrepPersist | null,
  opts: { forcedTrackId?: string },
): void {
  if (!saved) return
  s.starterId = saved.starterId
  if (!opts.forcedTrackId && listTracks().length > 0) {
    const i = listTracks().findIndex((t) => t.id === saved.trackId)
    if (i >= 0) {
      s.trackIndex = i
      s.track = listTracks()[i]!
      s.trackTitle = s.track.title
    }
  }
  const unlocked = loadMeta().blessings
  s.blessingId =
    saved.blessingId && unlocked.includes(saved.blessingId) ? saved.blessingId : null
  s.duoLearnId = ensureDuoLearn(s.starterId, saved.duoLearnId as UpgradeId)
  s.fuseLearnIds =
    saved.fuseLearnIds.length > 0 ? (saved.fuseLearnIds as UpgradeId[]) : [s.duoLearnId]
  s.fuseCursorId = s.fuseLearnIds[0] ?? s.duoLearnId
  s.contractIds = [...saved.contractIds]
  s.runMode = saved.runMode
}

export function clampFusePicks(s: SessionState, need: number): void {
  const pool = duoLearnPool(s.starterId)
  s.fuseLearnIds = ensureStartFuses(s.starterId, s.fuseLearnIds, need)
  s.duoLearnId = s.fuseLearnIds[0] ?? ensureDuoLearn(s.starterId, s.duoLearnId)
  s.fuseCursorId = pool.includes(s.fuseCursorId) ? s.fuseCursorId : (s.fuseLearnIds[0] ?? s.duoLearnId)
}

export { loadPrep }

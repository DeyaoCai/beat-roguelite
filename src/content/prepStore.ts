import { isRhythmEnabled } from '../lib/rhythmEnabled'
import { BLESSINGS, CONTRACTS, type BlessingId, type ContractId } from './meta'
import { listTracks, SHIP_SILENT_TRACK } from './tracks'
import { STARTERS, type StarterId } from './weapons'

const KEY = 'beat-roguelite.prep.v1'

const LEARN_IDS = new Set([
  'learn_flame',
  'learn_orb',
  'learn_aura',
  'learn_chain',
  'learn_star',
])

const BLESSING_IDS = new Set<string>(BLESSINGS.map((b) => b.id))
const STARTER_IDS = new Set<string>(STARTERS.map((s) => s.id))
const TRACK_IDS = new Set(listTracks().map((t) => t.id))
const SILENT_ID = SHIP_SILENT_TRACK.id
const CONTRACT_IDS = new Set<string>(CONTRACTS.map((c) => c.id))

export type PrepPersist = {
  v: 1
  trackId: string
  starterId: StarterId
  blessingId: BlessingId | null
  duoLearnId: string
  fuseLearnIds: string[]
  contractIds: ContractId[]
  runMode: 'standard' | 'endless'
}

function parseStarter(v: unknown): StarterId | null {
  return typeof v === 'string' && STARTER_IDS.has(v) ? (v as StarterId) : null
}

function parseBlessing(v: unknown): BlessingId | null {
  if (v == null || v === '') return null
  return typeof v === 'string' && BLESSING_IDS.has(v) ? (v as BlessingId) : null
}

function parseContracts(v: unknown): ContractId[] {
  if (!Array.isArray(v)) return []
  const out: ContractId[] = []
  for (const id of v) {
    if (typeof id !== 'string' || !CONTRACT_IDS.has(id)) continue
    if (out.includes(id as ContractId)) continue
    out.push(id as ContractId)
  }
  return out
}

function parseRunMode(v: unknown): 'standard' | 'endless' {
  return v === 'endless' ? 'endless' : 'standard'
}

export function loadPrep(): PrepPersist | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<PrepPersist>
    if (p.v !== 1) return null
    const starterId = parseStarter(p.starterId)
    if (!starterId) return null
    const trackId = isRhythmEnabled()
      ? typeof p.trackId === 'string' && TRACK_IDS.has(p.trackId)
        ? p.trackId
        : null
      : SILENT_ID
    if (!trackId) return null
    const duoLearnId =
      typeof p.duoLearnId === 'string' && LEARN_IDS.has(p.duoLearnId) ? p.duoLearnId : 'learn_orb'
    const fuseLearnIds = Array.isArray(p.fuseLearnIds)
      ? p.fuseLearnIds.filter((id): id is string => typeof id === 'string' && LEARN_IDS.has(id))
      : [duoLearnId]
    return {
      v: 1,
      trackId,
      starterId,
      blessingId: parseBlessing(p.blessingId),
      duoLearnId,
      fuseLearnIds: fuseLearnIds.length > 0 ? fuseLearnIds : [duoLearnId],
      contractIds: parseContracts(p.contractIds),
      runMode: parseRunMode(p.runMode),
    }
  } catch {
    return null
  }
}

export function savePrep(next: Omit<PrepPersist, 'v'>): void {
  try {
    const row: PrepPersist = {
      v: 1,
      trackId: isRhythmEnabled()
        ? TRACK_IDS.has(next.trackId)
          ? next.trackId
          : listTracks()[0]!.id
        : SILENT_ID,
      starterId: parseStarter(next.starterId) ?? STARTERS[0]!.id,
      blessingId: parseBlessing(next.blessingId),
      duoLearnId: LEARN_IDS.has(next.duoLearnId) ? next.duoLearnId : 'learn_orb',
      fuseLearnIds: (next.fuseLearnIds ?? [])
        .filter((id) => LEARN_IDS.has(id))
        .filter((id, i, arr) => arr.indexOf(id) === i),
      contractIds: parseContracts(next.contractIds),
      runMode: parseRunMode(next.runMode),
    }
    localStorage.setItem(KEY, JSON.stringify(row))
  } catch {
    /* private mode / quota */
  }
}

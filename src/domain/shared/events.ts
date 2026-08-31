/**
 * In-memory domain events (sync list on World / RunSession).
 * Cross-BC collaboration without direct imports of internals.
 */

export type NoteJudged = {
  type: 'NoteJudged'
  result: 'perfect' | 'good' | 'miss'
  errorSec: number
  combo: number
}

export type EnemyDefeated = {
  type: 'EnemyDefeated'
  kind:
    | 'chaser'
    | 'shooter'
    | 'brute'
    | 'spitter'
    | 'frost'
    | 'leech'
    | 'elite'
    | 'boss'
    | 'chest'
  x: number
  z: number
  wave: number
}

export type LevelUpPending = {
  type: 'LevelUpPending'
  level: number
  pendingCount: number
}

export type FeverBurst = {
  type: 'FeverBurst'
}

export type DomainEvent = NoteJudged | EnemyDefeated | LevelUpPending | FeverBurst

export function pushEvent(buf: DomainEvent[], ev: DomainEvent): void {
  buf.push(ev)
}

export function drainEvents(buf: DomainEvent[]): DomainEvent[] {
  if (buf.length === 0) return []
  const out = buf.slice()
  buf.length = 0
  return out
}

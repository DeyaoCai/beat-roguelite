import { DEFAULT_HUB_THEME, isHubThemeId, type HubThemeId } from './hubThemes'

const KEY = 'beat-roguelite.settings.v1'

/** v4: music/sfx UI % calibrated to similar loudness. v5 blobs still read for gain. */
export type SettingsPersist = {
  v: 4
  musicGain: number
  sfxGain: number
  hubThemeId: HubThemeId
}

const DEFAULTS: SettingsPersist = {
  v: 4,
  musicGain: 1,
  sfxGain: 1,
  hubThemeId: DEFAULT_HUB_THEME,
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function loadSettings(): SettingsPersist {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const p = JSON.parse(raw) as Partial<SettingsPersist> & { v?: number }
    if (p.v !== 4 && p.v !== 5) return { ...DEFAULTS }
    return {
      v: 4,
      musicGain: clamp01(typeof p.musicGain === 'number' ? p.musicGain : DEFAULTS.musicGain),
      sfxGain: clamp01(typeof p.sfxGain === 'number' ? p.sfxGain : DEFAULTS.sfxGain),
      hubThemeId: isHubThemeId(p.hubThemeId) ? p.hubThemeId : DEFAULTS.hubThemeId,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(
  patch: Partial<Pick<SettingsPersist, 'musicGain' | 'sfxGain' | 'hubThemeId'>>,
): void {
  try {
    const prev = loadSettings()
    const next: SettingsPersist = {
      v: 4,
      musicGain: patch.musicGain !== undefined ? clamp01(patch.musicGain) : prev.musicGain,
      sfxGain: patch.sfxGain !== undefined ? clamp01(patch.sfxGain) : prev.sfxGain,
      hubThemeId: patch.hubThemeId !== undefined && isHubThemeId(patch.hubThemeId)
        ? patch.hubThemeId
        : prev.hubThemeId,
    }
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode / quota */
  }
}

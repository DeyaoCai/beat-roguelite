import { rollWeatherCycle, STANDARD_WAVES } from '../../domain/combat'
import {
  contractBankMul,
  duoLearnLabel,
  starterForLearn,
} from '../../domain/progression'
import {
  LANE_LABELS,
  chartTime,
  visibleHighwayNotes,
} from '../../domain/rhythm'
import { hubFigureCaption } from '../../figures'
import {
  CONTRACTS,
  SHOP_GOODS,
  blessingLabel,
  isShopStackId,
} from '../../content/meta'
import { loadMeta, shopStackCount, shopStatus, START_FUSE_MAX } from '../../content/metaStore'
import { formatTrackDuration } from '../../content/tracks'
import { isRhythmEnabled } from '../../lib/rhythmEnabled'
import { weatherById } from '../../content/weather'
import { hubThemeById } from '../../content/hubThemes'
import { codexAt, wrapCodexIndex, codexPreviewOf } from '../../content/codex'
import { starterLabel } from '../../content/weapons'
import { emptySnapshot, worldToSnapshot } from '../../presentation/render/snapshot'
import type { FrameSnapshot } from '../../presentation/render/types'
import type { SessionIO, SessionState } from './types'

function highwaySnap(s: SessionState, io: SessionIO): FrameSnapshot['highway'] {
  const dur = io.clock.duration || 1
  const t = chartTime(io.clock.songTime, io.clock.duration)
  const notes =
    s.scene === 'play' && s.rhythm ? visibleHighwayNotes(s.rhythm, t) : []
  return {
    visible: s.scene === 'play' && !!s.rhythm && !s.world?.loadout.muteBeat,
    labels: [...LANE_LABELS],
    notes,
    songTitle: s.trackTitle,
    songDuration: formatTrackDuration(io.clock.duration || s.trackDurSec),
    songProgress: Math.min(1, t / dur),
    judgePulse: s.rhythm ? Math.min(1, s.rhythm.flashT / 0.35) : 0,
    judgeResult: s.rhythm?.lastFlash ?? null,
    judgeLane: s.rhythm?.lastLane ?? -1,
    judgeSeq: s.rhythm?.flashSeq ?? 0,
    timingHint: s.world?.stats.timingHintT ? s.world.stats.timingHint : null,
  }
}

function stampMeta(s: SessionState, io: SessionIO, snap: FrameSnapshot): FrameSnapshot {
  const meta = loadMeta()
  snap.rhythmEnabled = isRhythmEnabled()
  snap.purse = meta.purse
  snap.blessingName = blessingLabel(s.blessingId)
  snap.contractRows = CONTRACTS.filter((c) => isRhythmEnabled() || c.id !== 'still').map((c) => ({
    key: c.key,
    name: c.name,
    blurb: c.blurb,
    on: s.contractIds.includes(c.id),
    bankMul: c.bankMul,
  }))
  snap.contractMul = contractBankMul(s.contractIds)
  snap.feverMute = s.contractIds.includes('mute')
  snap.beatMute = s.contractIds.includes('still')
  snap.runMode = s.runMode
  const theme = hubThemeById(s.hubThemeId)
  snap.hubThemeId = theme.id
  snap.hubThemeName = theme.name
  snap.hubThemeBlurb = theme.blurb
  const cycle = rollWeatherCycle(s.seed, 1)
  if (snap.scene !== 'play' && snap.scene !== 'pick') {
    const w1 = weatherById(cycle[0] ?? 'clear')
    snap.weatherName = `${w1.name} · 循环`
    snap.weatherBlurb = cycle.map((id) => weatherById(id).name).join(' → ')
    snap.weatherNextName = weatherById(cycle[1] ?? 'clear').name
  }
  snap.shopRows = SHOP_GOODS.map((g) => {
    const status = shopStatus(meta, g.id)
    let blurb = g.blurb
    if (g.id === 'startfuse') blurb = `${g.blurb} · 已 ${meta.startFuse}/${START_FUSE_MAX}`
    else if (isShopStackId(g.id)) blurb = `${g.blurb} · 已 ${shopStackCount(meta, g.id)}/3`
    return {
      name: g.name,
      blurb,
      price: g.price,
      status,
    }
  })
  const a = io.clock.sampleMusicSpectrum()
  snap.audioSpectrum = a.bins
  snap.audioBass = a.bass
  snap.audioMid = a.mid
  snap.audioEnergy = a.energy
  snap.beatPhase = io.clock.beatPhase || snap.beatPhase
  return snap
}

function playHint(s: SessionState): string {
  const world = s.world
  if (!world) return ''
  if (world.cleared && world.pickReason === 'wave') {
    return '关卡完成 · 选择强化进入下一波 · 1 / 2 / 3'
  }
  if (
    world.offer &&
    (world.pickReason === 'level' ||
      world.pickReason === 'drop_minor' ||
      world.pickReason === 'drop_major' ||
      world.pickReason === 'chest')
  ) {
    if (world.pickReason === 'drop_major') return 'Boss 掉落 · 专精 · 小键盘 1/2/3'
    if (world.pickReason === 'drop_minor') return '精英掉落 · 专精 · 小键盘 1/2/3'
    if (world.pickReason === 'chest') return '宝箱 · 遗物 · 小键盘 1/2/3'
    return '升级 · 小强化 · 小键盘 1/2/3'
  }
  if (s.paused) return '已暂停 · Esc 继续 · Enter 结束本局'
  if (world.loadout.muteBeat || !isRhythmEnabled()) {
    return world.loadout.muteFever
      ? 'WASD 走位 · Shift 闪避 · Fever 锁'
      : 'WASD 走位 · Shift 闪避 · F 放 Fever'
  }
  if (world.loadout.muteFever) {
    return 'J/K/L 打谱 · WASD 走位 · Shift 闪避 · Fever 锁'
  }
  if (
    world.stats.heat >= world.loadout.heatCfg.max * 0.98 &&
    world.stats.feverActiveT <= 0 &&
    world.stats.feverCooldownT <= 0
  ) {
    return '热度已满 · 按 F 放 Fever'
  }
  return 'J/K/L 打谱 · WASD 走位 · F 放 Fever · Shift 闪'
}

export function buildSnapshot(s: SessionState, io: SessionIO): FrameSnapshot {
  if (s.scene === 'title') {
    const snap = emptySnapshot('title')
    snap.hubIndex = s.hubIndex
    snap.hubRows = io.hubList().map((it) =>
      it.scene === 'figure'
        ? { name: it.name, blurb: hubFigureCaption(s.figureId) }
        : { name: it.name, blurb: it.blurb },
    )
    snap.musicGain = io.clock.getMusicGain()
    snap.sfxGain = io.clock.getSfxGain()
    return stampMeta(s, io, snap)
  }
  if (s.scene === 'closet') {
    return stampMeta(s, io, emptySnapshot('closet'))
  }
  if (s.scene === 'options') {
    const snap = emptySnapshot('options')
    snap.optionsRow = s.optionsRow
    snap.musicGain = io.clock.getMusicGain()
    snap.sfxGain = io.clock.getSfxGain()
    return stampMeta(s, io, snap)
  }
  if (s.scene === 'shop') {
    const snap = emptySnapshot('shop')
    snap.shopIndex = s.shopIndex
    return stampMeta(s, io, snap)
  }
  if (s.scene === 'codex') {
    const snap = emptySnapshot('codex')
    snap.codexTab = s.codexTab
    snap.codexIndex = wrapCodexIndex(s.codexTab, s.codexIndex)
    const preview = codexPreviewOf(codexAt(s.codexTab, snap.codexIndex))
    snap.codexSubject = preview.subject
    snap.codexFoeKind = preview.foeKind
    return stampMeta(s, io, snap)
  }
  if (s.scene === 'prep') {
    const snap = emptySnapshot('prep')
    snap.rhythmEnabled = isRhythmEnabled()
    if (snap.rhythmEnabled) {
      snap.highway = {
        ...snap.highway,
        songTitle: s.loading
          ? `加载中… ${s.trackTitle}`
          : s.trackError
            ? `加载失败: ${s.trackError}`
            : `${s.track.artist} - ${s.trackTitle}`,
        songDuration: formatTrackDuration(s.trackDurSec || io.clock.duration),
      }
    }
    snap.starterId = s.starterId
    snap.starterName = starterLabel(s.starterId)
    const fuseNeed = io.fuseNeedNow()
    snap.startFuseNeed = fuseNeed
    snap.fuseStarterIds = s.fuseLearnIds.map((id) => starterForLearn(id) ?? '').filter(Boolean)
    snap.fuseCursorId = starterForLearn(s.fuseCursorId) ?? ''
    snap.duoLearnName = fuseNeed > 0 ? s.fuseLearnIds.map((id) => duoLearnLabel(id)).join(' · ') : ''
    snap.duoStarterId =
      fuseNeed > 0 ? (starterForLearn(s.fuseLearnIds[0] ?? s.fuseCursorId) ?? '') : ''
    snap.prepFocus = s.prepFocus
    snap.prepContractIndex = s.prepContractIndex
    snap.hint = snap.rhythmEnabled
      ? s.trackReady
        ? s.track.source === 'osz'
          ? 'osz · co_der-resource'
          : '资源仓曲'
        : s.trackError || '正在加载曲目…'
      : '弹幕素打 · 无曲目'
    return stampMeta(s, io, snap)
  }
  if (s.scene === 'result') {
    return stampMeta(s, io, {
      ...emptySnapshot('result'),
      fadeBlack: s.fadeBlack,
      result: {
        won:
          !s.world?.dead &&
          (s.world?.runMode ?? s.runMode) === 'standard' &&
          (s.world?.stats.wave ?? 0) >= STANDARD_WAVES &&
          !!s.world?.cleared,
        score: s.runScore,
        kills: s.runKills,
        maxCombo: s.world?.stats.maxCombo ?? 0,
        banked: s.lastBanked,
        waves: s.world?.stats.wave ?? 0,
      },
    })
  }
  if (!s.world) {
    const snap = emptySnapshot('title')
    snap.fadeBlack = s.fadeBlack
    return stampMeta(s, io, snap)
  }
  const base = worldToSnapshot(
    s.scene,
    s.world,
    io.clock,
    s.runScore,
    playHint(s),
    highwaySnap(s, io),
    s.runKills,
  )
  base.fadeBlack = s.fadeBlack
  base.paused = s.paused
  return base
}

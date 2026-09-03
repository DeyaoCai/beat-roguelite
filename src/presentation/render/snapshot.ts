import type { AudioClock } from '../../adapters/audio/clock'
import { FEVER_COOLDOWN_SEC, comboDamageMul } from '../../domain/combat/beatBridge'
import { bossName } from '../../domain/combat/bosses'
import { ARENA_HALF } from '../../domain/combat/arena'
import type { ElemSource, Enemy, World } from '../../domain/combat/types'
import {
  UPGRADE_POOL,
  type OwnedUpgrade,
} from '../../domain/progression'
import { fusedOffhandsOf, spellLevel } from '../../content/fusions'
import type { HighwayNoteView } from '../../domain/rhythm/chart'
import type { JudgeResult } from '../../domain/rhythm/judge'
import { HUB_ITEMS } from '../../content/hub'
import { DEFAULT_HUB_THEME, hubThemeById } from '../../content/hubThemes'
import { isRhythmEnabled } from '../../lib/rhythmEnabled'
import type { FrameSnapshot, HudFuse, HudUpgrade, HudWeapon, SceneKind } from './types'
import { starterLabel } from '../../content/weapons'
import { weatherById } from '../../content/weather'

const LEARN_IDS = new Set(['learn_flame', 'learn_orb', 'learn_aura', 'learn_chain', 'learn_star'])
const GRADE_MARK = ['', 'Ⅰ', 'Ⅱ', 'Ⅲ'] as const
const EMPTY_SPECTRUM = new Float32Array(128)

function cdRatio(remain: number, interval: number): number {
  if (interval <= 1e-6) return 0
  return Math.max(0, Math.min(1, remain / interval))
}

function kitWeapons(world: World): HudWeapon[] {
  const beat = world.loadout.starterId
  const L = world.loadout
  const P = world.player
  const active: HudWeapon[] = []
  const add = (id: string, name: string, glyph: string, cd: number) => {
    active.push({ id, name, glyph, beat: beat === id, cd })
  }
  if (L.hasFlame) add('flame', '风息', '风', cdRatio(P.meleeCd, L.meleeInterval))
  if (L.orb) add('spirit_orb', '火球', '火', cdRatio(P.fireCd, L.orb.interval))
  if (L.aura) add('ward_aura', '霜环', '霜', cdRatio(P.auraCd, L.aura.tickInterval))
  if (L.chain) add('thunder_chain', '雷链', '链', cdRatio(P.chainCd, L.chain.interval))
  if (L.star) add('starfall', '落岩', '岩', cdRatio(P.starCd, L.star.interval))

  const main =
    active.find((w) => w.id === beat) ??
    ({ id: beat, name: starterLabel(beat), glyph: '主', beat: true, cd: 0 } satisfies HudWeapon)
  const offs = active.filter((w) => w.id !== main.id)
  const rows: HudWeapon[] = [{ ...main, beat: true }]
  for (const w of offs) rows.push({ ...w, beat: false })
  return rows
}

function hudFuse(world: World): HudFuse {
  const main = world.loadout.starterId
  const owned = world.upgrades
  const mainLv = spellLevel(main, owned, main)
  const fusedOff = fusedOffhandsOf(owned)
  const fused = fusedOff.length
  const remain = 5 - fused
  return {
    mainId: main,
    mainName: starterLabel(main),
    mainLv,
    nextAt: 0,
    fused,
    progress: Math.max(0, Math.min(1, fused / 5)),
    mainNeed: 0,
    eatName: null,
    offName: null,
    offLv: 0,
    offNeed: 0,
    emptySlots: Math.max(0, remain),
    slotNextLv: 0,
  }
}

function hudUpgrades(owned: OwnedUpgrade[]): HudUpgrade[] {
  const out: HudUpgrade[] = []
  for (const u of owned) {
    if (LEARN_IDS.has(u.id)) continue
    const def = u.meta ?? UPGRADE_POOL.find((d) => d.id === u.id)
    if (!def) continue
    const mark = def.kind === 'stat' ? (GRADE_MARK[u.grade] ?? '') : ''
    out.push({
      id: u.id,
      name: def.name,
      grade: u.grade,
      kind: def.kind,
      label: mark ? `${def.name} ${mark}` : def.name,
    })
  }
  return out
}

const emptyHighway = {
  visible: false,
  labels: ['Space'],
  notes: [] as HighwayNoteView[],
  songTitle: '',
  songDuration: '',
  songProgress: 0,
  judgePulse: 0,
  judgeResult: null as JudgeResult | null,
  judgeLane: -1,
  judgeSeq: 0,
  timingHint: null as 'early' | 'late' | null,
}

const ELEM_KEYS: ElemSource[] = ['flame', 'orb', 'aura', 'chain', 'star']

function enemyElemBuildup(e: Enemy): { elem?: ElemSource; stacks: number } {
  let stacks = 0
  let elem: ElemSource | undefined
  for (const k of ELEM_KEYS) {
    const n = e.elemStacks[k]
    if (n > stacks) {
      stacks = n
      elem = k
    }
  }
  return stacks > 0 && elem ? { elem, stacks } : { stacks: 0 }
}

export function emptySnapshot(scene: SceneKind): FrameSnapshot {
  return {
    scene,
    arenaHalf: ARENA_HALF,
    player: {
      x: 0,
      z: 0,
      r: 0.62,
      hp: 5,
      maxHp: 5,
      invuln: 0,
      hurtFlash: 0,
      yaw: 0,
      moving: false,
      dashing: false,
      slowT: 0,
      poisonT: 0,
      bleedT: 0,
      shieldOn: false,
      castSeq: 0,
    },
    enemies: [],
    pickups: [],
    obstacles: [],
    terrain: [],
    bullets: [],
    slashes: [],
    craters: [],
    aura: null,
    fxMix: { thunder: false, split: false, slow: false, knock: false, volley: false },
    chains: [],
    pops: [],
    floaters: [],
    heat: 0,
    heatMax: 100,
    mult: 1,
    score: 0,
    gold: 0,
    wave: 1,
    waveProgress: 0,
    level: 1,
    xp: 0,
    xpToNext: 48,
    xpProgress: 0,
    levelFlash: false,
    beatPhase: 0,
    audioSpectrum: EMPTY_SPECTRUM,
    audioBass: 0,
    audioMid: 0,
    audioEnergy: 0,
    beatFlash: null,
    combo: 0,
    comboFlash: 0,
    comboBreak: 0,
    comboMilestone: null,
    comboMul: 1,
    fever: 0,
    feverMax: 100,
    feverFlash: 0,
    feverActive: false,
    feverRemain: 0,
    feverCooldown: 0,
    timingHint: null,
    pickReason: null,
    starterId: 'flame',
    starterName: '风息',
    weapons: [],
    fuse: {
      mainId: 'flame',
      mainName: '风息',
      mainLv: 1,
      nextAt: 0,
      fused: 0,
      progress: 0,
      mainNeed: 0,
      eatName: null,
      offName: null,
      offLv: 0,
      offNeed: 0,
      emptySlots: 5,
      slotNextLv: 0,
    },
    upgrades: [],
    kills: 0,
    maxCombo: 0,
    eliteAlive: false,
    eliteTele: null,
    bossAlive: false,
    boss: null,
    luck: 0,
    armorDr: 0,
    dodgeChance: 0,
    weatherId: 'clear',
    weatherName: '晴',
    weatherBlurb: '',
    weatherNextName: '',
    windX: 1,
    windZ: 0,
    carapaceStacks: 0,
    relics: [],
    runMode: 'standard',
    highway: { ...emptyHighway },
    offer: null,
    result: null,
    hint: '',
    hubIndex: 0,
    hubRows: HUB_ITEMS.map(({ name, blurb }) => ({ name, blurb })),
    hubThemeId: DEFAULT_HUB_THEME,
    hubThemeName: hubThemeById(DEFAULT_HUB_THEME).name,
    hubThemeBlurb: hubThemeById(DEFAULT_HUB_THEME).blurb,
    optionsRow: 0,
    shopIndex: 0,
    codexTab: 'people',
    codexIndex: 0,
    codexSubject: 'hero',
    codexFoeKind: null,
    prepFocus: 'mode',
    prepContractIndex: 0,
    musicGain: 1,
    sfxGain: 1,
    purse: 0,
    blessingName: '无',
    duoLearnName: '',
    duoStarterId: '',
    startFuseNeed: 0,
    fuseStarterIds: [],
    fuseCursorId: '',
    contractRows: [],
    contractMul: 1,
    feverMute: false,
    beatMute: false,
    rhythmEnabled: true,
    shopRows: [],
    fadeBlack: 0,
  }
}

export function worldToSnapshot(
  scene: SceneKind,
  world: World,
  clock: AudioClock,
  runScore: number,
  hint: string,
  highway?: FrameSnapshot['highway'],
  runKills = 0,
): FrameSnapshot {
  return {
    scene,
    arenaHalf: world.arena.half,
    player: {
      x: world.player.x,
      z: world.player.z,
      r: world.player.r,
      hp: world.player.hp,
      maxHp: world.player.maxHp,
      invuln: world.player.invuln,
      hurtFlash: Math.min(1, world.player.hurtFlash / 0.28),
      yaw: Math.atan2(world.player.facingX, world.player.facingZ),
      moving: world.player.moving,
      dashing: world.player.dashT > 0,
      slowT: world.player.slowT,
      poisonT: world.player.poisonT,
      bleedT: world.player.bleedT,
      shieldOn: world.player.shieldOn,
      castSeq: world.player.castSeq,
    },
    enemies: world.enemies.map((e) => {
      const build = enemyElemBuildup(e)
      return {
        x: e.x,
        z: e.z,
        r: e.r,
        kind: e.kind,
        bossId: e.bossId,
        hurtFlash: Math.min(1, e.hurtFlash / 0.14),
        hpRatio: e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0,
        frozen: e.freezeT > 0,
        amped: e.ampT > 0,
        broken: e.breakT > 0,
        weak: e.weakT > 0,
        slowed: e.slowT > 0,
        elem: build.elem,
        stacks: build.stacks,
      }
    }),
    pickups: world.pickups.map((p) => ({
      x: p.x,
      z: p.z,
      kind: p.kind,
    })),
    obstacles: world.obstacles.map((o) => ({
      x: o.x,
      z: o.z,
      w: o.w,
      d: o.d,
      h: o.h,
      kind: o.kind,
    })),
    terrain: world.terrain.map((t) => ({
      x: t.x,
      z: t.z,
      w: t.w,
      d: t.d,
      kind: t.kind,
    })),
    bullets: world.bullets.map((b) => ({
      x: b.x,
      z: b.z,
      r: b.r,
      friendly: b.friendly,
    })),
    slashes: world.slashes.map((s) => ({
      x: s.x,
      z: s.z,
      dirX: s.dirX,
      dirZ: s.dirZ,
      radius: s.radius,
      halfAngle: s.halfAngle,
      lifeRatio: Math.max(0, s.life / s.maxLife),
    })),
    craters: world.craters.map((c) => ({
      x: c.x,
      z: c.z,
      r: c.r,
      lifeRatio: Math.max(0, c.life / c.maxLife),
      style: c.style ?? 'earth',
    })),
    aura: world.loadout.aura
      ? {
          radius: world.loadout.aura.radius,
          pulse: Math.min(1, world.auraPulseT / 0.34),
        }
      : null,
    fxMix: {
      thunder: world.loadout.graft.bounce,
      split: world.loadout.graft.split,
      slow: world.loadout.graft.slow,
      knock: world.loadout.graft.knockback,
      volley: world.loadout.graft.volley,
    },
    chains: world.chains.map((c) => ({
      ax: c.ax,
      az: c.az,
      bx: c.bx,
      bz: c.bz,
      lifeRatio: Math.max(0, c.life / c.maxLife),
      kind: c.meta.source,
      hop: c.hop,
    })),
    pops: world.fxPops.map((p) => ({
      x: p.x,
      z: p.z,
      kind: p.kind,
      dirX: p.dirX,
      dirZ: p.dirZ,
      lifeRatio: Math.max(0, p.life / p.maxLife),
    })),
    floaters: world.floaters.map((f) => ({
      x: f.x,
      z: f.z,
      amount: f.amount,
      kind: f.kind,
      kill: f.kill,
      crit: f.crit,
      lifeRatio: Math.max(0, f.life / f.maxLife),
      drift: f.drift,
    })),
    heat: world.stats.heat,
    heatMax: world.loadout.heatCfg.max,
    mult: world.stats.mult,
    score: runScore + world.stats.score,
    gold: world.stats.gold,
    wave: world.stats.wave,
    waveProgress: Math.min(1, world.waveTime / world.waveDuration),
    level: world.stats.level,
    xp: world.stats.xp,
    xpToNext: world.stats.xpToNext,
    xpProgress:
      world.stats.xpToNext > 0
        ? Math.min(1, world.stats.xp / world.stats.xpToNext)
        : 0,
    levelFlash: world.stats.levelFlashT > 0,
    beatPhase: clock.beatPhase,
    ...(() => {
      const a = clock.sampleMusicSpectrum()
      return {
        audioSpectrum: a.bins,
        audioBass: a.bass,
        audioMid: a.mid,
        audioEnergy: a.energy,
      }
    })(),
    beatFlash: world.stats.beatFlash,
    combo: world.stats.combo,
    comboFlash: Math.min(1, world.stats.comboFlashT / 0.22),
    comboBreak: Math.min(1, world.stats.comboBreakT / 0.5),
    comboMilestone: world.stats.comboMilestoneT > 0 ? world.stats.comboMilestone : null,
    comboMul: comboDamageMul(world.stats.combo, world.loadout.comboDmgCap || 50),
    fever: world.stats.heat,
    feverMax: world.loadout.heatCfg.max,
    feverFlash: Math.min(1, world.stats.feverFlashT / 0.7),
    feverActive: world.stats.feverActiveT > 0,
    feverRemain: world.stats.feverActiveT,
    feverCooldown:
      world.stats.feverCooldownT > 0
        ? Math.min(1, world.stats.feverCooldownT / FEVER_COOLDOWN_SEC)
        : 0,
    timingHint: world.stats.timingHintT > 0 ? world.stats.timingHint : null,
    pickReason: world.pickReason,
    starterId: world.loadout.starterId,
    starterName: starterLabel(world.loadout.starterId),
    weapons: kitWeapons(world),
    fuse: hudFuse(world),
    upgrades: hudUpgrades(world.upgrades),
    kills: runKills + world.stats.kills,
    maxCombo: world.stats.maxCombo,
    eliteAlive: world.enemies.some((e) => e.kind === 'elite'),
    eliteTele:
      world.eliteTeleT > 0 && world.eliteTeleMax > 0
        ? {
            x: world.eliteTeleX,
            z: world.eliteTeleZ,
            progress: Math.max(0, Math.min(1, world.eliteTeleT / world.eliteTeleMax)),
          }
        : null,
    bossAlive: world.enemies.some((e) => e.kind === 'boss'),
    boss: (() => {
      const b = world.enemies.find((e) => e.kind === 'boss')
      return b
        ? {
            hp: b.hp,
            maxHp: b.maxHp,
            name: bossName(b.bossId),
            id: b.bossId ?? 'boss',
            windup: b.windupT > 0,
            phase: b.aiPhase,
            teleKind: b.windupT > 0 ? b.windupKind : null,
            teleProgress:
              b.windupMax > 0 ? Math.max(0, Math.min(1, b.windupT / b.windupMax)) : 0,
            x: b.x,
            z: b.z,
            yaw: Math.atan2(world.player.x - b.x, world.player.z - b.z),
          }
        : null
    })(),
    luck: world.loadout.luck,
    armorDr: world.loadout.armorDr,
    dodgeChance: world.loadout.dodgeChance,
    weatherId: world.weatherId,
    weatherName: weatherById(world.weatherId).name,
    weatherBlurb: weatherById(world.weatherId).blurb,
    weatherNextName: (() => {
      const next = world.weatherCycle[world.weatherSlot + 1]
      return next ? weatherById(next).name : ''
    })(),
    windX: world.windX,
    windZ: world.windZ,
    carapaceStacks: world.carapaceStacks,
    relics: world.upgrades.filter((u) => u.id.startsWith('relic_')).map((u) => u.id),
    runMode: world.runMode,
    highway: highway ?? { ...emptyHighway, visible: scene === 'play' },
    offer: world.offer,
    result: null,
    hint: world.bossHintT > 0 && world.bossHint ? world.bossHint : hint,
    hubIndex: 0,
    hubRows: HUB_ITEMS.map(({ name, blurb }) => ({ name, blurb })),
    hubThemeId: DEFAULT_HUB_THEME,
    hubThemeName: hubThemeById(DEFAULT_HUB_THEME).name,
    hubThemeBlurb: hubThemeById(DEFAULT_HUB_THEME).blurb,
    optionsRow: 0,
    shopIndex: 0,
    codexTab: 'people',
    codexIndex: 0,
    codexSubject: 'hero',
    codexFoeKind: null,
    prepFocus: 'mode',
    prepContractIndex: 0,
    musicGain: clock.getMusicGain(),
    sfxGain: clock.getSfxGain(),
    purse: 0,
    blessingName: '',
    duoLearnName: '',
    duoStarterId: '',
    startFuseNeed: 0,
    fuseStarterIds: [],
    fuseCursorId: '',
    contractRows: [],
    contractMul: 1,
    feverMute: world.loadout.muteFever,
    beatMute: world.loadout.muteBeat,
    rhythmEnabled: isRhythmEnabled(),
    shopRows: [],
    fadeBlack: 0,
  }
}

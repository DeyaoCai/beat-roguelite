import { CHARACTERS, type CharacterId } from '../../content/characters'
import { KITS } from '../../content/kits'
import {
  MAGICS,
  MARTIALS,
  type MagicId,
  type MartialId,
  type StarterId,
} from '../../content/weapons'
import {
  graftTraitFrom,
  isFuseUpgradeId,
  offhandForFuseId,
  type GraftTrait,
} from '../../content/fusions'
import type { OwnedUpgrade, UpgradeGrade, UpgradeId } from './upgrades'
import type { MetaLoadoutMods } from './meta'
import {
  COMBO_BREAK_KEEP_SOFT,
  COMBO_DMG_CAP_CARD,
  FEVER_GAIN_CAP,
  FEVER_HOLD_CAP,
  JUDGE_GOOD_CAP,
  JUDGE_PERFECT_CAP,
} from './rhythmCards'
import { DEFAULT_HEAT, type HeatConfig } from '../combat/heat'
import type { Loadout } from '../combat/types'

export type LoadoutInput = {
  characterId: CharacterId
  martialId: MartialId
  starterId?: StarterId
  magicIds?: MagicId[]
  upgrades: OwnedUpgrade[]
  meta?: MetaLoadoutMods
}

function gMul(grade: UpgradeGrade, a: number, b: number, c: number): number {
  return grade === 1 ? a : grade === 2 ? b : c
}

/** 出门数值只来自 Kit + 升级 + 祝福。Look / 衣橱不得进这里。 */
export function resolveLoadout(input: LoadoutInput): Loadout {
  const character = CHARACTERS[input.characterId]
  const kit = KITS[character.kitId]
  const wp = MARTIALS[input.martialId]
  const heatCfg: HeatConfig = { ...DEFAULT_HEAT }
  const starterId = input.starterId ?? kit.defaultStarter
  const learn = (id: UpgradeId) => input.upgrades.some((u) => u.id === id)
  const fusedOffhand = (() => {
    const f = input.upgrades.find((u) => isFuseUpgradeId(u.id))
    return f && isFuseUpgradeId(f.id) ? offhandForFuseId(f.id) : null
  })()
  const hasLearn = (sid: StarterId, learnId: UpgradeId) =>
    starterId === sid || (learn(learnId) && fusedOffhand !== sid)

  const hasFlame = hasLearn('flame', 'learn_flame')
  const magicIds: MagicId[] = input.magicIds
    ? [...input.magicIds]
    : [
        ...(hasLearn('spirit_orb', 'learn_orb') ? (['spirit_orb'] as const) : []),
        ...(hasLearn('ward_aura', 'learn_aura') ? (['ward_aura'] as const) : []),
        ...(hasLearn('thunder_chain', 'learn_chain') ? (['thunder_chain'] as const) : []),
        ...(hasLearn('starfall', 'learn_star') ? (['starfall'] as const) : []),
        ...(hasLearn('orbit', 'learn_orbit') ? (['orbit'] as const) : []),
      ]

  const graft: Record<GraftTrait, boolean> = {
    split: false,
    bounce: false,
    slow: false,
    knockback: false,
    splash: false,
    cleave: false,
  }
  if (fusedOffhand) graft[graftTraitFrom(fusedOffhand)] = true

  let meleeInterval = wp.interval
  let meleeRange = wp.range
  let meleeHalfAngle = (wp.angleDeg * Math.PI) / 360
  let meleeDamage = wp.damage
  let spreadExtra = 0
  let pierce = 0
  let beatBonus = 0
  let moveSpeed = kit.moveSpeed
  let maxHp = kit.maxHp
  let decay = heatCfg.decayPerSec * kit.heatDecayMul
  let heatMax = heatCfg.max
  let auraRadiusMul = 1
  let chainJumpExtra = 0
  let chainReachMul = 1
  let chainJumpRangeMul = 1
  let damageMul = kit.damageMul
  let hasteMul = 1
  let hpRegen = 0
  let orbIntervalMul = 1
  let luck = 0
  let armorDr = 0
  let dodgeChance = 0
  let feverGainMul = 1
  let judgePerfectWin = 0.1
  let judgeGoodWin = 0.24
  let feverActiveSec = 7
  let comboBreakKeep = 0.5
  let comboDmgCap = 50
  let critChance = kit.critChance
  let critDamage = 1.5
  let xpMul = kit.xpMul
  let magnetR = 4.5
  let extraCraters = 0
  let starRateMul = 1
  let starSizeMul = 1
  let starLifeMul = 1
  let knockback = 0.42
  let splitN = 0
  let auraSlowMul = 0.72
  let starCasts = 1
  let orbitExtra = 0
  let orbitSpinMul = 1
  let elemFlame = false
  let elemOrb = false
  let elemAura = false
  let elemChain = false
  let elemStar = false
  let elemOrbit = false
  let spellFlameDmg = 1
  let spellFlameCd = 1
  let spellFlameScale = 1
  let spellOrbDmg = 1
  let spellOrbCd = 1
  let spellAuraDmg = 1
  let spellAuraCd = 1
  let spellAuraScale = 1
  let spellChainDmg = 1
  let spellChainCd = 1
  let spellChainScale = 1
  let spellStarDmg = 1
  let spellStarCd = 1
  let spellStarScale = 1
  let spellOrbitDmg = 1
  let spellOrbitSpin = 1

  for (const { id, grade } of input.upgrades) {
    const g = grade
    if (id === 'damage') damageMul *= gMul(g, 1.06, 1.1, 1.16)
    if (id === 'haste') hasteMul *= gMul(g, 0.95, 0.9, 0.84)
    if (id === 'fire_rate') orbIntervalMul *= gMul(g, 0.94, 0.88, 0.8)
    if (id === 'spread') spreadExtra += 1
    if (id === 'pierce') pierce += 1
    if (id === 'beat_bonus') beatBonus += 1
    if (id === 'move_speed') moveSpeed *= gMul(g, 1.06, 1.12, 1.2)
    if (id === 'max_hp') maxHp += g === 1 ? 1 : g === 2 ? 1 : 2
    if (id === 'hp_regen') hpRegen += gMul(g, 0.12, 0.2, 0.32)
    if (id === 'luck') luck += g
    if (id === 'armor') armorDr += gMul(g, 0.05, 0.08, 0.12)
    if (id === 'dodge') dodgeChance += gMul(g, 0.05, 0.08, 0.12)
    if (id === 'crit') {
      critChance += gMul(g, 0.05, 0.08, 0.12)
      critDamage += gMul(g, 0, 0.08, 0.18)
    }
    if (id === 'growth') xpMul += gMul(g, 0.05, 0.1, 0.16)
    if (id === 'magnet') magnetR += gMul(g, 1.5, 2.5, 4)
    if (id === 'heat_decay') decay *= gMul(g, 0.88, 0.78, 0.65)
    if (id === 'heat_cap') heatMax += 15
    if (id === 'melee_range') {
      meleeRange *= gMul(g, 1.06, 1.12, 1.18)
      meleeHalfAngle = Math.min(
        Math.PI * 0.48,
        meleeHalfAngle + gMul(g, 0.05, 0.09, 0.13),
      )
    }
    if (id === 'melee_power') knockback += 0.12
    if (id === 'orb_split') splitN += 1
    if (id === 'aura_widen') auraRadiusMul *= gMul(g, 1.06, 1.12, 1.2)
    if (id === 'aura_slow') auraSlowMul *= 0.9
    if (id === 'chain_fork') chainJumpExtra += 1
    if (id === 'chain_reach') {
      chainReachMul *= gMul(g, 1.08, 1.14, 1.22)
      chainJumpRangeMul *= gMul(g, 1.08, 1.16, 1.26)
    }
    if (id === 'star_rain') {
      starRateMul *= gMul(g, 0.92, 0.86, 0.78)
    }
    if (id === 'star_crater') {
      starLifeMul *= 1.6
      starSizeMul *= 1.2
    }
    if (id === 'star_volley') starCasts += 1
    if (id === 'elem_break') elemFlame = true
    if (id === 'elem_explode') elemOrb = true
    if (id === 'elem_freeze') elemAura = true
    if (id === 'elem_amp') elemChain = true
    if (id === 'elem_weak') elemStar = true
    if (id === 'orbit_blades') orbitExtra += 1
    if (id === 'orbit_spin') orbitSpinMul *= 1.14
    if (id === 'elem_cut') elemOrbit = true
    if (id === 'spell_flame') {
      spellFlameDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellFlameCd *= gMul(g, 0.95, 0.92, 0.88)
      spellFlameScale *= gMul(g, 1.04, 1.06, 1.1)
    }
    if (id === 'spell_orb') {
      spellOrbDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellOrbCd *= gMul(g, 0.94, 0.9, 0.86)
    }
    if (id === 'spell_aura') {
      spellAuraDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellAuraCd *= gMul(g, 0.95, 0.92, 0.88)
      spellAuraScale *= gMul(g, 1.05, 1.08, 1.12)
    }
    if (id === 'spell_chain') {
      spellChainDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellChainCd *= gMul(g, 0.95, 0.92, 0.88)
      spellChainScale *= gMul(g, 1.05, 1.08, 1.12)
    }
    if (id === 'spell_star') {
      spellStarDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellStarCd *= gMul(g, 0.95, 0.92, 0.88)
      spellStarScale *= gMul(g, 1.06, 1.1, 1.14)
    }
    if (id === 'spell_orbit') {
      spellOrbitDmg *= gMul(g, 1.08, 1.12, 1.18)
      spellOrbitSpin *= gMul(g, 1.06, 1.1, 1.14)
    }
    if (id === 'rhythm_window') {
      judgePerfectWin *= 1.18
      judgeGoodWin *= 1.18
    }
    if (id === 'rhythm_fever_gain') feverGainMul *= 1.22
    if (id === 'rhythm_fever_hold') feverActiveSec += 1.5
    if (id === 'rhythm_combo_soft') comboBreakKeep = COMBO_BREAK_KEEP_SOFT
    if (id === 'rhythm_combo_cap') comboDmgCap = COMBO_DMG_CAP_CARD
  }

  const meta = input.meta
  if (meta) {
    maxHp += meta.extraHp
    luck += meta.extraLuck
    moveSpeed *= meta.moveSpeedMul
    decay *= meta.heatDecayMul
    feverGainMul *= meta.feverGainMul
    if (meta.glass) {
      maxHp = Math.max(3, maxHp - 1)
      damageMul *= 1.1
    }
    if (meta.glassworld) {
      maxHp = Math.max(meta.glass ? 2 : 3, maxHp - 1)
    }
  }

  meleeInterval *= hasteMul * spellFlameCd
  meleeDamage *= damageMul * spellFlameDmg
  meleeRange *= spellFlameScale
  critChance = Math.min(0.45, critChance)
  critDamage = Math.min(2.2, critDamage)
  xpMul = Math.min(1.4, xpMul)
  magnetR = Math.min(12, magnetR)
  armorDr = Math.min(0.4, armorDr)
  dodgeChance = Math.min(0.4, dodgeChance)
  feverGainMul = Math.min(FEVER_GAIN_CAP, feverGainMul)
  judgePerfectWin = Math.min(JUDGE_PERFECT_CAP, judgePerfectWin)
  judgeGoodWin = Math.min(JUDGE_GOOD_CAP, judgeGoodWin)
  feverActiveSec = Math.min(FEVER_HOLD_CAP, feverActiveSec)

  const bodyRadius = kit.radius * (meta?.radiusMul ?? 1)

  let orb: Loadout['orb'] = null
  let aura: Loadout['aura'] = null
  let chain: Loadout['chain'] = null
  let star: Loadout['star'] = null
  let orbit: Loadout['orbit'] = null

  for (const mid of magicIds) {
    const m = MAGICS[mid]
    if (m.kind === 'orb') {
      orb = {
        interval: m.interval * orbIntervalMul * hasteMul * spellOrbCd,
        damage: m.damage * damageMul * spellOrbDmg,
        speed: m.speed,
        life: m.life,
        radius: m.radius,
        count: m.count,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'aura') {
      aura = {
        radius: m.radius * auraRadiusMul * spellAuraScale,
        damage: m.damage * damageMul * spellAuraDmg,
        tickInterval: m.tickInterval * hasteMul * spellAuraCd,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'chain') {
      chain = {
        range: m.range * chainReachMul * spellChainScale,
        jumps: m.jumps + chainJumpExtra,
        jumpRange: m.jumpRange * chainJumpRangeMul * spellChainScale,
        damage: m.damage * damageMul * spellChainDmg,
        interval: m.interval * hasteMul * spellChainCd,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'star') {
      star = {
        interval: m.interval * starRateMul * hasteMul * spellStarCd,
        damage: m.damage * damageMul * spellStarDmg,
        craterR: m.craterR * starSizeMul * spellStarScale,
        craterLife: m.craterLife * starLifeMul,
        range: m.range,
        beatMul: m.beatMul,
        maxCraters: 3 + extraCraters,
        casts: starCasts,
      }
    } else if (m.kind === 'orbit') {
      orbit = {
        radius: m.radius,
        blades: Math.min(5, m.blades + orbitExtra),
        spin: m.spin * orbitSpinMul * spellOrbitSpin,
        damage: m.damage * damageMul * spellOrbitDmg,
        bladeR: m.bladeR,
        hitCd: m.hitCd,
        beatMul: m.beatMul,
      }
    }
  }

  heatCfg.decayPerSec = decay
  heatCfg.max = heatMax

  return {
    characterId: input.characterId,
    kitId: kit.id,
    martialId: input.martialId,
    starterId,
    hasFlame,
    magicIds,
    meleeRange,
    meleeHalfAngle,
    meleeDamage,
    meleeInterval,
    meleeLife: wp.life,
    beatMeleeMul: wp.beatMul,
    orb,
    aura,
    chain,
    star,
    orbit,
    spreadExtra,
    pierce,
    beatBonus,
    moveSpeed,
    maxHp,
    radius: bodyRadius,
    damageMul,
    hasteMul,
    hpRegen,
    luck,
    armorDr,
    dodgeChance,
    feverGainMul,
    feverActiveSec,
    judgePerfectWin,
    judgeGoodWin,
    comboBreakKeep,
    comboDmgCap,
    muteFever: !!meta?.muteFever,
    muteBeat: !!meta?.muteBeat,
    critChance,
    critDamage,
    xpMul,
    magnetR,
    hurtHeatMul: kit.hurtHeatMul,
    knockback: hasFlame || graft.knockback ? knockback : 0,
    splitN: orb || graft.split ? 1 + splitN : 0,
    splitR: 3.4,
    auraSlowMul: aura || graft.slow ? auraSlowMul : 1,
    auraSlowT: 1.15,
    graft,
    fusedOffhand,
    elem: {
      flame: elemFlame,
      orb: elemOrb,
      aura: elemAura,
      chain: elemChain,
      star: elemStar,
      orbit: elemOrbit,
    },
    heatCfg,
  }
}

export type { UpgradeId }

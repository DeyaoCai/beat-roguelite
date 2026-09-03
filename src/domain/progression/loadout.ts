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
  fusedOffhandsOf,
  graftTraitFrom,
  effectOrderOf,
  type GraftTrait,
} from '../../content/fusions'
import {
  LOADOUT_BASE,
  LOADOUT_CAPS,
  UPGRADE_GRADES,
  BLESSING_COMBAT,
  stackedFactor,
  stackedRangeFactor,
  type Grade3,
} from '../../content/rules'
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

function gradeAt(grade: UpgradeGrade, triple: Grade3): number {
  return grade === 1 ? triple[0] : grade === 2 ? triple[1] : triple[2]
}

/** 出门数值只来自 Kit + 升级 + 祝福。Look / 衣橱不得进这里。 */
export function resolveLoadout(input: LoadoutInput): Loadout {
  const character = CHARACTERS[input.characterId]
  const kit = KITS[character.kitId]
  const wp = MARTIALS[input.martialId]
  const heatCfg: HeatConfig = { ...DEFAULT_HEAT }
  const starterId = input.starterId ?? kit.defaultStarter
  const learn = (id: UpgradeId) => input.upgrades.some((u) => u.id === id)
  const fusedOffhands = fusedOffhandsOf(input.upgrades)
  const hasLearn = (sid: StarterId, learnId: UpgradeId) =>
    starterId === sid || (learn(learnId) && !fusedOffhands.includes(sid))

  const hasFlame = hasLearn('flame', 'learn_flame')
  const magicIds: MagicId[] = input.magicIds
    ? [...input.magicIds]
    : [
        ...(hasLearn('spirit_orb', 'learn_orb') ? (['spirit_orb'] as const) : []),
        ...(hasLearn('ward_aura', 'learn_aura') ? (['ward_aura'] as const) : []),
        ...(hasLearn('thunder_chain', 'learn_chain') ? (['thunder_chain'] as const) : []),
        ...(hasLearn('starfall', 'learn_star') ? (['starfall'] as const) : []),
      ]

  const graft: Record<GraftTrait, boolean> = {
    split: false,
    bounce: false,
    slow: false,
    knockback: false,
    volley: false,
  }
  for (const off of fusedOffhands) graft[graftTraitFrom(off)] = true

  const G = UPGRADE_GRADES
  const B = LOADOUT_BASE
  const Cap = LOADOUT_CAPS

  let meleeInterval = wp.interval
  let meleeHalfAngle = (wp.angleDeg * Math.PI) / 360
  let meleeDamage = wp.damage
  let spreadExtra = 0
  let pierce = 0
  let beatBonus = 0
  let maxHp = kit.maxHp
  let heatMax = heatCfg.max
  let chainJumpExtra = 0
  let hpRegen = 0
  let luck = 0
  let armorDr = 0
  let dodgeChance = 0
  let feverActiveSec: number = B.feverActiveSec
  let comboBreakKeep: number = B.comboBreakKeep
  let comboDmgCap: number = B.comboDmgCap
  let critChance = kit.critChance
  let critDamage: number = B.critDamage
  let xpMul = kit.xpMul
  let magnetR: number = B.magnetR
  let castReachAdd = 0
  let castAreaAdd = 0
  let knockback: number = B.knockback
  let splitN = 0
  let casts = 1
  let elemFlame = false
  let elemOrb = false
  let elemAura = false
  let elemChain = false
  let elemStar = false
  let damageAdd = 0
  let hasteAdd = 0
  let orbIntervalAdd = 0
  let moveSpeedAdd = 0
  let heatDecayAdd = 0
  let meleeRangeAdd = 0
  let auraRadiusAdd = 0
  let auraSlowAdd = 0
  let chainReachAdd = 0
  let chainJumpAdd = 0
  let starRateAdd = 0
  let starSizeAdd = 0
  let starLifeAdd = 0
  let flameDmgAdd = 0
  let flameCdAdd = 0
  let orbDmgAdd = 0
  let auraDmgAdd = 0
  let auraCdAdd = 0
  let chainDmgAdd = 0
  let chainCdAdd = 0
  let starDmgAdd = 0
  let starScaleAdd = 0
  let judgeWindowAdd = 0
  let feverGainAdd = 0

  for (const { id, grade } of input.upgrades) {
    const g = grade
    if (id === 'damage') damageAdd += gradeAt(g, G.damage.add)
    if (id === 'haste') hasteAdd += gradeAt(g, G.haste.add)
    if (id === 'fire_rate') orbIntervalAdd += gradeAt(g, G.fire_rate.add)
    if (id === 'spread') spreadExtra += 1
    if (id === 'pierce') pierce += 1
    if (id === 'beat_bonus') beatBonus += 1
    if (id === 'move_speed') moveSpeedAdd += gradeAt(g, G.move_speed.add)
    if (id === 'max_hp') maxHp += gradeAt(g, G.max_hp.add)
    if (id === 'hp_regen') hpRegen += gradeAt(g, G.hp_regen.add)
    if (id === 'luck') luck += g
    if (id === 'armor') armorDr += gradeAt(g, G.armor.add)
    if (id === 'dodge') dodgeChance += gradeAt(g, G.dodge.add)
    if (id === 'crit') {
      critChance += gradeAt(g, G.critChance.add)
      critDamage += gradeAt(g, G.critDamage.add)
    }
    if (id === 'growth') xpMul += gradeAt(g, G.growth.add)
    if (id === 'magnet') magnetR += gradeAt(g, G.magnet.add)
    if (id === 'cast_reach') castReachAdd += gradeAt(g, G.cast_reach.add)
    if (id === 'cast_area') castAreaAdd += gradeAt(g, G.cast_area.add)
    if (id === 'heat_decay') heatDecayAdd += gradeAt(g, G.heat_decay.add)
    if (id === 'heat_cap') heatMax += G.heat_cap.addFlat
    if (id === 'melee_range') {
      meleeRangeAdd += gradeAt(g, G.melee_range.rangeAdd)
      meleeHalfAngle = Math.min(
        Cap.meleeHalfAngle,
        meleeHalfAngle + gradeAt(g, G.melee_range.angleAdd),
      )
    }
    if (id === 'melee_power') knockback += G.melee_power.knockbackAdd
    if (id === 'orb_split') splitN += 1
    if (id === 'aura_widen') auraRadiusAdd += gradeAt(g, G.aura_widen.add)
    if (id === 'aura_slow') auraSlowAdd += G.aura_slow.add
    if (id === 'chain_fork') chainJumpExtra += 1
    if (id === 'chain_reach') {
      chainReachAdd += gradeAt(g, G.chain_reach.reachAdd)
      chainJumpAdd += gradeAt(g, G.chain_reach.jumpAdd)
    }
    if (id === 'star_rain') starRateAdd += gradeAt(g, G.star_rain.add)
    if (id === 'star_crater') {
      starLifeAdd += G.star_crater.lifeAdd
      starSizeAdd += G.star_crater.sizeAdd
    }
    if (id === 'star_volley') casts += 1
    if (id === 'elem_break') elemFlame = true
    if (id === 'elem_explode') elemOrb = true
    if (id === 'elem_freeze') elemAura = true
    if (id === 'elem_amp') elemChain = true
    if (id === 'elem_weak') elemStar = true
    if (id === 'flame_dmg') flameDmgAdd += gradeAt(g, G.skill_dmg.add)
    if (id === 'flame_cd') flameCdAdd += gradeAt(g, G.skill_cd.add)
    if (id === 'orb_dmg') orbDmgAdd += gradeAt(g, G.skill_dmg.add)
    if (id === 'aura_dmg') auraDmgAdd += gradeAt(g, G.skill_dmg.add)
    if (id === 'aura_cd') auraCdAdd += gradeAt(g, G.skill_cd.add)
    if (id === 'chain_dmg') chainDmgAdd += gradeAt(g, G.skill_dmg.add)
    if (id === 'chain_cd') chainCdAdd += gradeAt(g, G.skill_cd.add)
    if (id === 'star_dmg') starDmgAdd += gradeAt(g, G.skill_dmg.add)
    if (id === 'star_scale') starScaleAdd += gradeAt(g, G.star_scale.add)
    if (id === 'rhythm_window') judgeWindowAdd += G.rhythm_window.add
    if (id === 'rhythm_fever_gain') feverGainAdd += G.rhythm_fever_gain.add
    if (id === 'rhythm_fever_hold') feverActiveSec += G.rhythm_fever_hold.addSec
    if (id === 'rhythm_combo_soft') comboBreakKeep = COMBO_BREAK_KEEP_SOFT
    if (id === 'rhythm_combo_cap') comboDmgCap = COMBO_DMG_CAP_CARD
  }
  if (graft.volley) casts += 1

  const meta = input.meta
  if (meta) {
    damageAdd += meta.damageAdd
    hasteAdd += meta.hasteAdd
    armorDr += meta.armorDr
    dodgeChance += meta.dodgeChance
    critChance += meta.critChance
    xpMul += meta.xpMulAdd
    magnetR += meta.magnetAdd
    castReachAdd += meta.castReachAdd
    castAreaAdd += meta.castAreaAdd
    hpRegen += meta.hpRegen
  }

  const cdMin = Cap.cdFactorMin
  const areaMin = Cap.rangeAreaMin
  const damageMul =
    kit.damageMul *
    stackedFactor(damageAdd) *
    (input.meta?.glass ? BLESSING_COMBAT.glassDamageMul : 1)
  const hasteMul = stackedFactor(hasteAdd, cdMin)
  const orbIntervalMul = stackedFactor(orbIntervalAdd, cdMin)
  const auraRadiusMul = stackedRangeFactor(auraRadiusAdd, areaMin)
  const chainReachMul = stackedRangeFactor(chainReachAdd, areaMin)
  const chainJumpRangeMul = stackedRangeFactor(chainJumpAdd, areaMin)
  const starRateMul = stackedFactor(starRateAdd, cdMin)
  const starSizeMul = stackedRangeFactor(starSizeAdd, areaMin)
  const starLifeMul = stackedFactor(starLifeAdd)
  const spellFlameDmg = stackedFactor(flameDmgAdd)
  const spellFlameCd = stackedFactor(flameCdAdd, cdMin)
  const spellFlameScale = 1
  const spellOrbDmg = stackedFactor(orbDmgAdd)
  const spellOrbCd = 1
  const spellAuraDmg = stackedFactor(auraDmgAdd)
  const spellAuraCd = stackedFactor(auraCdAdd, cdMin)
  const spellAuraScale = 1
  const spellChainDmg = stackedFactor(chainDmgAdd)
  const spellChainCd = stackedFactor(chainCdAdd, cdMin)
  const spellChainScale = 1
  const spellStarDmg = stackedFactor(starDmgAdd)
  const spellStarCd = 1
  const spellStarScale = stackedRangeFactor(starScaleAdd, areaMin)
  let moveSpeed = kit.moveSpeed * stackedFactor(moveSpeedAdd)
  let decay =
    heatCfg.decayPerSec * kit.heatDecayMul * stackedFactor(heatDecayAdd, Cap.heatDecayMin)
  const auraSlowMul = B.auraSlowMul * stackedFactor(auraSlowAdd)
  let feverGainMul = stackedFactor(feverGainAdd)
  let judgePerfectWin = B.judgePerfectWin * stackedFactor(judgeWindowAdd)
  let judgeGoodWin = B.judgeGoodWin * stackedFactor(judgeWindowAdd)
  let meleeRange = wp.range * stackedRangeFactor(meleeRangeAdd, areaMin)
  const reachMul = Math.min(Cap.castReach, stackedFactor(castReachAdd))
  const areaMul = stackedRangeFactor(castAreaAdd, areaMin)
  const areaLinMul = stackedFactor(castAreaAdd)

  if (meta) {
    maxHp += meta.extraHp
    luck += meta.extraLuck
    moveSpeed *= meta.moveSpeedMul
    decay *= meta.heatDecayMul
    feverGainMul *= meta.feverGainMul
    if (meta.glass) {
      maxHp = Math.max(3, maxHp - 1)
    }
    if (meta.glassworld) {
      maxHp = Math.max(meta.glass ? 2 : 3, maxHp - 1)
    }
  }

  meleeInterval *= hasteMul * spellFlameCd
  meleeDamage *= damageMul * spellFlameDmg
  meleeRange *= spellFlameScale * reachMul
  meleeHalfAngle = Math.min(Cap.meleeHalfAngle, meleeHalfAngle * areaLinMul)
  critChance = Math.min(Cap.critChance, critChance)
  critDamage = Math.min(Cap.critDamage, critDamage)
  xpMul = Math.min(Cap.xpMul, xpMul)
  magnetR = Math.min(Cap.magnetR, magnetR)
  armorDr = Math.min(Cap.armorDr, armorDr)
  dodgeChance = Math.min(Cap.dodgeChance, dodgeChance)
  feverGainMul = Math.min(FEVER_GAIN_CAP, feverGainMul)
  judgePerfectWin = Math.min(JUDGE_PERFECT_CAP, judgePerfectWin)
  judgeGoodWin = Math.min(JUDGE_GOOD_CAP, judgeGoodWin)
  feverActiveSec = Math.min(FEVER_HOLD_CAP, feverActiveSec)

  const bodyRadius = kit.radius * (meta?.radiusMul ?? 1)

  let orb: Loadout['orb'] = null
  let aura: Loadout['aura'] = null
  let chain: Loadout['chain'] = null
  let star: Loadout['star'] = null

  for (const mid of magicIds) {
    const m = MAGICS[mid]
    if (m.kind === 'orb') {
      orb = {
        interval: m.interval * orbIntervalMul * hasteMul * spellOrbCd,
        damage: m.damage * damageMul * spellOrbDmg,
        speed: m.speed,
        life: m.life * reachMul,
        radius: m.radius,
        count: m.count,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'aura') {
      aura = {
        radius: m.radius * auraRadiusMul * spellAuraScale * reachMul,
        damage: m.damage * damageMul * spellAuraDmg,
        tickInterval: m.tickInterval * hasteMul * spellAuraCd,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'chain') {
      chain = {
        range: m.range * chainReachMul * spellChainScale * reachMul,
        jumps: m.jumps + chainJumpExtra,
        jumpRange: m.jumpRange * chainJumpRangeMul * spellChainScale * areaMul,
        damage: m.damage * damageMul * spellChainDmg,
        interval: m.interval * hasteMul * spellChainCd,
        beatMul: m.beatMul,
      }
    } else if (m.kind === 'star') {
      star = {
        interval: m.interval * starRateMul * hasteMul * spellStarCd,
        damage: m.damage * damageMul * spellStarDmg,
        craterR: m.craterR * starSizeMul * spellStarScale * areaMul,
        craterLife: m.craterLife * starLifeMul,
        range: m.range * reachMul,
        beatMul: m.beatMul,
        maxCraters: 3 + Math.max(0, casts - 1),
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
    wildPick: !!meta?.wildPick,
    critChance,
    critDamage,
    xpMul,
    magnetR,
    autoPickup: !!meta?.autoPickup,
    hurtHeatMul: kit.hurtHeatMul,
    knockback:
      hasFlame || graft.knockback
        ? knockback * (graft.knockback && !hasFlame ? B.graftKnockMul : 1)
        : 0,
    splitN: orb || graft.split ? 1 + splitN : 0,
    splitR: 3.4 * areaMul,
    casts,
    auraSlowMul: aura || graft.slow ? auraSlowMul : 1,
    auraSlowT: 1.15 * areaLinMul,
    castReachMul: reachMul,
    castAreaMul: areaMul,
    graft,
    fusedOffhands,
    effectOrder: effectOrderOf(starterId, fusedOffhands),
    elem: {
      flame: elemFlame,
      orb: elemOrb,
      aura: elemAura,
      chain: elemChain,
      star: elemStar,
    },
    heatCfg,
  }
}

export type { UpgradeId }

/**
 * CombatRun BC — arena combat, spawn, weapons, wave clear.
 * (Progression/Rhythm collaborate via domainEvents + application.)
 */
export type { World } from './types'
export type * from './types'
export {
  createWorld,
  tickWorld,
  applyUpgradeToWorld,
  chooseUpgrade,
  ARENA_HALF,
  PLAY_VIEW_HALF,
  resolveWaveDurationSec,
  WAVE_DURATION_MIN_SEC,
  WAVE_DURATION_MAX_SEC,
  STANDARD_WAVES,
  isLastStandardWave,
  type RunMode,
  type CreateWorldOpts,
} from './world'
export { pushHint, tickHint, canReplaceHint } from './hints'
export { applyBeatResult, tickEnemies, tickPlayerMove, tickPlayerWeapons, tickProjectiles, tickWaveClear } from './systems'
export { bossDefForWave, bossName, type BossId } from './bosses'
export { isFeverActive, heatReady, tickFever, tryManualFever, enterFever, endFeverCrash, comboDamageMul, FEVER_ACTIVE_SEC, FEVER_COOLDOWN_SEC } from './beatBridge'
export {
  damageEnemy,
  nearestEnemy,
  hurtPlayer,
  firePlayerPattern,
  fireStarCast,
  pulseFlame,
  spawnSlash,
  tickFloaters,
} from './combat'
export { weaponHitMul, type WeaponHitCtx, type WeaponHitRole } from './weaponMods'
export { hitEffectForKind, tickPlayerStatuses, playerMoveMul } from './status'
export { tickEnemyStatuses, isFrozen } from './elemental'
export { DEFAULT_HEAT, heatToMult, tickHeat, addHeat, type HeatConfig } from './heat'
export { makeEnemyMeta, type EnemyMeta, type EnemyRole } from './enemyMeta'
export { makeOrbBulletMeta, makeFoeBulletMeta, type BulletMeta, type BulletSource } from './bulletMeta'
export { makeFlameSlashMeta, type SlashMeta } from './slashMeta'
export {
  makeStarCraterMeta,
  makeOrbBlastCraterMeta,
  type CraterMeta,
  type CraterSource,
} from './craterMeta'
export { makeChainBoltMeta, type ChainMeta, type ChainSource } from './chainMeta'
export { generateMap, hitsObstacle, moveWithObstacles } from './map'
export { pickWeather, generateField, rollWeatherCycle } from './weather'
export { mulberry32, clamp, norm, aabbOverlap, entityBox } from './math'

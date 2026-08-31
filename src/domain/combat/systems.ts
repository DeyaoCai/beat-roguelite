/**
 * Combat systems facade — split modules live beside this file.
 */
export { tickPlayerMove, tickPlayerWeapons } from './player'
export { applyBeatResult } from './beatBridge'
export { tickEnemies } from './spawn'
export { tickProjectiles } from './projectiles'
export { tickWaveClear } from './wave'

/** @deprecated use domain/progression.tickPickups */
export { tickPickups } from '../progression'

import { DEFAULT_KIT, type KitId } from './kits'
import { DEFAULT_LOOK, type LookId } from './looks'

/** 身份。不摊 Kit 字段，不内嵌衣服。 */
export type CharacterId = 'vanguard'

export type CharacterDef = {
  id: CharacterId
  name: string
  lookId: LookId
  kitId: KitId
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  vanguard: {
    id: 'vanguard',
    name: '先锋',
    lookId: DEFAULT_LOOK,
    kitId: DEFAULT_KIT,
  },
}

export const DEFAULT_CHARACTER: CharacterId = 'vanguard'

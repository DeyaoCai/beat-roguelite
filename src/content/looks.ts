/** 外观指针。衣服 / 妆 / 姿势在衣橱 persist，不写进这张表。 */
export type LookId = 'vanguard_look'

export type LookRef = {
  id: LookId
  name: string
}

export const LOOKS: Record<LookId, LookRef> = {
  vanguard_look: {
    id: 'vanguard_look',
    name: '先锋外观',
  },
}

export const DEFAULT_LOOK: LookId = 'vanguard_look'

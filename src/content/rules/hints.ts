/** 底栏提示优先级。数字越大越不该被盖掉。 */
export type HintKind = 'boss' | 'elite' | 'fuse' | 'wild' | 'weather'

export const HINT_RULES = {
  priority: {
    boss: 40,
    elite: 30,
    fuse: 25,
    wild: 20,
    weather: 10,
  },
  hold: {
    boss: 2.4,
    elite: 1.6,
    fuse: 2.5,
    wild: 2.2,
    weather: 1.8,
  },
  /** 更高档占用时，剩余秒低于此才允许同级/低级顶掉。 */
  stealBelow: 0.35,
} as const

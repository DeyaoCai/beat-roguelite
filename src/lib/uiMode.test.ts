import { describe, expect, it } from 'vitest'
import { isMiniProgramEnv, resolveUiMode } from './uiMode'

describe('resolveUiMode', () => {
  it('forces touch via query', () => {
    expect(resolveUiMode('?ui=touch', { coarse: false, width: 1400 })).toBe('touch')
    expect(resolveUiMode('?ui=mobile', { coarse: false, width: 1400 })).toBe('touch')
  })

  it('forces desk via query', () => {
    expect(resolveUiMode('?ui=desk', { coarse: true, width: 400 })).toBe('desk')
  })

  it('uses coarse pointer or narrow width', () => {
    expect(resolveUiMode('', { coarse: true, width: 1400 })).toBe('touch')
    expect(resolveUiMode('', { coarse: false, width: 430 })).toBe('touch')
    expect(resolveUiMode('', { coarse: false, width: 1280 })).toBe('desk')
  })

  it('forces touch inside mini-program / mp query', () => {
    expect(resolveUiMode('?mp=1', { coarse: false, width: 1400 })).toBe('touch')
    expect(isMiniProgramEnv('?mp=1')).toBe(true)
    expect(
      resolveUiMode('', {
        coarse: false,
        width: 1400,
        ua: 'MicroMessenger miniProgram',
      }),
    ).toBe('touch')
  })
})

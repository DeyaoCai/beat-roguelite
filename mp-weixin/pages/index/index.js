/**
 * H5 入口：GitHub Pages 发版站 + 强制触控壳。
 * 换域名时只改 DEFAULT_H5，或在小程序后台下发。
 */
const DEFAULT_H5 = 'https://deyaocai.github.io/beat-roguelite/?ui=touch&mp=1'

Page({
  data: {
    url: '',
  },

  onLoad(query) {
    const base = typeof query.h5 === 'string' && query.h5 ? decodeURIComponent(query.h5) : DEFAULT_H5
    const join = base.includes('?') ? '&' : '?'
    const url =
      base.includes('ui=') || base.includes('mp=')
        ? base
        : `${base}${join}ui=touch&mp=1`
    this.setData({ url })
  },

  onMessage() {
    /* H5 → 小程序 postMessage 预留（分享 / 回枢纽） */
  },
})

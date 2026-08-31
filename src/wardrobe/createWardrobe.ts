import { createWardrobePanel } from './ui'
import type { WardrobeApi } from './preview'

export function createWardrobe(host: HTMLElement, api: WardrobeApi) {
  return createWardrobePanel(host, api)
}

/**
 * Move `public/osz/` → co_der-resource/beat-roguelite/osz/
 * Usage: node scripts/migrate-audio-to-resource.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { RESOURCE_REPO } from './figures-resource.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const src = path.join(root, 'public/osz')
const dest = path.join(RESOURCE_REPO, 'beat-roguelite/osz')

if (!fs.existsSync(src)) {
  console.log('[migrate-audio] no public/osz — skip')
  process.exit(0)
}

fs.mkdirSync(dest, { recursive: true })
for (const name of fs.readdirSync(src)) {
  const from = path.join(src, name)
  const to = path.join(dest, name)
  if (fs.existsSync(to)) fs.rmSync(to, { recursive: true, force: true })
  fs.renameSync(from, to)
  console.log('[migrate-audio]', name)
}

if (fs.readdirSync(src).length === 0) fs.rmdirSync(src)
console.log('[migrate-audio] done →', dest)

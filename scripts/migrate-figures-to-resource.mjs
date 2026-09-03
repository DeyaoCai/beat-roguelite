/**
 * Move figure packs from `public/figures/<id>/` → co_der-resource.
 * Keeps only `public/figures/active.json` in the game repo.
 *
 * Usage: node scripts/migrate-figures-to-resource.mjs [--copy]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FIGURES_RESOURCE_ROOT } from './figures-resource.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicFigures = path.join(root, 'public/figures')
const copyOnly = process.argv.includes('--copy')

function transfer(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  if (fs.existsSync(to)) {
    if (fs.statSync(from).isDirectory()) {
      fs.rmSync(to, { recursive: true, force: true })
    } else {
      fs.rmSync(to, { force: true })
    }
  }
  if (copyOnly) fs.cpSync(from, to, { recursive: true })
  else fs.renameSync(from, to)
}

function rmEmpty(dir) {
  if (!fs.existsSync(dir)) return
  if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
}

if (!fs.existsSync(publicFigures)) {
  console.log('[migrate] no public/figures — skip')
  process.exit(0)
}

fs.mkdirSync(FIGURES_RESOURCE_ROOT, { recursive: true })

let moved = 0
for (const name of fs.readdirSync(publicFigures)) {
  if (name === 'active.json') continue
  const src = path.join(publicFigures, name)
  if (!fs.statSync(src).isDirectory()) {
    console.warn('[migrate] skip file', name)
    continue
  }
  const dest = path.join(FIGURES_RESOURCE_ROOT, name)
  console.log(`[migrate] ${copyOnly ? 'copy' : 'move'} ${name}`)
  transfer(src, dest)
  if (!copyOnly) rmEmpty(src)
  moved++
}

console.log(`[migrate] ${moved} pack(s) → ${FIGURES_RESOURCE_ROOT}`)
console.log('[migrate] kept public/figures/active.json')

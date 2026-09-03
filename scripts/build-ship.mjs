/**
 * Ship build for Gitee/GitHub Pages: procedural figures, no co_der-resource bulk.
 * Usage: node scripts/build-ship.mjs
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const viteBase = process.env.VITE_BASE ?? '/beat-roguelite/'

function run(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env, shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function reportSize() {
  const files = []
  function walk(d) {
    for (const name of fs.readdirSync(d)) {
      const p = path.join(d, name)
      const st = fs.statSync(p)
      if (st.isDirectory()) walk(p)
      else files.push(st.size)
    }
  }
  walk(dist)
  const mb = files.reduce((a, b) => a + b, 0) / (1024 * 1024)
  console.log(`[ship] dist: ${files.length} files, ${mb.toFixed(2)} MB`)
}

console.log(`[ship] VITE_BASE=${viteBase} VITE_FIGURE_BACKEND=procedural VITE_RHYTHM_ENABLED=false`)

run('pnpm', ['exec', 'tsc'])
run('pnpm', ['exec', 'vite', 'build'], {
  ...process.env,
  VITE_BASE: viteBase,
  VITE_FIGURE_BACKEND: 'procedural',
  VITE_RHYTHM_ENABLED: 'false',
})

reportSize()
console.log('[ship] done — preview: pnpm exec vite preview --base', viteBase)

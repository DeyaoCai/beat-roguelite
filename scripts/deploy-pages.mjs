/**
 * Push `dist/` to `gh-pages` branch (manual fallback; prefer GitHub Actions).
 * Usage: pnpm build:ship && node scripts/deploy-pages.mjs
 *
 * Env:
 *   PAGES_REMOTE — git remote (default `origin`)
 *   PAGES_BRANCH — deploy branch (default `gh-pages`)
 *   PAGES_MESSAGE — commit message
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const remote = process.env.PAGES_REMOTE ?? 'origin'
const branch = process.env.PAGES_BRANCH ?? 'gh-pages'
const message = process.env.PAGES_MESSAGE ?? `deploy pages ${new Date().toISOString().slice(0, 10)}`

function run(cmd, args, cwd = root) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const from = path.join(src, name)
    const to = path.join(dest, name)
    if (fs.statSync(from).isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('[pages] dist/index.html missing — run pnpm build:ship first')
  process.exit(1)
}

const workDir = path.join(root, '.pages-deploy')
fs.rmSync(workDir, { recursive: true, force: true })
fs.mkdirSync(workDir)
copyDir(dist, workDir)

console.log(`[pages] commit dist → ${remote} ${branch}`)

run('git', ['init'], workDir)
run('git', ['checkout', '-b', branch], workDir)
run('git', ['add', '-A'], workDir)
run('git', ['commit', '-m', message], workDir)
run('git', ['push', '-f', remote, `HEAD:${branch}`], workDir)

fs.rmSync(workDir, { recursive: true, force: true })
console.log('[pages] pushed — GitHub: Settings → Pages → Deploy from branch gh-pages /')

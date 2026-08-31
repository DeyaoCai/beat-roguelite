import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '../..')

function findBlender() {
  if (process.env.BLENDER && fs.existsSync(process.env.BLENDER)) return process.env.BLENDER
  const hits = []
  const roots = [
    'C:\\Program Files\\Blender Foundation\\Blender 5.2',
    'C:\\Program Files\\Blender Foundation',
    'C:\\Program Files (x86)\\Blender Foundation',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs'),
  ]
  for (const root of roots) {
    if (!root || !fs.existsSync(root)) continue
    walk(root, 4, hits)
  }
  hits.sort((a, b) => b.localeCompare(a))
  return hits[0] ?? 'blender'
}

function walk(dir, depth, hits) {
  if (depth < 0) return
  let names
  try {
    names = fs.readdirSync(dir)
  } catch {
    return
  }
  for (const name of names) {
    const p = path.join(dir, name)
    if (name.toLowerCase() === 'blender.exe') hits.push(p)
    try {
      if (fs.statSync(p).isDirectory()) walk(p, depth - 1, hits)
    } catch {
      /* skip */
    }
  }
}

const job =
  process.argv[2] && !process.argv[2].startsWith('-')
    ? path.resolve(process.argv[2])
    : fs.existsSync(path.join(here, 'outfit.json'))
      ? path.join(here, 'outfit.json')
      : path.join(here, 'outfit.example.json')

if (!fs.existsSync(job)) {
  console.error('missing outfit json:', job)
  process.exit(1)
}

const blender = findBlender()
const py = path.join(here, 'assemble.py')
extractAnims(job, blender)
stashHkxconv()
console.log('blender', blender)
console.log('job', job)

const r = spawnSync(blender, ['--background', '--python', py, '--', job], {
  cwd: repo,
  stdio: 'inherit',
  windowsHide: true,
})
process.exit(r.status ?? 1)

function blenderPython(blenderExe) {
  const dir = path.dirname(blenderExe)
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch {
    return null
  }
  for (const name of names) {
    const p = path.join(dir, name, 'python', 'bin', 'python.exe')
    if (fs.existsSync(p)) return p
  }
  return null
}

function extractAnims(jobPath, blender) {
  const cache = path.join(here, '.cache')
  const files = {
    'mt_idle.hkx': 'meshes/actors/character/animations/female/mt_idle.hkx',
    'mt_walkforward.hkx': 'meshes/actors/character/animations/female/mt_walkforward.hkx',
    'mrh_release.hkx': 'meshes/actors/character/animations/mrh_release.hkx',
    'dualmagic_idle.hkx': 'meshes/actors/character/animations/dualmagic_idle.hkx',
    'magcast_walkforward.hkx': 'meshes/actors/character/animations/magcast_walkforward.hkx',
    'skeleton_female.hkx': 'meshes/actors/character/character assets female/skeleton_female.hkx',
  }
  const missing = Object.keys(files).filter((n) => !fs.existsSync(path.join(cache, n)))
  if (!missing.length) return
  const data = JSON.parse(fs.readFileSync(jobPath, 'utf8'))
  const bsa = path.join(String(data.gameData || ''), 'Skyrim - Animations.bsa')
  if (!fs.existsSync(bsa)) {
    console.warn('skip anim extract; missing', bsa)
    return
  }
  const python = blenderPython(blender)
  if (!python) {
    console.warn('skip anim extract; no python next to blender')
    return
  }
  const args = [path.join(here, 'extract_bsa.py'), bsa, cache, ...missing.map((n) => files[n])]
  console.log('extract anims', missing.join(', '))
  const r = spawnSync(python, args, { cwd: repo, stdio: 'inherit', windowsHide: true })
  if (r.status) process.exit(r.status)
}

function stashHkxconv() {
  const dest = path.join(here, 'hkxconv.exe')
  const stray = path.join(repo, 'public/figures/skyrim-female/models/ori/hkxconv.exe')
  if (!fs.existsSync(stray)) return
  fs.renameSync(stray, dest)
  console.log('moved hkxconv.exe out of public/')
}

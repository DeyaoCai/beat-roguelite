/**
 * Lightweight DDD import guard.
 * Usage: node scripts/check-ddd.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

let bad = 0

function walk(dir, banned) {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name)
    if (fs.statSync(p).isDirectory()) walk(p, banned)
    else if (p.endsWith('.ts')) {
      const text = fs.readFileSync(p, 'utf8')
      for (const re of banned) {
        if (re.test(text)) {
          console.error(`[ddd] forbidden import in ${p}`)
          bad++
        }
      }
    }
  }
}

const src = path.resolve('src')

walk(path.join(src, 'domain'), [
  /from ['"][^'"]*\/render\//,
  /from ['"][^'"]*\/ui\//,
  /from ['"][^'"]*\/presentation\//,
  /from ['"][^'"]*\/adapters\//,
  /from ['"][^'"]*\/wardrobe\//,
  /from ['"][^'"]*\/figures\//,
  /from ['"]three['"]/,
  /from ['"][^'"]*\/application\//,
])

walk(path.join(src, 'application'), [
  /from ['"][^'"]*wardrobe\/(catalog|session|preview|ui)/,
  /from ['"][^'"]*figures\/(tka-jodi|skyrim-female|procedural)/,
])

walk(path.join(src, 'presentation'), [
  /from ['"][^'"]*figures\/(tka-jodi|skyrim-female|procedural)/,
])

walk(path.join(src, 'figures', 'kernel'), [
  /from ['"][^'"]*\/presentation\//,
  /from ['"][^'"]*\/wardrobe\//,
  /from ['"][^'"]*\/tka-jodi/,
  /from ['"][^'"]*\/skyrim-female/,
  /from ['"][^'"]*\/procedural/,
])

walk(path.join(src, 'figures', 'skyrim-female'), [
  /from ['"][^'"]*\/presentation\//,
  /from ['"][^'"]*\/wardrobe\//,
  /from ['"][^'"]*\/tka-jodi/,
  /from ['"][^'"]*\/procedural/,
])

walk(path.join(src, 'figures', 'procedural'), [
  /from ['"][^'"]*\/presentation\//,
  /from ['"][^'"]*\/wardrobe\//,
  /from ['"][^'"]*\/tka-jodi/,
  /from ['"][^'"]*\/skyrim-female/,
])

const types = path.join(src, 'figures', 'types.ts')
if (fs.existsSync(types)) {
  const text = fs.readFileSync(types, 'utf8')
  if (/from ['"][^'"]*\/presentation\//.test(text)) {
    console.error(`[ddd] forbidden import in ${types}`)
    bad++
  }
}

if (bad) {
  console.error(`check:ddd failed (${bad})`)
  process.exit(1)
}
console.log('check:ddd ok')

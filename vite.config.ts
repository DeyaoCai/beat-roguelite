import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const root = path.dirname(fileURLToPath(import.meta.url))
const resourceRoot = path.resolve(root, '../co_der-resource')

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.ogg') return 'audio/ogg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.lrc') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

/** Serve sibling co_der-resource at /res/* during dev (and preview via plugin). */
function resourceMountPlugin() {
  return {
    name: 'co-der-resource-mount',
    configureServer(server: { middlewares: { use: Function } }) {
      server.middlewares.use((req: { url?: string }, res: any, next: () => void) => {
        if (!req.url?.startsWith('/res/')) return next()
        try {
          const rel = decodeURIComponent(req.url.slice('/res/'.length).split('?')[0] ?? '')
          const file = path.resolve(resourceRoot, rel)
          if (!file.startsWith(resourceRoot)) {
            res.statusCode = 403
            res.end('forbidden')
            return
          }
          if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          res.setHeader('Content-Type', contentType(file))
          res.setHeader('Cache-Control', 'no-cache')
          fs.createReadStream(file).pipe(res)
        } catch (e) {
          res.statusCode = 500
          res.end(String(e))
        }
      })
    },
  }
}

/** GitHub Pages project site: `https://<user>.github.io/beat-roguelite/` → `/beat-roguelite/` */
const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  plugins: [resourceMountPlugin()],
  server: {
    fs: { allow: [root, resourceRoot] },
  },
})

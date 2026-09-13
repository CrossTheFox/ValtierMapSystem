import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Sirve mockups y specs en /docs/* durante `npm run dev`. */
function serveDocsPlugin() {
  return {
    name: 'serve-docs-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/docs/')) return next()

        const rel = decodeURIComponent(url.slice('/docs/'.length))
        const file = path.normalize(path.join(process.cwd(), 'docs', rel))
        const root = path.normalize(path.join(process.cwd(), 'docs'))
        if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          return next()
        }

        const ext = path.extname(file).toLowerCase()
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.webp': 'image/webp',
        }
        res.statusCode = 200
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveDocsPlugin()],
})

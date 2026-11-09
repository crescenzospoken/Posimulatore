// Server di prova: dist/ + /wms/pcn come il Worker. Uso: NODE_USE_ENV_PROXY=1 node scripts/serve.mjs [porta]
import http from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
const PORT = Number(process.argv[2] ?? 4173)
const DIST = new URL('../dist/', import.meta.url).pathname
const PCN = 'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map'
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.xml': 'application/xml' }
const cache = new Map()
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x')
  try {
    if (u.pathname === '/wms/pcn') {
      const k = u.search
      if (!cache.has(k)) {
        const r = await fetch(PCN + '&' + u.searchParams.toString())
        cache.set(k, { t: r.headers.get('content-type'), b: Buffer.from(await r.arrayBuffer()) })
      }
      const c = cache.get(k)
      res.writeHead(200, { 'Content-Type': c.t }); return res.end(c.b)
    }
    let p = normalize(join(DIST, decodeURIComponent(u.pathname)))
    if (!p.startsWith(DIST)) throw new Error('fuori')
    if (!(await stat(p).catch(() => null))?.isFile()) p = join(DIST, 'index.html')
    res.writeHead(200, { 'Content-Type': T[extname(p)] ?? 'application/octet-stream' })
    res.end(await readFile(p))
  } catch (e) { res.writeHead(500); res.end(String(e)) }
}).listen(PORT, () => console.log('http://localhost:' + PORT))

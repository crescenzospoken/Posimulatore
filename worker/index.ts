// Posimulatore: file statici + proxy dell'ortofoto del Geoportale Nazionale (servita solo in http).
interface Env { ASSETS: Fetcher }
const PCN = 'http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/WMS_v1.3/raster/ortofoto_colore_12.map'
const AMMESSI = new Set(['service', 'request', 'version', 'layers', 'styles', 'srs', 'crs', 'bbox', 'width', 'height', 'format', 'transparent'])

async function ortofoto(req: Request, url: URL, ctx: ExecutionContext): Promise<Response> {
  const q = new URLSearchParams()
  for (const [k, v] of url.searchParams) if (AMMESSI.has(k.toLowerCase())) q.set(k.toUpperCase(), v)
  if ((q.get('REQUEST') ?? '').toLowerCase() !== 'getmap') return new Response('Solo GetMap', { status: 400 })
  const w = Number(q.get('WIDTH')), h = Number(q.get('HEIGHT'))
  if (!(w > 0 && w <= 1024 && h > 0 && h <= 1024)) return new Response('Dimensioni non valide', { status: 400 })
  const b = (q.get('BBOX') ?? '').split(',').map(Number)
  // solo Italia
  if (b.length !== 4 || b.some(isNaN) || b[0] < 6 || b[2] > 19 || b[1] < 35 || b[3] > 48) return new Response('Fuori area', { status: 400 })
  const chiave = new Request('https://cache.posimulatore/wms?' + q.toString())
  const cache = caches.default
  const vecchia = await cache.match(chiave)
  if (vecchia) return vecchia
  const r = await fetch(PCN + '&' + q.toString(), { cf: { cacheTtl: 2592000, cacheEverything: true } })
  if (!r.ok || !(r.headers.get('content-type') ?? '').startsWith('image/')) return new Response('Ortofoto non disponibile', { status: 502 })
  const out = new Response(r.body, { headers: { 'Content-Type': r.headers.get('content-type')!, 'Cache-Control': 'public, max-age=2592000', 'Access-Control-Allow-Origin': '*' } })
  ctx.waitUntil(cache.put(chiave, out.clone()))
  return out
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } })
    if (url.pathname === '/wms/pcn') return ortofoto(req, url, ctx)
    return env.ASSETS.fetch(req)
  },
}

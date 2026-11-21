// Posimulatore: file statici + proxy dell'ortofoto del Geoportale Nazionale (servita solo in http).
import { api } from './api'
export interface Env { ASSETS: Fetcher; CESIUM_ION_TOKEN?: string; GOOGLE_TILES_KEY?: string; GOOGLE_CLIENT_ID?: string; DB: D1Database; ADMIN_EMAIL?: string; HOST_CANONICO?: string }
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

// Anteprima dei link (WhatsApp, Telegram, iMessage): per un percorso o un punto il titolo dice dove porta.
const nomeDaLink = (v: string | null) => (v ?? '').split(',').slice(2).join(',').trim().slice(0, 80)
const pulisci = (x: string) => x.replace(/[<>"&]/g, '')
function anteprima(url: URL, r: Response): Response {
  const q = url.searchParams, en = q.get('lang') === 'en'
  const tappe = q.get('t') ? q.get('t')!.split('|').map(x => nomeDaLink(x)) : q.get('a') ? [nomeDaLink(q.get('da')), nomeDaLink(q.get('a'))] : []
  const punto = nomeDaLink(q.get('punto'))
  let titolo = ''
  if (tappe.length >= 2) { const a = tappe[tappe.length - 1], da = tappe[0]; titolo = a ? (en ? `How to get to ${a}` : `Come arrivare a ${a}`) + (da ? (en ? ` from ${da}` : ` da ${da}`) : '') : (en ? 'Walking route in Positano' : 'Percorso a piedi a Positano') }
  else if (punto) titolo = `${punto} · Positano`
  if (!titolo) return r
  titolo = pulisci(titolo)
  const descr = en ? 'Walking route in 3D with time, steps and climb.' : 'Percorso a piedi in 3D con tempo, scale e salita.'
  const meta = (el: Element) => { const k = el.getAttribute('property') ?? el.getAttribute('name'); if (k === 'og:title' || k === 'twitter:title') el.setAttribute('content', titolo); if (k === 'og:description' || k === 'description') el.setAttribute('content', descr) }
  return new HTMLRewriter().on('title', { element: el => { el.setInnerContent(titolo) } }).on('meta', { element: meta }).transform(r)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    // Migrazione su cre.cy: con HOST_CANONICO impostato, il vecchio indirizzo workers.dev manda tutto al dominio nuovo (301).
    // Solo l'indirizzo vecchio esatto: le anteprime dei rami (altri nomi su workers.dev) restano dove sono.
    if (env.HOST_CANONICO && url.hostname === 'posimulatore.crescy.workers.dev') return Response.redirect(`https://${env.HOST_CANONICO}${url.pathname}${url.search}`, 301)
    // finché non si va live niente indicizzazione (X-Robots-Tag noindex in _headers); home, privacy e termini restano
    // leggibili dai robot perché Google controlla che la home rimandi all'informativa (schermata del consenso)
    if (url.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /$\nAllow: /privacy\nAllow: /termini\nAllow: /legale.css\nDisallow: /\n', { headers: { 'Content-Type': 'text/plain' } })
    if (url.pathname === '/wms/pcn') return ortofoto(req, url, ctx)
    if (url.pathname.startsWith('/api/')) return api(req, url, env)
    // chiavi da browser: Google Map Tiles (limitata al dominio e con tetto giornaliero nella console Google) e, di riserva, Cesium ion
    if (url.pathname === '/config') return Response.json({ googleKey: env.GOOGLE_TILES_KEY ?? '', ionToken: env.CESIUM_ION_TOKEN ?? '', googleClientId: env.GOOGLE_CLIENT_ID ?? '' }, { headers: { 'Cache-Control': 'no-store' } })
    const r = await env.ASSETS.fetch(req)
    if (url.pathname === '/' && url.search && (r.headers.get('content-type') ?? '').includes('text/html')) return anteprima(url, r)
    return r
  },
}

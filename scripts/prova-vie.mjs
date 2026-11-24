// Banco di prova: serve una build locale sotto https://posimulatore.cre.cy e misura/fotografa le vie.
// node prova.mjs --dist DIR --out DIR [--device desktop|phone] [--modo linee|dipinte] [--viste a,b] [--headed] [--attesa s] [--cpu n]
import { chromium } from 'playwright-core'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
const A = {}; { const v = process.argv.slice(2); for (let i = 0; i < v.length; i++) if (v[i].startsWith('--')) A[v[i].slice(2)] = v[i + 1] && !v[i + 1].startsWith('--') ? v[++i] : true }
const DIST = A.dist, OUT = A.out, DEV = A.device ?? 'desktop', MODO = A.modo ?? 'linee'
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream', '.gz': 'application/octet-stream', '.wasm': 'application/wasm', '.glb': 'model/gltf-binary', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' }
export const VISTE = {
  totale: [14.4858, 40.6192, 900, 6, -42],
  bivio: [14.48335, 40.62935, 222, 262, -38],
  sponda: [14.4905, 40.6250, 200, -10, -35],
  centro: [14.4852, 40.6248, 160, 0, -25],
  fornillo: [14.4795, 40.6235, 140, 10, -28],
  bivioPiombo: [14.4829, 40.6294, 420, 0, -90],
  spondaPiombo: [14.4897, 40.6280, 380, 0, -90],
  statale: [14.4872, 40.6262, 230, 330, -30],
}
const viste = (A.viste ? String(A.viste).split(',') : Object.keys(VISTE))
await mkdir(OUT, { recursive: true })
const b = await chromium.launch({ channel: 'chrome', headless: !A.headed, args: ['--use-angle=gl', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] })
const ctx = await b.newContext(DEV === 'phone' ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, serviceWorkers: 'block', userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36' } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
await ctx.route('https://posimulatore.cre.cy/**', async r => {
  const u = new URL(r.request().url())
  if (u.pathname === '/config' || u.pathname.startsWith('/api/')) return r.continue()
  let p = normalize(join(DIST, decodeURIComponent(u.pathname)))
  if (!(await stat(p).catch(() => null))?.isFile()) p = join(DIST, 'index.html')
  r.fulfill({ status: 200, contentType: T[extname(p)] ?? 'application/octet-stream', body: await readFile(p) })
})
const page = await ctx.newPage()
const log = []
page.on('console', m => { const t = m.text(); if (t.startsWith('T:')) console.log(t); if (t.includes('vie disegnate')) log.push({ t: Date.now(), ms: Number(t.match(/(\d+) ms/)?.[1]) }) })
if (A.cpu) { const c = await ctx.newCDPSession(page); await c.send('Emulation.setCPUThrottlingRate', { rate: Number(A.cpu) }) }
await page.goto('https://posimulatore.cre.cy/?prova', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => window.__S && window.__V && window.__V.viewer, null, { timeout: 60000 })
const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?' })
await page.evaluate((dip) => { window.__lt = []; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]) }).observe({ entryTypes: ['longtask'] }); window.__S.setState(st => ({ livelli: { ...st.livelli, google: true, strade: true, vieDipinte: dip, ...(window.__extra ?? {}) } })) }, MODO === 'dipinte')
await page.waitForFunction(() => window.__V.fonte3D() && window.__V.googleTileset()?.tilesLoaded, null, { timeout: 90000 }).catch(() => {})
const fonte = await page.evaluate(() => window.__V.fonte3D())
const ris = { dist: DIST, device: DEV, modo: MODO, gpu, fonte, cpu: A.cpu ?? 1, viste: {} }
const attesa = Number(A.attesa ?? (MODO === 'dipinte' ? 30 : 16)) * 1000
for (const n of viste) {
  const v = VISTE[n]
  const t0 = Date.now(), lt0 = await page.evaluate(() => performance.now())
  await page.evaluate(([lo, la, h, he, pi]) => { const { viewer, pos } = window.__V; const C = viewer.camera; C.setView({ destination: pos(lo, la, h), orientation: { heading: he * Math.PI / 180, pitch: pi * Math.PI / 180, roll: 0 } }); viewer.scene.requestRender() }, v)
  await page.waitForTimeout(1500)
  await page.waitForFunction(() => window.__V.googleTileset()?.tilesLoaded, null, { timeout: 60000 }).catch(() => {})
  const tCar = Date.now() - t0
  await page.waitForTimeout(attesa)
  const lt = await page.evaluate(t => window.__lt.filter(x => x[0] >= t).map(x => x[1]), lt0)
  await page.evaluate(() => window.__V.viewer.scene.requestRender()); await page.waitForTimeout(600)
  await page.screenshot({ path: join(OUT, `${n}.png`) })
  if (A.debug) { await page.evaluate(() => { window.__V.shader3D.setUniform('u_debug', 1); window.__V.viewer.scene.requestRender() }); await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `${n}-debug.png`) }); await page.evaluate(() => window.__V.shader3D.setUniform('u_debug', 0)) }
  // fotogrammi: 4 s di piccolo giro di sguardo, tempi fra un fotogramma e l'altro e costo del solo disegno
  const fr = await page.evaluate(async () => {
    const v = window.__V.viewer, cam = v.camera, d = []; let last = performance.now(); const start = last
    await new Promise(res => { function f() { const now = performance.now(); d.push(now - last); last = now; cam.lookRight(0.0025 * Math.sin((now - start) / 600)); v.scene.requestRender(); if (now - start < 4000) requestAnimationFrame(f); else res() } requestAnimationFrame(f) })
    const r = []; for (let i = 0; i < 40; i++) { cam.lookRight(i % 2 ? 0.002 : -0.002); const t = performance.now(); v.scene.render(); r.push(performance.now() - t) }
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1) }
    return { n: d.length, medio: +(d.reduce((a, x) => a + x, 0) / d.length).toFixed(1), p95: q(d, 0.95), max: q(d, 1), lenti50: d.filter(x => x > 50).length, render_med: q(r, 0.5), render_p95: q(r, 0.95) }
  })
  ris.viste[n] = { lette: await page.evaluate(() => window.__K?.quoteGoogleLette?.()), caricamento_ms: tCar, ridisegni: log.filter(x => x.t >= t0).map(x => x.ms), blocchi_n: lt.length, blocchi_tot: Math.round(lt.reduce((a, x) => a + x, 0)), blocco_max: Math.round(Math.max(0, ...lt)), fotogrammi: fr }
  console.log(n, JSON.stringify(ris.viste[n]))
}
await writeFile(join(OUT, 'misure.json'), JSON.stringify(ris, null, 1))
await b.close()

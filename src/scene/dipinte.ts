// Modo «Dipinte sul 3D»: le vie sono vernice stesa dallo shader del 3D di Google, non geometria.
// Le vie si disegnano su tre tele 2D (canvas) centrate dove si guarda, a dettaglio via via più grosso; lo shader del
// tileset, per ogni punto della superficie, guarda nella tela se lì passa una via e la colora SOLO se la superficie è
// (1) quasi piana (la pendenza si ricava dal fotogramma: muri e facciate restano puliti) e (2) alla quota della strada
// (tetti, chiome e terrazze sopra o sotto restano puliti). Larghezze in metri veri: da vicino la via ha la sua
// larghezza sull'asfalto, con lo zoom cresce e cala come una strada vera. Nessuna primitiva in più, nessun passaggio
// di classificazione: costa due letture di texture per pixel. Le quote sono le stesse delle «Linee» (LiDAR, corrette
// dove il 3D è stato letto a schermo): servono solo come filtro, la vernice sta sempre sulla superficie vera.
import * as C from 'cesium'
import { viewer, shader3D, textureDipinte, telefono, googleAcceso } from './viewer'
import { GEOIDE, quota as quotaTerreno } from './terreno'

/** Una via da dipingere: gruppo e campioni [x, y, z, tolleranza] nel riferimento locale (metri est, nord, su). */
export type ViaDip = { k: string; p: Float32Array }
type Tr = any // classi interne di Cesium (Texture, Sampler): esportate ma senza tipi

// riferimento locale: piano tangente nel centro di Positano; lì dentro 4 km di distanza valgono pochi millimetri di errore
const ORIGINE = C.Cartesian3.fromDegrees(14.4855, 40.624, 0)
const ENU = C.Transforms.eastNorthUpToFixedFrame(ORIGINE), ENU_INV = C.Matrix4.inverse(ENU, new C.Matrix4())
const SU = new C.Cartesian3(ENU[8], ENU[9], ENU[10])
const tmp = new C.Cartesian3(), tmpM = new C.Matrix4()
/** Da longitudine, latitudine e quota (m s.l.m.) al riferimento locale. */
export function locale(lon: number, lat: number, z: number, out: number[] = []): number[] {
  C.Matrix4.multiplyByPoint(ENU_INV, C.Cartesian3.fromDegrees(lon, lat, z + GEOIDE, undefined, tmp), tmp)
  out[0] = tmp.x; out[1] = tmp.y; out[2] = tmp.z
  return out
}

// larghezze in metri sull'asfalto (al 100%): una fascia al centro della carreggiata, non tutta la carreggiata
const LARGO: Record<string, number> = { statale: 2.8, strade: 2.3, servizio: 1.6, pedonali: 1.3, scale: 1.3, sentieri: 0.9 }
const ORDINE = ['sentieri', 'scale', 'pedonali', 'servizio', 'strade', 'statale']
// tele: lato in pixel, metri per pixel minimi e massimi (il dettaglio segue la distanza da cui si guarda)
const N = () => (telefono() ? 1024 : 2048)
const NQ = 1024
type Tela = { cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tex?: Tr; cx: number; cy: number; res: number; ok: boolean }
let tele: Tela[] = [], quote: { dati: Uint8Array; dist: Uint8Array; tex?: Tr; cx: number; cy: number; res: number } | undefined
let vie: ViaDip[] = [], percorsi = new Map<string, Path2D>()
let colori: Record<string, string> = {}, spessore = 1, acceso = false, sporco = true, sporcoQ = false, agganciato = false

function tela(): Tela {
  const cv = document.createElement('canvas'); cv.width = cv.height = N()
  return { cv, ctx: cv.getContext('2d')!, cx: 0, cy: 0, res: 0, ok: false }
}
function texDa(source: unknown, lineare: boolean, flipY: boolean): Tr {
  const K = C as unknown as Record<string, any>
  return new K.Texture({
    context: (viewer.scene as unknown as { context: unknown }).context, source, flipY, preMultiplyAlpha: flipY,
    sampler: new K.Sampler({ wrapS: K.TextureWrap.CLAMP_TO_EDGE, wrapT: K.TextureWrap.CLAMP_TO_EDGE, minificationFilter: lineare ? K.TextureMinificationFilter.LINEAR : K.TextureMinificationFilter.NEAREST, magnificationFilter: lineare ? K.TextureMagnificationFilter.LINEAR : K.TextureMagnificationFilter.NEAREST }),
  })
}
const scuro = (css: string) => { const c = C.Color.fromCssColorString(css); return new C.Color(c.red * 0.42, c.green * 0.42, c.blue * 0.42, 1).toCssColorString() }

/** Disegna una tela: prima tutti i bordi scuri, poi tutti i riempimenti, così agli incroci le vie si fondono. */
function dipingi(t: Tela, i: number, cx: number, cy: number, res: number) {
  const n = t.cv.width, g = t.ctx, s = 1 / res, td = performance.now()
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n)
  g.setTransform(s, 0, 0, -s, n / 2 - cx * s, n / 2 + cy * s)
  g.lineJoin = 'round'; g.lineCap = 'round'
  // sotto una certa larghezza a schermo la via sparirebbe: mai meno di ~2 pixel di tela
  const largo = (k: string) => Math.max((LARGO[k] ?? 2) * spessore, (k === 'statale' || k === 'strade' ? (i ? 3.4 : 2.4) : (i ? 2.3 : 1.7)) * res)
  const bordo = Math.max(0.22, 0.9 * res)
  g.setLineDash([])
  for (const k of ORDINE) { const p = percorsi.get(k); if (!p) continue; g.strokeStyle = scuro(colori[k] ?? '#fff'); g.lineWidth = largo(k) + 2 * bordo; g.stroke(p) }
  for (const k of ORDINE) {
    const p = percorsi.get(k); if (!p) continue
    g.strokeStyle = colori[k] ?? '#fff'; g.lineWidth = largo(k)
    g.stroke(p)
    // scale: da vicino i gradini (trattini scuri di traverso), come sulle carte
    if (k === 'scale' && res < 0.2) { g.save(); g.lineCap = 'butt'; g.setLineDash([0.28, 0.5]); g.strokeStyle = scuro(colori[k] ?? '#fff'); g.globalAlpha = 0.55; g.stroke(p); g.restore() }
  }
  t.cx = cx; t.cy = cy; t.res = res; t.ok = true
  if (!t.tex) { t.tex = texDa(t.cv, true, true); textureDipinte[i] = t.tex } else t.tex.copyFrom({ source: t.cv })
  if (PROVA) console.info('T: tela', i, Math.round(performance.now() - td), 'res', res.toFixed(2))
  const half = (n * res) / 2
  shader3D.setUniform('u_r' + i, new C.Cartesian3(cx - half, cy - half, 2 * half))
}
/** Quote delle vie attorno a dove si guarda: per ogni pixel la quota e la tolleranza della via più vicina. */
const PROVA = location.search.includes('prova')
function stampaQuote(cx: number, cy: number, res: number) {
  const tq = performance.now()
  if (!quote) quote = { dati: new Uint8Array(NQ * NQ * 4), dist: new Uint8Array(NQ * NQ), cx: 0, cy: 0, res: 0 }
  const q = quote, d = q.dati, ds = q.dist
  d.fill(0); ds.fill(255)
  const half = (NQ * res) / 2, x0 = cx - half, y0 = cy - half
  for (const v of vie) {
    const p = v.p, r = ((LARGO[v.k] ?? 2) * spessore) / 2 + Math.max(2.5, 2 * res), rp = Math.ceil(r / res)
    for (let i = 0; i + 4 < p.length; i += 4) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 4], by = p[i + 5]
      if (Math.max(ax, bx) < x0 - r || Math.min(ax, bx) > x0 + 2 * half + r || Math.max(ay, by) < y0 - r || Math.min(ay, by) > y0 + 2 * half + r) continue
      const passi = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / res))
      for (let s = 0; s <= passi; s++) {
        const t = s / passi, x = ax + (bx - ax) * t, y = ay + (by - ay) * t, z = p[i + 2] + (p[i + 6] - p[i + 2]) * t, tol = p[i + 3] + (p[i + 7] - p[i + 3]) * t
        const px = (x - x0) / res, py = (y - y0) / res, zc = Math.max(0, Math.min(65535, Math.round((z + 100) * 50))), tc = Math.max(1, Math.min(255, Math.round(tol * 10)))
        for (let j = Math.max(0, Math.floor(py - rp)); j <= Math.min(NQ - 1, Math.ceil(py + rp)); j++) for (let k = Math.max(0, Math.floor(px - rp)); k <= Math.min(NQ - 1, Math.ceil(px + rp)); k++) {
          const dd = Math.hypot(k + 0.5 - px, j + 0.5 - py) * res
          if (dd > r) continue
          const o = j * NQ + k, dq = Math.min(254, Math.round(dd * 10))
          if (dq >= ds[o]) continue
          ds[o] = dq; d[o * 4] = zc >> 8; d[o * 4 + 1] = zc & 255; d[o * 4 + 2] = tc; d[o * 4 + 3] = 255
        }
      }
    }
  }
  q.cx = cx; q.cy = cy; q.res = res
  const src = { width: NQ, height: NQ, arrayBufferView: d }
  if (!q.tex) { q.tex = texDa(src, false, false); textureDipinte[3] = q.tex } else q.tex.copyFrom({ source: src })
  shader3D.setUniform('u_rq', new C.Cartesian3(x0, y0, 2 * half))
  if (PROVA) console.info('T: quote', Math.round(performance.now() - tq), 'res', res.toFixed(2))
}

const centro = new C.Cartesian3()
/** Dove si guarda (punto a terra al centro dello schermo, nel riferimento locale) e da quanto lontano. */
function sguardo(): { x: number; y: number; d: number; nx: number; ny: number } {
  const cam = viewer.camera, k = cam.positionCartographic
  const lon = C.Math.toDegrees(k.longitude), lat = C.Math.toDegrees(k.latitude)
  const alto = Math.max(30, k.height - GEOIDE - quotaTerreno(lon, lat))
  const su = C.Cartesian3.normalize(cam.positionWC, tmp), giu = Math.max(0.08, -C.Cartesian3.dot(cam.directionWC, su))
  const d = Math.min(3000, alto / giu)
  C.Cartesian3.add(cam.positionWC, C.Cartesian3.multiplyByScalar(cam.directionWC, d, centro), centro)
  C.Matrix4.multiplyByPoint(ENU_INV, centro, centro)
  const n = C.Matrix4.multiplyByPoint(ENU_INV, cam.positionWC, new C.Cartesian3())
  return { x: centro.x, y: centro.y, d, nx: n.x, ny: n.y }
}
let ultimo = 0
/** A ogni fotogramma: aggiorna la matrice per lo shader; le tele si rifanno solo se la vista si è spostata abbastanza. */
function aggiorna() {
  if (!acceso || !googleAcceso()) { shader3D.setUniform('u_dip', 0); return }
  const cam = viewer.camera
  shader3D.setUniform('u_m', C.Matrix4.multiply(ENU_INV, cam.inverseViewMatrix, tmpM))
  shader3D.setUniform('u_su', C.Matrix4.multiplyByPointAsVector(cam.viewMatrix, SU, new C.Cartesian3()))
  const ora = performance.now()
  if (!sporco && !sporcoQ && ora - ultimo < 180) return
  const s = sguardo(), n = N()
  // dettaglio: circa un pixel di tela per pixel di schermo alla distanza da cui si guarda
  const r0 = Math.min(0.6, Math.max(0.1, s.d * 0.00055)), r = [r0, r0 * 4, r0 * 16]
  // la tela fine sta fra chi guarda e il punto guardato, le altre attorno al punto guardato
  const c0x = s.nx + (s.x - s.nx) * 0.7, c0y = s.ny + (s.y - s.ny) * 0.7
  const c = [[c0x, c0y], [s.x, s.y], [s.x, s.y]]
  let fatto = false
  for (let i = 0; i < 3; i++) {
    const t = tele[i] ?? (tele[i] = tela()), half = (n * r[i]) / 2
    const lontano = Math.max(Math.abs(c[i][0] - t.cx), Math.abs(c[i][1] - t.cy)) > half * 0.22
    const scalaDiversa = t.res === 0 || r[i] / t.res > 1.35 || r[i] / t.res < 0.74
    if (sporco || !t.ok || lontano || scalaDiversa) { dipingi(t, i, c[i][0], c[i][1], r[i]); fatto = true }
  }
  const rq = Math.max(1, r[1] * (n / NQ) * 0.75)
  if (sporco || sporcoQ || !quote || Math.max(Math.abs(s.x - quote.cx), Math.abs(s.y - quote.cy)) > NQ * quote.res * 0.11 || rq / quote.res > 1.35 || rq / quote.res < 0.74) { stampaQuote(s.x, s.y, rq); fatto = true }
  sporco = false; sporcoQ = false; ultimo = ora
  shader3D.setUniform('u_dip', 1)
  if (fatto) viewer.scene.requestRender()
}

/** Accende o spegne la vernice. `nuove` = vie da dipingere (null = quelle di prima). */
export function vieDipinte(on: boolean, nuove: ViaDip[] | null, col: Record<string, string>, largo: number, alfa: number) {
  if (!agganciato) { agganciato = true; viewer.scene.preRender.addEventListener(aggiorna) }
  if (nuove) {
    vie = nuove; percorsi = new Map()
    for (const v of vie) {
      const p = percorsi.get(v.k) ?? percorsi.set(v.k, new Path2D()).get(v.k)!
      p.moveTo(v.p[0], v.p[1])
      for (let i = 4; i < v.p.length; i += 4) p.lineTo(v.p[i], v.p[i + 1])
    }
    sporco = true
  }
  if (JSON.stringify(col) !== JSON.stringify(colori) || largo !== spessore) sporco = true
  colori = { ...col }; spessore = largo
  if (on !== acceso) sporco = true
  acceso = on
  shader3D.setUniform('u_alfa', alfa)
  if (!on) shader3D.setUniform('u_dip', 0)
  viewer.scene.requestRender()
}
/** Nuove quote per le stesse vie (dopo le letture del 3D): si rifà solo il filtro delle quote, non le tele. */
export function quoteDipinte(nuove: ViaDip[]) { vie = nuove; sporcoQ = true; viewer.scene.requestRender() }

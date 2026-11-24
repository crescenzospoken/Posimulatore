import * as C from 'cesium'
import { allinea, caricaAllineamento } from './allinea'
import { pos, viewer } from './viewer'
import { impostaVoci, type Voce } from './sovrapposti'
import type { LL } from '../engine/geo'
import { GEOIDE, quota as quotaTerreno } from './terreno'
import { creaRete, quoteVia, type Rete } from '../engine/percorso'
import { vieDipinte, quoteDipinte, locale, type ViaDip } from './dipinte'

export type Strada = { id: string; k: string; w: number; c: LL[]; n?: string; o?: 1; ponte?: 1; galleria?: 1; dz?: number; controllata?: boolean }
/** Correzione a mano di una via (D1, /api/vie): punti spostati sul satellite, quota in più sulle arcate. */
export type Correzione = { id: string; c: LL[]; dz: number; controllata: number; nascosta: number }
export type Luogo = { n: string; k: string; p: LL; z: number }
let strade: Strada[] = [], luoghi: Luogo[] = []
let originali = new Map<string, Strada>()
let correzioni = new Map<string, Correzione>()
const dn = new C.CustomDataSource('contesto-nomi')
const dc = new C.CustomDataSource('contesto-confine')
/** Gruppi di vie per colore; i colori si cambiano dai Livelli. */
export const GRUPPI_VIE: { k: string; nome: string; tipi: string[]; col: string; w: number }[] = [
  // di partenza come Google Maps sul satellite: statale gialla, strade bianche; pedonali, scale e sentieri distinti
  { k: 'statale', nome: 'Statale', tipi: ['primary'], col: '#fbc02d', w: 4.5 },
  { k: 'strade', nome: 'Strade', tipi: ['tertiary', 'unclassified', 'residential'], col: '#ffffff', w: 3.5 },
  { k: 'servizio', nome: 'Accessi e cortili', tipi: ['service', 'living_street'], col: '#f1f3f4', w: 2.5 },
  { k: 'pedonali', nome: 'Vie pedonali', tipi: ['pedestrian', 'footway'], col: '#d2e3fc', w: 3 },
  { k: 'scale', nome: 'Scale', tipi: ['steps'], col: '#f6aea9', w: 3 },
  { k: 'sentieri', nome: 'Sentieri e mulattiere', tipi: ['path', 'track'], col: '#a8dab5', w: 3 },
]
// Vie con i bordi morbidi (antialiasing nello shader, come Google Maps): st.t va da 0 a 1 attraverso la linea;
// fwidth dà quanto vale un pixel, l'ultimo pixel per lato sfuma. Un filo più scuro sul bordo le stacca dal 3D.
const MATERIALE_VIA = `czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material m = czm_getDefaultMaterial(materialInput);
  float d = abs(materialInput.st.t - 0.5) * 2.0;
  float px = max(fwidth(d), 1e-4);
  float a = 1.0 - smoothstep(1.0 - 1.2 * px, 1.0, d);
  float bordo = smoothstep(1.0 - 2.6 * px, 1.0 - 1.4 * px, d);
  m.diffuse = mix(color.rgb, color.rgb * 0.6, bordo * 0.7);
  m.alpha = color.a * a;
  return m;
}`
// Larghezza delle linee secondo la distanza dalla camera, come una strada vera: lo spessore scelto vale a 300 m,
// più vicino si allarga (fino a 1,6 volte), più lontano si stringe (fino a 0,45). È lo shader standard di Cesium per le
// polilinee con la larghezza moltiplicata: niente geometria da rifare quando si fa zoom.
let vsVia: string | undefined
const VS_VIA = () => (vsVia ??= (() => {
  const vs = new C.PolylineMaterialAppearance().vertexShaderSource
  const w = 'float width = abs(expandAndWidth.y) + 0.5;', n = 'vec4 next = czm_computeNextPosition();'
  if (!vs.includes(w) || !vs.includes(n)) return vs // shader di Cesium cambiato: si resta a larghezza fissa
  // p, prev e next sono relativi all'occhio: accorciarli li porta verso chi guarda lungo il raggio di vista, cioè la linea
  // resta dov'è sullo schermo ma passa la prova di profondità contro la superficie su cui poggia (mesh ruvida, quota
  // imprecisa di qualche metro); un edificio davanti, ben più vicino, la copre lo stesso
  return vs.replace(w, '').replace(n, n + ` float dcam = max(length(p.xyz), 1.0);
    float width = max(abs(expandAndWidth.y) * clamp(300.0 / dcam, 0.6, 1.35), 2.0) * czm_pixelRatio + 0.5;
    p.xyz *= 1.0 - min(0.3, (2.5 + 0.012 * dcam) / dcam);
    float dprev = max(length(prev.xyz), 1.0); prev.xyz *= 1.0 - min(0.3, (2.5 + 0.012 * dprev) / dprev);
    float dnext = max(length(next.xyz), 1.0); next.xyz *= 1.0 - min(0.3, (2.5 + 0.012 * dnext) / dnext);`)
})())
const materialeVia = (c: C.Color) => new C.Material({ translucent: true, fabric: { type: 'ViaMorbida', uniforms: { color: c }, source: MATERIALE_VIA } })
const gruppoDi = (k: string) => GRUPPI_VIE.find(g => g.tipi.includes(k)) ?? GRUPPI_VIE[1]
let vie: C.PrimitiveCollection | undefined
let nomiOn = false
let vociVie: Voce[] = []
const mat = new Map<string, C.Material>()
let coloriAttuali: Record<string, string> = {}
let quoteLidar = new Map<string, number>(), superficie = new Map<string, number>()
let rete: Rete | undefined
/** Rete dei percorsi a piedi, con le quote LiDAR (si costruisce alla prima richiesta). */
export const reteVie = () => (rete ??= creaRete(strade, zVertice, sVertice))
export const elencoVie = () => strade
export const viaOriginale = (id: string) => originali.get(id)
export const correzioneVia = (id: string) => correzioni.get(id)
/** Quota di un vertice: LiDAR se è un vertice OSM; se è stato spostato a mano, il punto LiDAR più vicino entro 12 m
 * (le strade sono tutte campionate); altrimenti il terreno a 10 m, che alla Sponda sbaglia anche di 15 m. */
const zVertice = (p: LL) => quoteLidar.get(p[0] + ',' + p[1]) ?? lidarVicino(p) ?? quotaTerreno(p[0], p[1])
let griglia: Map<string, number[][]> | undefined
const cella = (lo: number, la: number) => Math.floor(lo / 0.0002) + ',' + Math.floor(la / 0.0002)
function lidarVicino(p: LL): number | undefined {
  if (!griglia) { griglia = new Map(); for (const [k, z] of quoteLidar) { const [lo, la] = k.split(',').map(Number); const c = cella(lo, la); (griglia.get(c) ?? griglia.set(c, []).get(c)!).push([lo, la, z]) } }
  const cx = Math.floor(p[0] / 0.0002), cy = Math.floor(p[1] / 0.0002)
  let best: number | undefined, bd = 12 * 12
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of griglia.get(cx + i + ',' + (cy + j)) ?? []) {
    const d = ((q[0] - p[0]) * 84560) ** 2 + ((q[1] - p[1]) * 111030) ** 2
    if (d < bd) { bd = d; best = q[2] }
  }
  return best
}
/** Quote di una via per disegnarla: LiDAR (o terreno sui punti spostati) più l'eventuale quota delle arcate. */
let cacheQuote = new WeakMap<Strada, number[]>()
const quoteDi = (v: Strada) => { let z = cacheQuote.get(v); if (!z) { z = quoteVia(v, zVertice, sVertice); if (v.dz) z = z.map(x => x + v.dz!); cacheQuote.set(v, z) } return z }
const sVertice = (p: LL) => superficie.get(p[0] + ',' + p[1])
// solo frazioni, località, spiagge e cime: bar, farmacie e fermate ora sono punti di interesse (si accavallavano)
const NOMI = new Set(['village', 'hamlet', 'suburb', 'locality', 'beach', 'peak', 'island', 'islet'])

export async function caricaContesto() {
  const [st, lu, cf, qv] = await Promise.all([...['strade', 'luoghi', 'confine', 'quote-vie'].map(async n => (await fetch(`/data/${n}.json`)).json()), caricaAllineamento()])
  originali = new Map((st as Strada[]).map(x => [x.id, x])); luoghi = lu
  await ricaricaCorrezioni(false)
  const confine: LL[][] = cf
  quoteLidar = new Map((qv.punti as number[][]).map(p => [p[0] + ',' + p[1], p[2]]))
  superficie = new Map((qv.punti as number[][]).filter(p => p[3] !== undefined && p[3] !== null).map(p => [p[0] + ',' + p[1], p[3]]))
  const visti = new Set<string>()
  for (const l of luoghi) {
    if (!NOMI.has(l.k) || l.n === '.') continue
    const key = l.n
    if (visti.has(key)) continue
    visti.add(key)
    const grande = ['village', 'hamlet', 'suburb'].includes(l.k)
    dn.entities.add({
      id: 'lu:' + visti.size,
      position: pos(l.p[0], l.p[1], l.z + (grande ? 40 : 8)),
      label: {
        text: l.n, font: `${grande ? 600 : 500} ${grande ? 17 : 13}px system-ui, sans-serif`, fillColor: C.Color.WHITE, outlineColor: C.Color.fromCssColorString('#1b2733'),
        outlineWidth: 3, style: C.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: C.VerticalOrigin.BOTTOM,
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, grande ? 12000 : l.k === 'peak' ? 6000 : 1500),
        disableDepthTestDistance: grande ? Number.POSITIVE_INFINITY : 0, scaleByDistance: new C.NearFarScalar(200, 1, 8000, 0.7),
      },
    })
  }
  for (const r of confine)
    dc.entities.add({ polyline: { positions: C.Cartesian3.fromDegreesArray(r.flat()), width: 3, clampToGround: true, material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString('#ff5a5a'), dashLength: 24 }) } })
  await Promise.all([viewer.dataSources.add(dn), viewer.dataSources.add(dc)])
}
/** Applica le correzioni a mano alle vie di OpenStreetMap; poi rete e disegno si rifanno. */
export async function ricaricaCorrezioni(ridisegna = true) {
  try { const r = await fetch('/api/vie'); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) correzioni = new Map((await r.json() as Correzione[]).map(x => [x.id, x])) } catch { /* sviluppo senza Worker */ }
  strade = []
  for (const o of originali.values()) {
    const k = correzioni.get(o.id)
    if (k?.nascosta) continue
    strade.push(k ? { ...o, c: k.c, dz: k.dz, controllata: !!k.controllata } : o)
  }
  rete = undefined
  if (ridisegna) { const g = fatteCon; fatteCon = null; if (g !== null) disegnaVie(g) }
}
/** Mentre si corregge una via: la si ridisegna subito con i punti nuovi (senza salvare). */
export function anteprimaVia(id: string, c: LL[] | null, dz = 0) {
  const i = strade.findIndex(x => x.id === id)
  const base = correzioni.get(id) ? { ...originali.get(id)!, c: correzioni.get(id)!.c, dz: correzioni.get(id)!.dz } : originali.get(id)
  if (!base) return
  const nuova = c ? { ...base, c, dz } : base
  if (i >= 0) strade[i] = nuova; else strade.push(nuova)
  rete = undefined
  const g = fatteCon; fatteCon = null; if (g !== null) disegnaVie(g)
}
let attesaSpessore: ReturnType<typeof setTimeout> | undefined
export function mostraContesto(conStrade: boolean, nomi: boolean, confine: boolean, google: boolean, colori: Record<string, string> = {}, st: { spessore: number; alfa: number; filigrana: number; dipinte?: boolean } = stile) {
  dn.show = nomi && !google; dc.show = confine
  // lo spessore sta nella geometria: se cambia le vie si ridisegnano; le opacità sono solo colori
  // lo spessore si ridisegna quando il cursore si ferma (250 ms), non a ogni passo: ogni ridisegno rifà tutte le vie
  if (st.spessore !== stile.spessore && fatteCon !== null) { clearTimeout(attesaSpessore); attesaSpessore = setTimeout(() => { const g = fatteCon; fatteCon = null; if (g !== null) disegnaVie(g) }, 250) }
  stile = { ...st, dipinte: !!st.dipinte }
  coloriAttuali = colori
  if (conStrade) disegnaVie(google)
  if (vie) vie.show = conStrade
  if (nomiOn !== (conStrade && nomi)) { nomiOn = conStrade && nomi; impostaVoci('via', nomiOn ? vociVie : []) }
  for (const g of GRUPPI_VIE) {
    const c = C.Color.fromCssColorString(colori[g.k] ?? g.col)
    const m = mat.get(g.k)
    if (m) m.uniforms.color = c.withAlpha(stile.alfa)
    const mf = matF.get(g.k)
    if (mf) mf.uniforms.color = c.withAlpha(Math.min(FILIGRANA_ALFA, stile.filigrana))
  }
  coloriAttuali = colori
  if (stile.dipinte && google && conStrade) vieDipinte(true, null, coloriGruppi(), stile.spessore, stile.alfa)
  else if (!conStrade) vieDipinte(false, null, coloriGruppi(), stile.spessore, stile.alfa)
  viewer.scene.requestRender()
}

type P3 = [number, number, number]
const metri = (a: readonly number[], b: readonly number[]) => Math.hypot((b[0] - a[0]) * 84560, (b[1] - a[1]) * 111030)
/** Spigoli arrotondati (solo disegno): ogni angolo diventa un arco (curva di Bézier) che parte fino a `rMax` metri prima e
 * finisce altrettanto dopo, mai oltre il 45% dei due tratti. Le estremità (incroci) restano dove sono. */
export function arrotonda(p: P3[], rMax = 7): P3[] {
  if (p.length < 3) return p
  const out: P3[] = [p[0]]
  for (let i = 1; i < p.length - 1; i++) {
    const a = p[i - 1], b = p[i], c = p[i + 1], la = metri(a, b), lc = metri(b, c)
    const r = Math.min(rMax, la * 0.45, lc * 0.45)
    // quasi dritto (meno di 15°): nessun arco, il punto resta com'è
    const cos = ((b[0] - a[0]) * (c[0] - b[0]) * 84560 * 84560 + (b[1] - a[1]) * (c[1] - b[1]) * 111030 * 111030) / (la * lc || 1)
    if (r < 0.6 || cos > 0.966) { out.push(b); continue }
    const ta = r / la, tc = r / lc
    const p0: P3 = [b[0] + (a[0] - b[0]) * ta, b[1] + (a[1] - b[1]) * ta, b[2] + (a[2] - b[2]) * ta]
    const p2: P3 = [b[0] + (c[0] - b[0]) * tc, b[1] + (c[1] - b[1]) * tc, b[2] + (c[2] - b[2]) * tc]
    for (let k = 0; k <= 4; k++) { const t = k / 4, u = 1 - t; out.push([0, 1, 2].map(j => u * u * p0[j] + 2 * u * t * b[j] + t * t * p2[j]) as P3) }
  }
  out.push(p[p.length - 1])
  return out
}
const PASSO = 8
/** Il 3D si legge un punto ogni tre del tracciato (circa 12 m) e alle estremità: leggere ogni 4 m costava troppo. */
const daLeggere = (i: number, n: number) => i % 2 === 0 || i === n - 1
/** Tracciato di una via da disegnare: [lon, lat, quota di base] ogni 4 m, spigoli arrotondati. Sopra Google spostato per
 * combaciare col 3D (allinea.ts); ai punti spostati di oltre 1,5 m la quota segue la pendenza del nostro terreno.
 * Gli stessi punti si usano per leggere la quota di Google (aggiornaQuoteGoogle) e per disegnare: le chiavi coincidono. */
// il tracciato di una via non cambia finché non cambiano la via o l'allineamento: si calcola una volta sola
let cacheT = [new WeakMap<number[], P3[]>(), new WeakMap<number[], P3[]>()]
function tracciato(c0: LL[], z0: number[], sposta: boolean): P3[] {
  const fatto = cacheT[sposta ? 1 : 0].get(z0)
  if (fatto) return fatto
  const c = sposta ? c0.map(allinea) : c0
  const base = c.map((p, i): P3 => {
    const d = Math.hypot((p[0] - c0[i][0]) * 84560, (p[1] - c0[i][1]) * 111030)
    return [p[0], p[1], d < 1.5 ? z0[i] : z0[i] + Math.max(-25, Math.min(25, quotaTerreno(p[0], p[1]) - quotaTerreno(c0[i][0], c0[i][1])))]
  })
  const tond = arrotonda(base), out: P3[] = [tond[0]]
  for (let i = 1; i < tond.length; i++) {
    const a = tond[i - 1], b = tond[i], n = Math.ceil(metri(a, b) / PASSO)
    for (let j = 1; j < n; j++) { const t = j / n; out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]) }
    out.push(b)
  }
  cacheT[sposta ? 1 : 0].set(z0, out)
  return out
}
/** Un punto disegnato: posizione, quota di base `b`, correzione dal 3D `d` (z = b + d), quanto alzare la linea `a`,
 * `v` = il 3D letto lì sta alla quota della via (si può dipingere), `g` = quota letta grezza (o z se non c'è). */
type Campione = { lo: number; la: number; b: number; d: number; a: number; v: boolean; g: number; u?: boolean; l?: boolean }
/** Quote di una via disegnata sopra Google. Dove il 3D è stato letto da vicino (ogni 12 m lungo la via), la differenza fra
 * Google e la base si applica LISCIATA (mediana delle letture entro 16 m, poi media su 3 punti) e solo se è piccola (da -6 a +8 m): un punto
 * letto fuori dal ciglio (scogliera 20 m più sotto) o su un tetto non fa saltare la linea a zig-zag. Dove è letta la linea
 * sta ALZA_LETTO sopra, altrove `alza` (la quota LiDAR può stare qualche metro sotto la superficie di Google). */
const ALZA_LETTO = 0.3
function campioniVia(c0: LL[], z0: number[], google: boolean, alza: number, sposta: boolean): Campione[] {
  const t = tracciato(c0, z0, sposta)
  if (!google) return t.map(p => { const z = quotaTerreno(p[0], p[1]); return { lo: p[0], la: p[1], b: z, d: 0, a: alza, v: false, g: z } })
  const n = t.length
  const grezzo: (number | null)[] = t.map(p => { if (!sposta) return null; const g = quoteG.get(chiaveG(p)); const o = g === undefined ? null : g - p[2]; return o !== null && o >= -6 && o <= 8 ? o : null })
  // via mai letta: niente da lisciare (prima qui si cercava la lettura più vicina punto per punto: 6 s per ridisegnare)
  if (!grezzo.some(o => o !== null)) return t.map(p => ({ lo: p[0], la: p[1], b: p[2], d: 0, a: alza, v: !!sposta, u: true, g: p[2] }))
  const mediana = grezzo.map((_, i) => {
    const v: number[] = []
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) if (grezzo[k] !== null) v.push(grezzo[k] as number)
    if (!v.length) return null
    v.sort((x, y) => x - y); return v[Math.floor(v.length / 2)]
  })
  // dove non c'è lettura valida si prende quella del punto valido più vicino lungo la via
  // a due passate (avanti e indietro), lineare: il valore del punto letto più vicino
  const pieno: number[] = new Array(n), dist: number[] = new Array(n)
  for (let i = 0, ult = -1; i < n; i++) { if (mediana[i] !== null) ult = i; pieno[i] = ult < 0 ? 0 : mediana[ult] as number; dist[i] = ult < 0 ? Infinity : i - ult }
  for (let i = n - 1, ult = -1; i >= 0; i--) { if (mediana[i] !== null) ult = i; if (ult >= 0 && ult - i < dist[i]) pieno[i] = mediana[ult] as number }
  const d = pieno.map((_, i) => (pieno[Math.max(0, i - 1)] + pieno[i] + pieno[Math.min(n - 1, i + 1)]) / 3)
  const vic0 = d.map((x, i) => (grezzo[i] === null ? null : Math.abs((grezzo[i] as number) - x) <= 3))
  // fra un punto letto e l'altro vale il punto letto più vicino (entro 2 passi)
  // fra un punto letto e l'altro vale il punto letto più vicino (entro 2 passi); dove non c'è nessuna lettura vicina
  // si dipinge lo stesso con uno strato più alto (incerto), così le dipinte si vedono subito, prima delle letture
  const vic = vic0.map((v, i) => v ?? vic0[i - 1] ?? vic0[i + 1] ?? vic0[i - 2] ?? vic0[i + 2] ?? null)
  const vicino = vic.map(v => v ?? true), incerto = vic.map(v => v === null)
  const al = mediana.map(o => (o !== null ? Math.min(alza, ALZA_LETTO) : alza))
  return t.map((p, i) => {
    // il passaggio fra «letto» e no, e fra dipinto e no, si ammorbidisce su qualche punto
    let sa = 0, sv = 0, m = 0
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) { sa += al[k]; sv += vicino[k] ? 1 : 0; m++ }
    return { lo: p[0], la: p[1], b: p[2], d: d[i], a: sa / m, v: sv / m >= 0.5, g: p[2] + (grezzo[i] ?? d[i]), u: incerto[i], l: mediana[i] !== null }
  })
}
/** Incroci: le vie che si toccano in un punto prendono lì la stessa quota e la stessa altezza della linea (la media),
 * raccordandosi nei 20 m vicini; prima ogni via lisciava per conto suo e all'incrocio le linee non si incontravano. */
type Nodi = Map<string, { d: number; a: number; n: number }>
const chiaveC = (c: Campione) => chiaveG([c.lo, c.la])
function segnaNodi(nodi: Nodi, cs: Campione[]) {
  for (const c of [cs[0], cs[cs.length - 1]]) { const k = chiaveC(c), x = nodi.get(k); if (x) { x.d += c.d; x.a += c.a; x.n++ } else nodi.set(k, { d: c.d, a: c.a, n: 1 }) }
}
function raccordaNodi(nodi: Nodi, cs: Campione[]) {
  for (const da0 of [true, false]) {
    const e = da0 ? 0 : cs.length - 1, x = nodi.get(chiaveC(cs[e]))
    if (!x || x.n < 2) continue
    const dd = x.d / x.n - cs[e].d, dA = x.a / x.n - cs[e].a
    let dist = 0
    for (let k = 0; k < cs.length; k++) {
      const i = da0 ? k : cs.length - 1 - k
      if (k > 0) dist += metri([cs[i].lo, cs[i].la], [cs[da0 ? i - 1 : i + 1].lo, cs[da0 ? i - 1 : i + 1].la])
      if (dist >= 20) break
      const w = 1 - dist / 20; cs[i].d += dd * w; cs[i].a += dA * w
    }
  }
}
/** Posizioni della linea; agli incroci si allunga di 1,5 m oltre il nodo, così le linee si sovrappongono invece di
 * lasciare la tacca fra due estremità tagliate dritte. */
function posizioniLinea(cs: Campione[], nodi?: Nodi): C.Cartesian3[] {
  const v = cs.map(c => [c.lo, c.la, c.b + c.d + c.a])
  if (nodi && cs.length > 1) for (const da0 of [true, false]) {
    const e = da0 ? 0 : cs.length - 1, q = cs[da0 ? 1 : cs.length - 2]
    if ((nodi.get(chiaveC(cs[e]))?.n ?? 0) < 2) continue
    const l = metri([q.lo, q.la], [cs[e].lo, cs[e].la]); if (l < 0.2) continue
    const f = 1.5 / l, c = cs[e], ext = [c.lo + (c.lo - q.lo) * f, c.la + (c.la - q.la) * f, c.b + c.d + c.a]
    if (da0) v.unshift(ext); else v.push(ext)
  }
  return C.Cartesian3.fromDegreesArrayHeights(v.flatMap(p => [p[0], p[1], p[2] + GEOIDE]))
}
export function puntiVia(c0: LL[], z0: number[], google: boolean, alza = 1.5, sposta = google): C.Cartesian3[] {
  return posizioniLinea(campioniVia(c0, z0, google, alza, sposta))
}
// larghezza delle linee in pixel (al 100%, a 300 m): una per classe, come su una carta stradale
const PIXEL: Record<string, number> = { statale: 6.5, strade: 5, servizio: 3.5, pedonali: 3.5, scale: 3.5, sentieri: 3 }
const TOL_BASE = 25.5, TOL_LETTO = 1.3
const coloriGruppi = () => Object.fromEntries(GRUPPI_VIE.map(g => [g.k, coloriAttuali[g.k] ?? g.col]))
let fatteCon: boolean | null = null
const primPerGruppo = new Map<string, C.Primitive>()
/** Da lontano le vie piccole si impastano: scale e vicoli compaiono sotto 800 m di quota della camera, le strade sotto 2,5 km. */
// Ogni via si mostra secondo la SUA distanza dalla camera (attributo per istanza, lo calcola la GPU), non secondo l'altezza
// della camera: quella cambiava di colpo inclinando (sopra il mare 0 m, sopra la montagna 1000 m) e le vie lampeggiavano.
// Filigrana: le vie coperte dal 3D si intravedono solo da vicino (da lontano si vedrebbero attraverso le montagne)
// Quota del 3D di Google nei punti delle vie, letta a schermo mentre si guarda (mai salvata): serve solo ad appoggiare
// le linee alla superficie che si vede. Si legge da vicino (tessere dettagliate), pochi punti per volta.
const quoteG = new Map<string, number>()
const chiaveG = (p: readonly number[]) => p[0].toFixed(6) + ',' + p[1].toFixed(6)
const nonLette = new Set<string>()
let vistaLetta: { p: C.Cartesian3; d: C.Cartesian3 } | undefined
let inLettura = false, ultimoRidisegno = 0, inSospeso = false, tRid: ReturnType<typeof setTimeout> | undefined
/** Ridisegno dopo nuove letture: al massimo ogni 4 s (12 s con le dipinte), e mai mentre il disegno di prima si sta
 * ancora preparando. Sul telefono le strade dipinte ci mettono qualche secondo: rifacendo tutto a ogni lettura non
 * arrivavano mai e si vedevano solo le linee. */
function forseRidisegna() {
  clearTimeout(tRid)
  if (!inSospeso) return
  const vernice = stile.dipinte && fatteCon === true
  const manca = ultimoRidisegno + (vernice ? 1200 : 4000) - performance.now()
  if (manca > 0) { tRid = setTimeout(forseRidisegna, manca); return }
  if (vie) for (let i = 0; i < vie.length; i++) if (!(vie.get(i) as { ready: boolean }).ready) { tRid = setTimeout(forseRidisegna, 1000); return }
  inSospeso = false; ultimoRidisegno = performance.now()
  // con la vernice le letture cambiano solo le quote del filtro: niente geometria da rifare
  const tp = performance.now()
  if (vernice) quoteDipinte(listaVernice(calcolaProfili(true).profili)); else ridisegnaVie(false)
  if (location.search.includes('prova')) console.info('T: dopo letture', Math.round(performance.now() - tp))
}
/** Dopo che Google ha finito di caricare la vista: legge la quota del 3D sotto i punti delle vie entro 450 m dal centro
 * dello schermo (solo con la camera sotto i 900 m dal suolo) e, se ne ha trovate di nuove, ridisegna le vie. */
export const quoteGoogleLette = () => quoteG.size
export function aggiornaQuoteGoogle(leggi: (lon: number, lat: number, z: number) => number | undefined) {
  if (inLettura || fatteCon !== true) return
  const cam = viewer.camera, k = cam.positionCartographic
  const su = C.Cartesian3.normalize(cam.positionWC, new C.Cartesian3()), giu = -C.Cartesian3.dot(cam.directionWC, su)
  const lon0 = C.Math.toDegrees(k.longitude), lat0 = C.Math.toDegrees(k.latitude)
  const suolo = quotaTerreno(lon0, lat0) + GEOIDE, alto = k.height - suolo
  if (alto > 900 || giu < 0.2) return
  const cg = C.Cartographic.fromCartesian(C.Cartesian3.add(cam.positionWC, C.Cartesian3.multiplyByScalar(cam.directionWC, Math.min(2500, alto / giu), new C.Cartesian3()), new C.Cartesian3()))
  const cx = C.Math.toDegrees(cg.longitude), cy = C.Math.toDegrees(cg.latitude)
  // i punti coperti o fuori schermo non si ritentano finché la vista non è cambiata davvero (oltre 120 m o 25°)
  if (!vistaLetta || C.Cartesian3.distance(vistaLetta.p, cam.positionWC) > 120 || C.Cartesian3.dot(vistaLetta.d, cam.directionWC) < 0.9) { nonLette.clear(); vistaLetta = { p: C.Cartesian3.clone(cam.positionWC), d: C.Cartesian3.clone(cam.directionWC) } }
  const daFare: number[][] = []
  for (const s of strade) {
    if (!s.c.some(p => Math.abs(p[0] - cx) < 0.009 && Math.abs(p[1] - cy) < 0.007)) continue
    tracciato(s.c, quoteDi(s), true).forEach((p, i, t) => { if (daLeggere(i, t.length) && Math.hypot((p[0] - cx) * 84560, (p[1] - cy) * 111030) < 700 && !quoteG.has(chiaveG(p)) && !nonLette.has(chiaveG(p))) daFare.push([p[0], p[1], p[2]]) })
  }
  if (daFare.length < 20) return
  // prima i punti al centro dello schermo: ogni lettura costa (sul telefono lento anche 1-2 ms)
  daFare.sort((a, b) => Math.hypot((a[0] - cx) * 84560, (a[1] - cy) * 111030) - Math.hypot((b[0] - cx) * 84560, (b[1] - cy) * 111030))
  inLettura = true
  let i = 0, nuove = 0
  const passo = () => {
    const t = performance.now()
    while (i < daFare.length && (i % 64 !== 0 || performance.now() - t < 60)) { const p = daFare[i++], g = leggi(p[0], p[1], p[2]); if (g !== undefined) { quoteG.set(chiaveG(p), g); nuove++ } else nonLette.add(chiaveG(p)) }
    if (location.search.includes('prova') && performance.now() - t > 60) console.info('T: letture', Math.round(performance.now() - t))
    inLettura = false
    if (location.search.includes('prova')) console.info('T: lette', nuove, 'su', daFare.length)
    if (nuove >= 20) { inSospeso = true; forseRidisegna() }
  }
  setTimeout(passo, 0)
}
const FILIGRANA_MAX = 600, FILIGRANA_ALFA = 0.5
let stile = { spessore: 1, alfa: 0.95, filigrana: 0.38, dipinte: false }
let fatteDipinte = false
const matF = new Map<string, C.Material>()
const DISTANZA_MAX: Record<string, number> = { statale: 1e7, strade: 9000, servizio: 4500, pedonali: 4500, scale: 4500, sentieri: 4500 }
/** Vie come linee nette alla quota vera (LiDAR, o corretta a mano), 1,2 m sopra la strada; dove il 3D le copre si vedono
 * in trasparenza invece di sparire. Le linee «dipinte» sulla mesh di Google sembravano gelato sciolto dove non combaciavano.
 * Una primitiva per gruppo di colore, così il colore si cambia al volo. */
type Profili = Map<string, { z: number[]; cs: Campione[] }>
/** Quote di tutte le vie e incroci messi d'accordo. */
function calcolaProfili(google: boolean): { nodi: Nodi; profili: Profili } {
  const nodi: Nodi = new Map(), profili: Profili = new Map()
  for (const s of strade) { if (s.c.length < 2) continue; const z = quoteDi(s), cs = campioniVia(s.c, z, true, 1, google); profili.set(s.id, { z, cs }); segnaNodi(nodi, cs) }
  for (const { cs } of profili.values()) raccordaNodi(nodi, cs)
  return { nodi, profili }
}
function listaVernice(profili: Profili): ViaDip[] {
  const lista: ViaDip[] = [], q: number[] = []
  for (const s of strade) {
    const pr = profili.get(s.id); if (!pr) continue
    const p = new Float32Array(pr.cs.length * 4)
    pr.cs.forEach((c, i) => { locale(c.lo, c.la, c.b + c.d, q); p[i * 4] = q[0]; p[i * 4 + 1] = q[1]; p[i * 4 + 2] = q[2]; p[i * 4 + 3] = c.l ? TOL_LETTO : TOL_BASE })
    lista.push({ k: gruppoDi(s.k).k, p })
  }
  return lista
}
function disegnaVie(google: boolean) {
  if (fatteCon === google && fatteDipinte === stile.dipinte) return
  const t0 = performance.now()
  fatteCon = google; fatteDipinte = stile.dipinte
  const dipinte = stile.dipinte
  // le vie di prima restano a schermo finché le nuove non sono pronte (al massimo 4 s): niente lampeggio a ogni ridisegno
  const vecchie = vie
  vie = viewer.scene.primitives.add(new C.PrimitiveCollection())
  {
    // con requestRenderMode le primitive nuove finiscono di prepararsi solo se si chiedono fotogrammi: si chiedono
    // finché non sono pronte (al massimo 8 s); le vecchie restano fino ad allora
    const nuove = vie, t = performance.now()
    let tolte = !vecchie
    const togli = viewer.scene.postRender.addEventListener(() => {
      if (vecchie && !tolte) vecchie.show = nuove.show
      let pronte = true
      for (let i = 0; i < nuove.length; i++) if (!(nuove.get(i) as { ready: boolean }).ready) pronte = false
      const basta = pronte || nuove !== vie
      if (vecchie && !tolte && (basta || performance.now() - t > 4000)) { tolte = true; viewer.scene.primitives.remove(vecchie) }
      if (basta || performance.now() - t > 8000) togli()
      viewer.scene.requestRender()
    })
  }
  primPerGruppo.clear()
  vociVie = []
  const perGruppo = new Map<string, C.GeometryInstance[]>(), perGruppoF = new Map<string, C.GeometryInstance[]>()
  // prima tutte le quote, poi gli incroci messi d'accordo, poi il disegno
  const { nodi, profili } = calcolaProfili(google)
  // «Dipinte» sopra Google: niente geometria, le vie le stende lo shader del 3D (dipinte.ts)
  const vernice = dipinte && google
  if (vernice) {
    vieDipinte(true, listaVernice(profili), coloriGruppi(), stile.spessore, stile.alfa)
  } else vieDipinte(false, null, coloriGruppi(), stile.spessore, stile.alfa)
  strade.forEach(s => {
    const pr = profili.get(s.id)
    if (!pr) return
    const g = gruppoDi(s.k)
    const { z, cs } = pr
    if (!vernice) {
      const l = perGruppo.get(g.k) ?? []; perGruppo.set(g.k, l)
      const punti = posizioniLinea(cs, nodi)
      l.push(new C.GeometryInstance({ id: 'st:' + s.id, attributes: { distanceDisplayCondition: new C.DistanceDisplayConditionGeometryInstanceAttribute(0, DISTANZA_MAX[g.k] ?? 4500) }, geometry: new C.PolylineGeometry({ positions: punti, width: (PIXEL[g.k] ?? 3) * stile.spessore, vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT, arcType: C.ArcType.NONE }) }))
      // la stessa via «in filigrana»: da vicino si intravede anche dove il 3D di Google la copre (tetti, muri, mesh imprecisa)
      if (google && g.k !== 'sentieri') { const f = perGruppoF.get(g.k) ?? []; perGruppoF.set(g.k, f); f.push(new C.GeometryInstance({ attributes: { distanceDisplayCondition: new C.DistanceDisplayConditionGeometryInstanceAttribute(0, FILIGRANA_MAX) }, geometry: new C.PolylineGeometry({ positions: punti, width: (PIXEL[g.k] ?? 3) * stile.spessore, vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT, arcType: C.ArcType.NONE }) })) }
    }
    // nome della via a metà, come su Google Maps: si legge solo da vicino
    if (s.n) {
      const k = Math.floor((s.c.length - 1) / 2), p = s.c[k], q = s.c[k + 1]
      const lo = (p[0] + q[0]) / 2, la = (p[1] + q[1]) / 2, zz = (z[k] + z[k + 1]) / 2
      vociVie.push({ id: 'via:' + s.id, tipo: 'via', pos: C.Cartesian3.fromDegrees(lo, la, zz + 3 + GEOIDE), testo: s.n, maxDist: s.k === 'primary' ? 900 : 420 })
    }
  })
  for (const g of GRUPPI_VIE) {
    const inst = perGruppo.get(g.k)
    if (!inst?.length) continue
    const c = C.Color.fromCssColorString(coloriAttuali[g.k] ?? g.col)
    let m = mat.get(g.k)
    if (!m) { m = materialeVia(c.withAlpha(stile.alfa)); mat.set(g.k, m) }
    const instF = perGruppoF.get(g.k)
    if (instF?.length) {
      let mf = matF.get(g.k)
      if (!mf) { mf = materialeVia(c.withAlpha(Math.min(FILIGRANA_ALFA, stile.filigrana))); matF.set(g.k, mf) }
      // senza prova di profondità: si vede attraverso il 3D, ma tenue e solo entro FILIGRANA_MAX dalla camera
      vie.add(new C.Primitive({ geometryInstances: instF, asynchronous: true, appearance: new C.PolylineMaterialAppearance({ material: mf, translucent: true, vertexShaderSource: VS_VIA(), renderState: { depthTest: { enabled: false }, depthMask: false, blending: C.BlendingState.ALPHA_BLEND } }) }))
    }
    primPerGruppo.set(g.k, vie.add(new C.Primitive({
      geometryInstances: inst, asynchronous: true,
      appearance: new C.PolylineMaterialAppearance({ material: m, translucent: true, vertexShaderSource: VS_VIA() }),
    })))
  }
  if (nomiOn) impostaVoci('via', vociVie)
  if (location.search.includes('prova')) console.info('vie disegnate in', Math.round(performance.now() - t0), 'ms')
}
/** Per le prove: le primitive delle vie (tipo, pronta, istanze). */
export const statoVie = () => { const o: string[] = []; if (vie) for (let i = 0; i < vie.length; i++) { const x = vie.get(i) as { ready?: boolean; classificationType?: unknown; _numberOfInstances?: number; geometryInstances?: unknown[] }; o.push(`${x.classificationType !== undefined ? 'strati' : 'linee'}:${x.ready ? 'pronta' : 'no'}:${x.geometryInstances?.length ?? '?'}`) } return o.join(' ') }
/** Ridisegna le vie da capo (dopo un cambio dell'allineamento). */
export function ridisegnaVie(tutto = true) { if (tutto) { cacheT = [new WeakMap(), new WeakMap()]; cacheQuote = new WeakMap() } const g = fatteCon; fatteCon = null; if (g !== null) disegnaVie(g) }
/** Anteprima mentre si trascina con lo strumento «Allinea»: tutte le linee spostate di (e, n) metri attorno a un punto. */
export function anteprimaSpostamento(e: number, n: number, lon: number, lat: number) {
  if (!vie) return
  const enu = C.Transforms.eastNorthUpToFixedFrame(C.Cartesian3.fromDegrees(lon, lat))
  const t = new C.Cartesian3(enu[0] * e + enu[4] * n, enu[1] * e + enu[5] * n, enu[2] * e + enu[6] * n)
  const m = C.Matrix4.fromTranslation(t)
  for (let i = 0; i < vie.length; i++) { const p = vie.get(i); if (p instanceof C.Primitive) p.modelMatrix = m }
  viewer.scene.requestRender()
}
/** Per le prove: punti disegnati di una via sopra Google (spostati e con la quota corretta), come [lon, lat, m s.l.m.]. */
export function puntiDisegnati(id: string): number[][] {
  const s = strade.find(x => x.id === id)
  if (!s) return []
  return puntiVia(s.c, quoteDi(s), true, 0, true).map(p => { const g = C.Cartographic.fromCartesian(p); return [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude), g.height - GEOIDE] })
}
export const strada = (id: string) => strade.find(s => s.id === id)
export function cerca(q: string): { nome: string; tipo: string; p: LL; z?: number }[] {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const out: { nome: string; tipo: string; p: LL; z?: number }[] = []
  const visti = new Set<string>()
  for (const s of strade) if (s.n && s.n.toLowerCase().includes(t) && !visti.has(s.n)) { visti.add(s.n); out.push({ nome: s.n, tipo: 'strada', p: s.c[Math.floor(s.c.length / 2)] }) }
  for (const l of luoghi) if (l.n.toLowerCase().includes(t) && !visti.has(l.n)) { visti.add(l.n); out.push({ nome: l.n, tipo: l.k, p: l.p, z: l.z }) }
  return out.slice(0, 12)
}

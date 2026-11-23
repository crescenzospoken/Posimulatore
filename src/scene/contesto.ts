import * as C from 'cesium'
import { allinea, caricaAllineamento } from './allinea'
import { pos, viewer } from './viewer'
import { impostaVoci, type Voce } from './sovrapposti'
import type { LL } from '../engine/geo'
import { GEOIDE, quota as quotaTerreno } from './terreno'
import { creaRete, quoteVia, type Rete } from '../engine/percorso'

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
const quoteDi = (v: Strada) => { const z = quoteVia(v, zVertice, sVertice); return v.dz ? z.map(x => x + v.dz!) : z }
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
export function mostraContesto(conStrade: boolean, nomi: boolean, confine: boolean, google: boolean, colori: Record<string, string> = {}, st: { spessore: number; alfa: number; filigrana: number; dipinte?: boolean } = stile) {
  dn.show = nomi && !google; dc.show = confine
  // lo spessore sta nella geometria: se cambia le vie si ridisegnano; le opacità sono solo colori
  if (st.spessore !== stile.spessore) fatteCon = null
  stile = { ...st, dipinte: !!st.dipinte }
  if (conStrade) disegnaVie(google)
  if (vie) vie.show = conStrade
  if (nomiOn !== (conStrade && nomi)) { nomiOn = conStrade && nomi; impostaVoci('via', nomiOn ? vociVie : []) }
  for (const g of GRUPPI_VIE) {
    const c = C.Color.fromCssColorString(colori[g.k] ?? g.col)
    const m = mat.get(g.k)
    if (m) m.uniforms.color = c.withAlpha(stile.alfa)
    const mf = matF.get(g.k)
    if (mf) mf.uniforms.color = c.withAlpha(stile.filigrana)
  }
  coloriAttuali = colori
  viewer.scene.requestRender()
}

/** Punti di una via a passo di 4 m, alla quota della strada (+1,5 m perché il 3D non la copra a tratti).
 * Con Google 3D: quote LiDAR della strada ai vertici (quoteVia) e retta fra un vertice e l'altro. Senza: il nostro terreno, che è quello visibile.
 * Prima le linee erano proiettate sul terreno a 10 m: dove la strada è scavata nella roccia (la Sponda) finivano sui tetti. */
/** Quote di una via disegnata sopra Google. Base: la quota LiDAR, corretta con la pendenza del terreno se il punto è
 * stato spostato in pianta. Poi, dove il 3D è stato letto da vicino (aggiornaQuoteGoogle), la differenza fra Google e
 * la base si applica LISCIATA lungo la via (mediana su 5 punti, poi media su 3) e solo se è piccola (da -6 a +8 m):
 * un punto letto fuori dal ciglio (scogliera 20 m più sotto) o su un tetto non fa più saltare la linea a zig-zag. */
function quoteSulTreD(c0: LL[], c: LL[], z0: number[]): number[] {
  const base = z0.map((q, i) => {
    const d = Math.hypot((c[i][0] - c0[i][0]) * 84560, (c[i][1] - c0[i][1]) * 111030)
    return d < 1.5 ? q : q + Math.max(-25, Math.min(25, quotaTerreno(c[i][0], c[i][1]) - quotaTerreno(c0[i][0], c0[i][1])))
  })
  const diff: (number | null)[] = base.map((zq, i) => { const g = quoteG.get(chiaveG(c[i])); const o = g === undefined ? null : g - zq; return o !== null && o >= -6 && o <= 8 ? o : null })
  if (!diff.some(o => o !== null)) return base
  const n = diff.length
  const mediana = diff.map((_, i) => {
    const v: number[] = []
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) if (diff[k] !== null) v.push(diff[k] as number)
    if (!v.length) return null
    v.sort((x, y) => x - y); return v[Math.floor(v.length / 2)]
  })
  // dove non c'è lettura valida si prende quella del punto valido più vicino lungo la via
  const pieno = mediana.map((o, i) => { if (o !== null) return o; for (let d = 1; d < n; d++) { const x = mediana[i - d] ?? mediana[i + d]; if (x !== null && x !== undefined) return x } return 0 })
  return base.map((zq, i) => zq + (pieno[Math.max(0, i - 1)] + pieno[i] + pieno[Math.min(n - 1, i + 1)]) / 3)
}
export function puntiVia(c0: LL[], z0: number[], google: boolean, alza = 1.5, sposta = google): C.Cartesian3[] {
  // sopra Google le linee si spostano di qualche metro per combaciare con quello che si vede (solo disegno, vedi allinea.ts)
  const c = sposta ? c0.map(allinea) : c0
  // spostando in pianta su un pendio cambia anche la quota: la si corregge con la differenza del terreno fra il punto
  // nuovo e quello vecchio (altrimenti le linee spostate di 15-20 m finivano sotto il 3D)
  const z = sposta ? quoteSulTreD(c0, c, z0) : z0
  const out: number[] = []
  for (let i = 0; i < c.length; i++) {
    if (i > 0) {
      const [a, b] = [c[i - 1], c[i]]
      const d = Math.hypot((b[0] - a[0]) * 84560, (b[1] - a[1]) * 111030), n = Math.ceil(d / 4)
      for (let j = 1; j < n; j++) {
        const t = j / n, lo = a[0] + (b[0] - a[0]) * t, la = a[1] + (b[1] - a[1]) * t
        out.push(lo, la, (google ? z[i - 1] + (z[i] - z[i - 1]) * t : quotaTerreno(lo, la)) + alza + GEOIDE)
      }
    }
    out.push(c[i][0], c[i][1], (google ? z[i] : quotaTerreno(c[i][0], c[i][1])) + alza + GEOIDE)
  }
  return C.Cartesian3.fromDegreesArrayHeights(out)
}
let fatteCon: boolean | null = null
const primPerGruppo = new Map<string, C.Primitive>()
/** Da lontano le vie piccole si impastano: scale e vicoli compaiono sotto 800 m di quota della camera, le strade sotto 2,5 km. */
// Ogni via si mostra secondo la SUA distanza dalla camera (attributo per istanza, lo calcola la GPU), non secondo l'altezza
// della camera: quella cambiava di colpo inclinando (sopra il mare 0 m, sopra la montagna 1000 m) e le vie lampeggiavano.
// Filigrana: le vie coperte dal 3D si intravedono solo da vicino (da lontano si vedrebbero attraverso le montagne)
// Quota del 3D di Google nei punti delle vie, letta a schermo mentre si guarda (mai salvata): serve solo ad appoggiare
// le linee alla superficie che si vede. Si legge da vicino (tessere dettagliate), pochi punti per volta.
const quoteG = new Map<string, number>()
const chiaveG = (p: LL) => p[0].toFixed(6) + ',' + p[1].toFixed(6)
let inLettura = false, ultimoRidisegno = 0
/** Dopo che Google ha finito di caricare la vista: legge la quota del 3D sotto i punti delle vie entro 450 m dal centro
 * dello schermo (solo con la camera sotto i 900 m dal suolo) e, se ne ha trovate di nuove, ridisegna le vie. */
export const quoteGoogleLette = () => quoteG.size
export function aggiornaQuoteGoogle(leggi: (lon: number, lat: number) => number | undefined) {
  if (inLettura || fatteCon !== true || stile.dipinte) return
  const cam = viewer.camera, k = cam.positionCartographic
  const su = C.Cartesian3.normalize(cam.positionWC, new C.Cartesian3()), giu = -C.Cartesian3.dot(cam.directionWC, su)
  const lon0 = C.Math.toDegrees(k.longitude), lat0 = C.Math.toDegrees(k.latitude)
  const suolo = (leggi(lon0, lat0) ?? quotaTerreno(lon0, lat0)) + GEOIDE, alto = k.height - suolo
  if (alto > 900 || giu < 0.2) return
  const cg = C.Cartographic.fromCartesian(C.Cartesian3.add(cam.positionWC, C.Cartesian3.multiplyByScalar(cam.directionWC, Math.min(2500, alto / giu), new C.Cartesian3()), new C.Cartesian3()))
  const cx = C.Math.toDegrees(cg.longitude), cy = C.Math.toDegrees(cg.latitude)
  const daFare: LL[] = []
  for (const s of strade) {
    if (!s.c.some(p => Math.abs(p[0] - cx) < 0.006 && Math.abs(p[1] - cy) < 0.0045)) continue
    for (const p0 of s.c) { const p = allinea(p0); if (Math.hypot((p[0] - cx) * 84560, (p[1] - cy) * 111030) < 450 && !quoteG.has(chiaveG(p))) daFare.push(p) }
  }
  if (daFare.length < 20) return
  inLettura = true
  let i = 0, nuove = 0
  const passo = () => {
    const t = performance.now()
    while (i < daFare.length && performance.now() - t < 7) { const p = daFare[i++], g = leggi(p[0], p[1]); if (g !== undefined) { quoteG.set(chiaveG(p), g); nuove++ } }
    if (i < daFare.length) { setTimeout(passo, 30); return }
    inLettura = false
    if (nuove >= 20 && performance.now() - ultimoRidisegno > 4000) { ultimoRidisegno = performance.now(); ridisegnaVie() }
  }
  setTimeout(passo, 0)
}
const FILIGRANA_MAX = 1300
let stile = { spessore: 1, alfa: 0.95, filigrana: 0.38, dipinte: false }
let fatteDipinte = false
const matF = new Map<string, C.Material>()
const DISTANZA_MAX: Record<string, number> = { statale: 1e7, strade: 9000, servizio: 4500, pedonali: 4500, scale: 4500, sentieri: 4500 }
/** Vie come linee nette alla quota vera (LiDAR, o corretta a mano), 1,2 m sopra la strada; dove il 3D le copre si vedono
 * in trasparenza invece di sparire. Le linee «dipinte» sulla mesh di Google sembravano gelato sciolto dove non combaciavano.
 * Una primitiva per gruppo di colore, così il colore si cambia al volo. */
function disegnaVie(google: boolean) {
  if (fatteCon === google && fatteDipinte === stile.dipinte) return
  const t0 = performance.now()
  fatteCon = google; fatteDipinte = stile.dipinte
  const dipinte = stile.dipinte
  // le vie di prima restano a schermo finché le nuove non sono pronte (al massimo 4 s): niente lampeggio a ogni ridisegno
  const vecchie = vie
  vie = viewer.scene.primitives.add(new C.PrimitiveCollection())
  if (vecchie) {
    const nuove = vie, t = performance.now()
    const togli = viewer.scene.postRender.addEventListener(() => {
      vecchie.show = nuove.show
      let pronte = nuove.length > 0
      for (let i = 0; i < nuove.length; i++) if (!(nuove.get(i) as { ready: boolean }).ready) pronte = false
      if (pronte || performance.now() - t > 4000 || nuove !== vie) { togli(); viewer.scene.primitives.remove(vecchie); viewer.scene.requestRender() } else viewer.scene.requestRender()
    })
  }
  primPerGruppo.clear()
  vociVie = []
  const perGruppo = new Map<string, C.GeometryInstance[]>(), perGruppoF = new Map<string, C.GeometryInstance[]>()
  strade.forEach(s => {
    if (s.c.length < 2) return
    const g = gruppoDi(s.k)
    const z = quoteDi(s)
    const l = perGruppo.get(g.k) ?? []; perGruppo.set(g.k, l)
    // lo spostamento vale solo sopra Google: sul satellite (strumento «Vie») le linee restano sui punti che si trascinano
    if (dipinte) {
      // «dipinte» sulla superficie che si vede (3D di Google o terreno): niente quote, la linea segue ogni tetto e muro
      l.push(new C.GeometryInstance({ id: 'st:' + s.id, attributes: { distanceDisplayCondition: new C.DistanceDisplayConditionGeometryInstanceAttribute(0, DISTANZA_MAX[g.k] ?? 4500) }, geometry: new C.GroundPolylineGeometry({ positions: C.Cartesian3.fromDegreesArray((google ? s.c.map(allinea) : s.c).flat()), width: (g.w + 1.5) * stile.spessore }) }))
    } else {
    const punti = puntiVia(s.c, z, true, 3.5, google)
      l.push(new C.GeometryInstance({ id: 'st:' + s.id, attributes: { distanceDisplayCondition: new C.DistanceDisplayConditionGeometryInstanceAttribute(0, DISTANZA_MAX[g.k] ?? 4500) }, geometry: new C.PolylineGeometry({ positions: punti, width: (g.w + 1.5) * stile.spessore, vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT, arcType: C.ArcType.NONE }) }))
      // la stessa via «in filigrana»: da vicino si intravede anche dove il 3D di Google la copre (tetti, muri, mesh imprecisa)
      if (google) { const f = perGruppoF.get(g.k) ?? []; perGruppoF.set(g.k, f); f.push(new C.GeometryInstance({ attributes: { distanceDisplayCondition: new C.DistanceDisplayConditionGeometryInstanceAttribute(0, FILIGRANA_MAX) }, geometry: new C.PolylineGeometry({ positions: punti, width: (g.w + 1.5) * stile.spessore, vertexFormat: C.PolylineMaterialAppearance.VERTEX_FORMAT, arcType: C.ArcType.NONE }) })) }
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
      if (!mf) { mf = materialeVia(c.withAlpha(stile.filigrana)); matF.set(g.k, mf) }
      // senza prova di profondità: si vede attraverso il 3D, ma tenue e solo entro FILIGRANA_MAX dalla camera
      vie.add(new C.Primitive({ geometryInstances: instF, asynchronous: true, appearance: new C.PolylineMaterialAppearance({ material: mf, translucent: true, renderState: { depthTest: { enabled: false }, depthMask: false, blending: C.BlendingState.ALPHA_BLEND } }) }))
    }
    if (dipinte) { vie.add(new C.GroundPolylinePrimitive({ geometryInstances: inst, asynchronous: true, appearance: new C.PolylineMaterialAppearance({ material: m, translucent: true }), classificationType: google ? C.ClassificationType.CESIUM_3D_TILE : C.ClassificationType.TERRAIN })); continue }
    primPerGruppo.set(g.k, vie.add(new C.Primitive({
      geometryInstances: inst, asynchronous: true,
      appearance: new C.PolylineMaterialAppearance({ material: m, translucent: true }),
    })))
  }
  if (nomiOn) impostaVoci('via', vociVie)
  if (location.search.includes('prova')) console.info('vie disegnate in', Math.round(performance.now() - t0), 'ms')
}
/** Ridisegna le vie da capo (dopo un cambio dell'allineamento). */
export function ridisegnaVie() { const g = fatteCon; fatteCon = null; if (g !== null) disegnaVie(g) }
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

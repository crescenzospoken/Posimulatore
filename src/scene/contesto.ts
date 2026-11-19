import * as C from 'cesium'
import { pos, viewer } from './viewer'
import { impostaVoci, type Voce } from './sovrapposti'
import type { LL } from '../engine/geo'
import { GEOIDE, quota as quotaTerreno } from './terreno'
import { creaRete, quoteVia, type Rete } from '../engine/percorso'

export type Strada = { id: string; k: string; w: number; c: LL[]; n?: string; o?: 1; ponte?: 1; galleria?: 1 }
export type Luogo = { n: string; k: string; p: LL; z: number }
let strade: Strada[] = [], luoghi: Luogo[] = []
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
const gruppoDi = (k: string) => GRUPPI_VIE.find(g => g.tipi.includes(k)) ?? GRUPPI_VIE[1]
let vie: C.PrimitiveCollection | undefined
let nomiOn = false
let vociVie: Voce[] = []
const mat = new Map<string, C.Material>()
let quoteLidar = new Map<string, number>(), superficie = new Map<string, number>()
let rete: Rete | undefined
/** Rete dei percorsi a piedi, con le quote LiDAR (si costruisce alla prima richiesta). */
export const reteVie = () => (rete ??= creaRete(strade, zVertice, sVertice))
const zVertice = (p: LL) => quoteLidar.get(p[0] + ',' + p[1]) ?? quotaTerreno(p[0], p[1])
const sVertice = (p: LL) => superficie.get(p[0] + ',' + p[1])
// solo frazioni, località, spiagge e cime: bar, farmacie e fermate ora sono punti di interesse (si accavallavano)
const NOMI = new Set(['village', 'hamlet', 'suburb', 'locality', 'beach', 'peak', 'island', 'islet'])

export async function caricaContesto() {
  const [st, lu, cf, qv] = await Promise.all(['strade', 'luoghi', 'confine', 'quote-vie'].map(async n => (await fetch(`/data/${n}.json`)).json()))
  strade = st; luoghi = lu
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
export function mostraContesto(conStrade: boolean, nomi: boolean, confine: boolean, google: boolean, colori: Record<string, string> = {}) {
  dn.show = nomi && !google; dc.show = confine
  if (conStrade) disegnaVie(google)
  if (vie) vie.show = conStrade
  if (nomiOn !== (conStrade && nomi)) { nomiOn = conStrade && nomi; impostaVoci('via', nomiOn ? vociVie : []) }
  for (const g of GRUPPI_VIE) { const m = mat.get(g.k); if (m) m.uniforms.color = C.Color.fromCssColorString(colori[g.k] ?? g.col).withAlpha(0.9) }
  viewer.scene.requestRender()
}

/** Punti di una via a passo di 4 m, alla quota della strada (+1,5 m perché il 3D non la copra a tratti).
 * Con Google 3D: quote LiDAR della strada ai vertici (quoteVia) e retta fra un vertice e l'altro. Senza: il nostro terreno, che è quello visibile.
 * Prima le linee erano proiettate sul terreno a 10 m: dove la strada è scavata nella roccia (la Sponda) finivano sui tetti. */
export function puntiVia(c: LL[], z: number[], google: boolean, alza = 1.5): C.Cartesian3[] {
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
const primPerGruppo = new Map<string, C.GroundPolylinePrimitive>()
/** Da lontano le vie piccole si impastano: scale e vicoli compaiono sotto 800 m di quota della camera, le strade sotto 2,5 km. */
function altezzaVie() {
  const h = viewer.camera.positionCartographic.height
  for (const [k, p] of primPerGruppo) p.show = k === 'statale' || (k === 'strade' ? h < 2500 : h < 800)
}
let altezzaAgganciata = false
/** Vie «dipinte» sulla superficie visibile (Google 3D o il nostro terreno), come su Google Earth: niente linee sospese
 * che si sovrappongono male o spariscono sotto la mesh. Una primitiva per gruppo, così il colore si cambia al volo. */
function disegnaVie(google: boolean) {
  if (fatteCon === google) return
  const t0 = performance.now()
  fatteCon = google
  if (vie) viewer.scene.primitives.remove(vie)
  vie = viewer.scene.primitives.add(new C.PrimitiveCollection())
  vociVie = []
  const r = reteVie()
  const perGruppo = new Map<string, C.GeometryInstance[]>()
  strade.forEach((s, i) => {
    const g = gruppoDi(s.k)
    if (s.c.length > 1) {
      const l = perGruppo.get(g.k) ?? []; perGruppo.set(g.k, l)
      l.push(new C.GeometryInstance({ id: 'st:' + s.id, geometry: new C.GroundPolylineGeometry({ positions: C.Cartesian3.fromDegreesArray(s.c.flat()), width: g.w }) }))
    }
    // nome della via a metà, come su Google Maps: si legge solo da vicino
    if (s.n && s.c.length > 1) {
      const z = r.quote[i] ?? quoteVia(s, zVertice, sVertice)
      const k = Math.floor((s.c.length - 1) / 2), p = s.c[k], q = s.c[k + 1]
      const lo = (p[0] + q[0]) / 2, la = (p[1] + q[1]) / 2, zz = google ? (z[k] + z[k + 1]) / 2 : quotaTerreno(lo, la)
      vociVie.push({ id: 'via:' + s.id, tipo: 'via', pos: C.Cartesian3.fromDegrees(lo, la, zz + 3 + GEOIDE), testo: s.n, maxDist: s.k === 'primary' ? 900 : 420 })
    }
  })
  for (const g of GRUPPI_VIE) {
    const inst = perGruppo.get(g.k)
    if (!inst?.length) continue
    let m = mat.get(g.k)
    if (!m) { m = C.Material.fromType('Color', { color: C.Color.fromCssColorString(g.col).withAlpha(0.9) }); mat.set(g.k, m) }
    primPerGruppo.set(g.k, vie.add(new C.GroundPolylinePrimitive({
      geometryInstances: inst, appearance: new C.PolylineMaterialAppearance({ material: m }),
      classificationType: google ? C.ClassificationType.CESIUM_3D_TILE : C.ClassificationType.TERRAIN, asynchronous: true,
    })))
  }
  altezzaVie()
  if (!altezzaAgganciata) { altezzaAgganciata = true; viewer.scene.preRender.addEventListener(altezzaVie) }
  if (nomiOn) impostaVoci('via', vociVie)
  if (location.search.includes('prova')) console.info('vie disegnate in', Math.round(performance.now() - t0), 'ms')
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

import * as C from 'cesium'
import { pos, viewer, googleTileset, quotaGoogle } from './viewer'
import { quota as quotaTerreno, GEOIDE } from './terreno'
/** Quota del suolo: Google 3D se acceso e caricato lì, altrimenti il nostro terreno a 10 m. */
export const quota = (lon: number, lat: number) => quotaGoogle(lon, lat) ?? quotaTerreno(lon, lat)
let giro = 0
/** Da chiamare quando le quote di Google cambiano: ridisegna gli oggetti appoggiati al suolo. */
export const quoteCambiate = () => { giro++ }
import { edificiVicini } from './edifici'
import { Frame, type LL, type XY, add, frameFor, mul, norm, perp, rect, sub, dist } from '../engine/geo'
import type { Obj } from '../engine/model'
import { modello, type Parte } from '../engine/catalogo'
import { calcolaPiazza, PIAZZA_DEF, type Piazza, type PiazzaPar } from '../engine/piazza'
import { materiale } from './materiali'
import { filaStalli, type Disposizione, type TipoStallo } from '../engine/stalli'

const ds = new C.CustomDataSource('oggetti')
const hs = new C.CustomDataSource('maniglie')
let pronto = false
const firme = new Map<string, string>()
const entita = new Map<string, C.Entity[]>()
export const calcoli = new Map<string, Piazza>()

const COLORI: Record<string, string> = { bianco: '#f7f7f2', giallo: '#f2c230', blu: '#2f6fd6', rosso: '#d23b2f', verde: '#2e9e4f' }
export const USI: Record<string, { nome: string; col: string }> = {
  attesa: { nome: 'Area di attesa (protezione civile)', col: '#2e9e4f' },
  pedonale: { nome: 'Area pedonale', col: '#d9c7a0' },
  ztl: { nome: 'ZTL', col: '#d23b2f' },
  cantiere: { nome: 'Cantiere', col: '#f08a24' },
  verde: { nome: 'Verde', col: '#4f9a3c' },
  parcheggio: { nome: 'Parcheggio', col: '#2f6fd6' },
  mercato: { nome: 'Mercato / evento', col: '#9b59b6' },
}
const col = (c: string, a = 1) => C.Color.fromCssColorString(c).withAlpha(a)

export async function avviaOggetti() {
  if (pronto) return
  await viewer.dataSources.add(ds)
  await viewer.dataSources.add(hs)
  pronto = true
}

/** Quota d'appoggio di un punto: quella dell'oggetto, se fissata, altrimenti il terreno. */
const zDi = (o: Obj, p: LL) => (o.z ?? quota(p[0], p[1]))

function corr(id: string, pts: Cartesian3Like, w: number, c: C.Color, h?: number): C.Entity {
  return new C.Entity({ id, corridor: { positions: pts, width: w, material: c, ...(h !== undefined ? { height: h } : {}), cornerType: C.CornerType.MITERED, classificationType: C.ClassificationType.BOTH } })
}
type Cartesian3Like = C.Cartesian3[]
const posArr = (f: Frame, xy: XY[], z?: number) => xy.map(p => { const l = f.toLL(p); return z === undefined ? C.Cartesian3.fromDegrees(l[0], l[1]) : pos(l[0], l[1], z) })

function costruisci(o: Obj, selezionato: boolean): C.Entity[] {
  const out: C.Entity[] = []
  let n = 0
  const id = () => `${o.id}:${n++}`
  const par = o.par
  const f = frameFor(o.pts)
  const xy = o.pts.map(p => f.toXY(p))
  const sopra = o.z !== undefined
  switch (o.tipo) {
    case 'linea': case 'arresto': {
      if (xy.length < 2) break
      const c = col(COLORI[String(par.colore ?? 'bianco')] ?? '#fff')
      const w = o.tipo === 'arresto' ? 0.5 : Number(par.larghezza ?? 0.12)
      const z = sopra ? o.z! + 0.02 : undefined
      const stile = String(par.stile ?? 'continua')
      const tratti: XY[][] = []
      if (stile === 'tratteggiata') {
        const d = Number(par.tratto ?? 3), g = Number(par.vuoto ?? 3)
        for (let i = 1; i < xy.length; i++) {
          const a = xy[i - 1], b = xy[i], L = dist(a, b), u = norm(sub(b, a))
          for (let s = 0; s < L; s += d + g) tratti.push([add(a, mul(u, s)), add(a, mul(u, Math.min(L, s + d)))])
        }
      } else if (stile === 'doppia') {
        for (const k of [-1, 1]) {
          const off = k * (w + 0.1) / 2 + k * w / 2
          tratti.push(xy.map((p, i) => { const a = xy[Math.max(0, i - 1)], b = xy[Math.min(xy.length - 1, i + 1)]; return add(p, mul(perp(norm(sub(b, a))), off)) }))
        }
      } else tratti.push(xy)
      for (const t of tratti) out.push(corr(id(), posArr(f, t, z), w, c, z === undefined ? undefined : z + GEOIDE))
      break
    }
    case 'zebra': {
      if (xy.length < 2) break
      const [a, b] = xy
      const L = dist(a, b), u = norm(sub(b, a)), v = perp(u)
      const prof = Number(par.profondita ?? 2.5), sw = 0.5, gap = Number(par.vuoto ?? 0.5)
      const z = sopra ? o.z! + 0.02 : undefined
      for (let s = 0.25; s + sw <= L; s += sw + gap) {
        const r = rect(add(add(a, mul(u, s)), mul(v, -prof / 2)), u, sw, prof)
        out.push(poligono(id(), f, r, col('#f7f7f2'), z))
      }
      break
    }
    case 'stalli': {
      if (xy.length < 2) break
      const disp = String(par.disposizione ?? 'linea') as Disposizione
      const tipo = String(par.tipoStallo ?? 'auto') as TipoStallo
      const lato = (Number(par.lato ?? 1) >= 0 ? 1 : -1) as 1 | -1
      const colore = String(par.colore ?? (tipo === 'disabili' || tipo === 'carico' ? 'giallo' : 'bianco'))
      const c = col(COLORI[colore] ?? '#fff')
      const z = sopra ? o.z! + 0.02 : undefined
      const rs = filaStalli(xy, disp, tipo, lato)
      for (const r of rs) {
        out.push(poligono(id(), f, r, c.withAlpha(0.16), z))
        for (let i = 0; i < 4; i++) out.push(corr(id(), posArr(f, [r[i], r[(i + 1) % 4]], z), 0.12, c, z === undefined ? undefined : z + GEOIDE))
      }
      const m = xy[Math.floor(xy.length / 2)]
      const l = f.toLL(m)
      out.push(new C.Entity({ id: id(), position: pos(l[0], l[1], zDi(o, l) + 2.5), label: etichetta(`${rs.length} posti ${tipo === 'auto' ? '' : tipo}`.trim(), selezionato) }))
      break
    }
    case 'freccia': {
      const p = xy[0] ?? [0, 0]
      const th = (Number(par.rot ?? 0) * Math.PI) / 180
      const u: XY = [Math.sin(th), Math.cos(th)], v = perp(u)
      const L = Number(par.lunghezza ?? 4.5)
      const pts: XY[] = [[-0.15, 0], [-0.15, L - 1.2], [-0.5, L - 1.2], [0, L], [0.5, L - 1.2], [0.15, L - 1.2], [0.15, 0]].map(([x, y]) => add(add(p, mul(v, -x)), mul(u, y - L / 2)))
      out.push(poligono(id(), f, pts, col('#f7f7f2'), sopra ? o.z! + 0.02 : undefined))
      break
    }
    case 'area': {
      if (xy.length < 3) break
      const uso = USI[String(par.uso ?? 'pedonale')] ?? USI.pedonale
      const c = col(String(par.colore ?? uso.col))
      out.push(poligono(id(), f, xy, c.withAlpha(0.45), sopra ? o.z! + 0.03 : undefined))
      out.push(corr(id(), posArr(f, [...xy, xy[0]], sopra ? o.z! + 0.04 : undefined), 0.25, c, sopra ? o.z! + 0.04 + GEOIDE : undefined))
      const cen = f.toLL([0, 0])
      out.push(new C.Entity({ id: id(), position: pos(cen[0], cen[1], zDi(o, cen) + 3), label: etichetta(o.nome, selezionato) }))
      break
    }
    case 'volume': {
      if (xy.length < 3) break
      const base = o.z ?? Math.min(...o.pts.map(p => quota(p[0], p[1]))) - 0.5
      const top = (o.z ?? Math.max(...o.pts.map(p => quota(p[0], p[1])))) + Number(par.altezza ?? 6)
      out.push(new C.Entity({ id: id(), polygon: { hierarchy: posArr(f, xy, 0), height: base + GEOIDE, extrudedHeight: top + GEOIDE, material: col(String(par.colore ?? '#e9d8bd'), Number(par.opacita ?? 1)), outline: false, shadows: C.ShadowMode.ENABLED } }))
      break
    }
    case 'barriera': {
      if (xy.length < 2) break
      const tipo = String(par.tipo ?? 'transenna')
      const H: Record<string, [number, string, number]> = { transenna: [1.1, '#d0d4d8', 0.55], newjersey: [0.8, '#c8c4bc', 1], ringhiera: [1.1, '#2f3a33', 0.7], muro: [Number(par.altezza ?? 2), '#e6dccb', 1], vetro: [1.1, '#bfe3f2', 0.35] }
      const [h, c, a] = H[tipo] ?? H.transenna
      const dense: LL[] = []
      for (let i = 1; i < xy.length; i++) {
        const A = xy[i - 1], B = xy[i], k = Math.max(1, Math.ceil(dist(A, B)))
        for (let j = i === 1 ? 0 : 1; j <= k; j++) dense.push(f.toLL(add(A, mul(sub(B, A), j / k))))
      }
      const zs = dense.map(p => zDi(o, p))
      out.push(new C.Entity({ id: id(), wall: { positions: dense.map((p, i) => pos(p[0], p[1], zs[i] + h)), minimumHeights: zs.map(z => z + GEOIDE), maximumHeights: zs.map(z => z + h + GEOIDE), material: col(c, a), shadows: C.ShadowMode.ENABLED } }))
      break
    }
    case 'modello': {
      const m = modello(String(par.m))
      const p = o.pts[0]
      if (!p) break
      const z0 = zDi(o, p)
      const th = (Number(par.rot ?? 0) * Math.PI) / 180
      const sc = Number(par.scala ?? 1)
      const hz = Number(par.alto ?? 0)
      const fr = new Frame(p[0], p[1])
      for (const pt of m.parti) out.push(parte(id(), fr, z0, th, pt, sc, hz))
      if (selezionato) out.push(new C.Entity({ id: id(), position: pos(p[0], p[1], z0 + m.dim[2] * sc + 1.2), label: etichetta(o.nome, true) }))
      break
    }
    case 'testo': {
      const p = o.pts[0]
      if (p) out.push(new C.Entity({ id: id(), position: pos(p[0], p[1], zDi(o, p) + Number(par.alto ?? 4)), label: etichetta(String(par.testo ?? o.nome), selezionato) }))
      break
    }
    case 'piazza': {
      if (xy.length < 3) break
      const pp: PiazzaPar = { ...PIAZZA_DEF, ...(par as Partial<PiazzaPar>), quota: o.z ?? Math.max(...o.pts.map(q => quota(q[0], q[1]))) }
      const cen = f.toLL([0, 0])
      const vicini = edificiVicini(cen[0], cen[1], 0.002).map(e => ({ id: e.id, poly: e.r.map(q => f.toXY(q)) }))
      const P = calcolaPiazza(xy, pp, q => { const l = f.toLL(q); return quota(l[0], l[1]) }, vicini)
      calcoli.set(o.id, P)
      const g = GEOIDE
      const piano = posArr(f, P.poly, 0)
      const buco = P.rampa ? [new C.PolygonHierarchy(posArr(f, P.rampa, 0))] : []
      // soletta
      out.push(new C.Entity({ id: id(), polygon: { hierarchy: new C.PolygonHierarchy(piano, buco), height: pp.quota - pp.spessore + g, extrudedHeight: pp.quota + g, material: col('#c9c3b7'), shadows: C.ShadowMode.ENABLED } }))
      // pavimentazione in pietra chiara a lastre di 60 cm
      const xs = P.poly.map(q => q[0]), ys = P.poly.map(q => q[1])
      const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys)
      out.push(new C.Entity({ id: id(), polygon: { hierarchy: new C.PolygonHierarchy(piano, buco), height: pp.quota + 0.02 + g, material: materiale(par.pavimento === 'cotto' ? 'cotto' : 'pietra', par.pavimento === 'cotto' ? '#c98a66' : String(par.pavimento ?? '#e6dccb'), bw, bh), stRotation: Math.atan2(P.u[1], P.u[0]), shadows: C.ShadowMode.RECEIVE_ONLY } }))
      // cordolo in pietra lungo il bordo
      out.push(new C.Entity({ id: id(), corridor: { positions: posArr(f, [...P.poly, P.poly[0]], 0), width: 0.45, height: pp.quota + 0.05 + g, material: col('#f1ede4'), cornerType: C.CornerType.MITERED } }))
      // parapetto in muratura bianca con copertina, sui lati liberi
      if (pp.parapetto) {
        const n = P.poly.length
        const ai = P.poly.findIndex((q, i) => { const r = P.poly[(i + 1) % n]; return Math.abs((r[0] - q[0]) * P.u[1] - (r[1] - q[1]) * P.u[0]) < 1e-6 && (r[0] - q[0]) * P.u[0] + (r[1] - q[1]) * P.u[1] > 0 })
        for (let i = 0; i < n; i++) {
          if (i === ai) continue
          const seg = [P.poly[i], P.poly[(i + 1) % n]]
          const q = pp.quota + g
          // due facce a 30 cm l'una dall'altra, più la copertina: un muretto pieno
          const nrm: XY = perp(norm(sub(seg[1], seg[0])))
          for (const d of [0, -0.3]) {
            const sg = seg.map(pt => add(pt, mul(nrm, d)))
            out.push(new C.Entity({ id: id(), wall: { positions: posArr(f, sg, 0), minimumHeights: [q, q], maximumHeights: [q + 1.05, q + 1.05], material: materiale('intonaco', '#f6f3ec', dist(seg[0], seg[1]), 2.4), shadows: C.ShadowMode.ENABLED } }))
          }
          const cop = [seg[0], seg[1], add(seg[1], mul(nrm, -0.3)), add(seg[0], mul(nrm, -0.3))]
          out.push(new C.Entity({ id: id(), polygon: { hierarchy: posArr(f, cop, 0), height: q + 1.05, extrudedHeight: q + 1.1, material: col('#d8d0c0') } }))
        }
      }
      // piani di parcheggio
      for (const L of P.livelli) {
        if (L.k === 0) continue
        const ultimo = L.k === pp.livelli
        out.push(new C.Entity({ id: id(), polygon: { hierarchy: new C.PolygonHierarchy(piano, !ultimo ? buco : []), height: L.pavimento - pp.spessore + g, extrudedHeight: L.pavimento + g, material: col('#b9b5ad'), shadows: C.ShadowMode.ENABLED } }))
        out.push(new C.Entity({ id: id(), polygon: { hierarchy: new C.PolygonHierarchy(piano, !ultimo ? buco : []), height: L.pavimento + 0.015 + g, material: materiale('asfalto', '#8d8f92', bw, bh) } }))
        for (const r of L.stalli) for (let i = 0; i < 3; i++) out.push(new C.Entity({ id: id(), polyline: { positions: posArr(f, [r[i], r[i + 1]], L.pavimento + 0.03), width: 2, material: col('#ffffff') } }))
      }
      // basamento: dal terreno al fondo dell'ultimo piano
      if (pp.livelli > 0 && par.scava === true) { const fondo = pp.quota - pp.livelli * pp.hLiv - pp.spessore; out.push(new C.Entity({ id: id(), polygon: { hierarchy: piano, height: Math.min(P.terrenoMin, fondo) - 1.5 + g, extrudedHeight: fondo + g, material: col('#aaa294') } })) }
      // rampe
      if (P.rampa) for (let k = 0; k < pp.livelli; k++) {
        const zt = pp.quota - k * pp.hLiv, zb = zt - pp.hLiv
        const [a, b, c, d] = P.rampa
        const ll = [a, b, c, d].map(q => f.toLL(q))
        const zs = [zt, zb, zb, zt]
        out.push(new C.Entity({ id: id(), polygon: { hierarchy: ll.map((q, i) => pos(q[0], q[1], zs[i] + 0.05)), perPositionHeight: true, material: col('#8f8b84') } }))
      }
      // pilastri
      for (const c of P.pilastri) {
        const l = f.toLL(c.p)
        const h = c.cima - c.base
        out.push(new C.Entity({ id: id(), position: pos(l[0], l[1], c.base + h / 2), orientation: orient(l, Math.atan2(P.u[0], P.u[1])), box: { dimensions: new C.Cartesian3(0.4, 0.4, h), material: col('#c9c6bf'), shadows: C.ShadowMode.ENABLED } }))
      }
      // muri contro terra e di bordo
      for (const m of P.muri) {
        if (!m.controTerra) continue
        const ll = m.pts.map(q => f.toLL(q))
        if (m.cima.every(z => z <= m.base + 0.05)) continue
        out.push(new C.Entity({ id: id(), wall: { positions: ll.map((q, i) => pos(q[0], q[1], m.cima[i])), minimumHeights: ll.map(() => m.base + g), maximumHeights: m.cima.map(z => z + g), material: materiale('calcestruzzo', '#c2bcb0', dist(m.a, m.b), 4.8), shadows: C.ShadowMode.ENABLED } }))
      }
      out.push(new C.Entity({ id: id(), position: pos(cen[0], cen[1], pp.quota + 9), label: etichetta(`${o.nome}\n${Math.round(P.area)} m²${P.stalliTot ? ` · ${P.stalliTot} posti auto` : ''}`, selezionato) }))
      break
    }
  }
  return out
}
function poligono(id: string, f: Frame, xy: XY[], c: C.Color, z?: number): C.Entity {
  return new C.Entity({ id, polygon: { hierarchy: posArr(f, xy, z ?? 0), material: c, ...(z === undefined ? { classificationType: C.ClassificationType.BOTH } : { height: z + GEOIDE, perPositionHeight: false }) } })
}
function etichetta(t: string, sel: boolean): C.LabelGraphics.ConstructorOptions {
  // cartellino pieno, senza contorno: si legge su qualsiasi sfondo e non si sdoppia
  return {
    text: t, font: '600 15px system-ui, sans-serif', fillColor: C.Color.WHITE, style: C.LabelStyle.FILL,
    showBackground: true, backgroundColor: C.Color.fromCssColorString(sel ? '#1677b8' : '#10202c').withAlpha(0.88),
    backgroundPadding: new C.Cartesian2(9, 6), verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -8),
    distanceDisplayCondition: new C.DistanceDisplayCondition(0, 700), disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}
function orient(l: LL, heading: number, pitch = 0, roll = 0) {
  return C.Transforms.headingPitchRollQuaternion(C.Cartesian3.fromDegrees(l[0], l[1]), new C.HeadingPitchRoll(heading, pitch, roll)) as unknown as C.Property
}
function parte(id: string, fr: Frame, z0: number, th: number, p: Parte, sc: number, hz: number): C.Entity {
  const [x, y, z] = p.c
  const rx = (x * Math.cos(th) + y * Math.sin(th)) * sc, ry = (-x * Math.sin(th) + y * Math.cos(th)) * sc
  const l = fr.toLL([rx, ry])
  const zz = z * sc + (hz && p.f === 'box' && p.c[2] > 1 ? 0 : 0)
  const c = col(p.col)
  if (p.f === 'box') {
    const d = p.d.map(v => v * sc) as [number, number, number]
    if (hz && d[2] > 3) { d[2] = hz; return new C.Entity({ id, position: pos(l[0], l[1], z0 + hz / 2), orientation: orient(l, th), box: { dimensions: new C.Cartesian3(...d), material: c, shadows: C.ShadowMode.ENABLED } }) }
    return new C.Entity({ id, position: pos(l[0], l[1], z0 + zz), orientation: orient(l, th), box: { dimensions: new C.Cartesian3(...d), material: c, shadows: C.ShadowMode.ENABLED } })
  }
  if (p.f === 'cil') return new C.Entity({ id, position: pos(l[0], l[1], z0 + zz), orientation: orient(l, th), cylinder: { length: p.h * sc, topRadius: p.r * sc, bottomRadius: (p.r2 ?? p.r) * sc, material: c, shadows: C.ShadowMode.ENABLED } })
  return new C.Entity({ id, position: pos(l[0], l[1], z0 + zz), orientation: orient(l, th), ellipsoid: { radii: new C.Cartesian3(...p.r.map(v => v * sc) as [number, number, number]), material: c, shadows: C.ShadowMode.ENABLED } })
}

/** Ridisegna solo gli oggetti cambiati. */
export function disegnaOggetti(lista: Obj[], sel: string | null, vSel: number | null = null) {
  if (!pronto) return
  const vivi = new Set(lista.map(o => o.id))
  ds.entities.suspendEvents()
  for (const [id, es] of entita) if (!vivi.has(id)) { es.forEach(e => ds.entities.remove(e)); entita.delete(id); firme.delete(id); calcoli.delete(id) }
  for (const o of lista) {
    const firma = JSON.stringify(o) + (o.id === sel ? '*' : '') + (o.z === undefined || o.tipo === 'piazza' ? giro : '')
    if (firme.get(o.id) === firma) continue
    entita.get(o.id)?.forEach(e => ds.entities.remove(e))
    const es = costruisci(o, o.id === sel)
    es.forEach(e => ds.entities.add(e))
    entita.set(o.id, es)
    firme.set(o.id, firma)
  }
  ds.entities.resumeEvents()
  maniglie(lista.find(o => o.id === sel) ?? null, vSel)
  scavi(lista)
  viewer.scene.requestRender()
}
function maniglie(o: Obj | null, vSel: number | null = null) {
  hs.entities.removeAll()
  if (!o) return
  const chiuso = o.tipo === 'area' || o.tipo === 'volume' || o.tipo === 'piazza'
  const n = o.pts.length
  o.pts.forEach((p, i) => {
    const sel = i === vSel
    hs.entities.add({
      id: `h:${o.id}:${i}`, position: pos(p[0], p[1], zDi(o, p) + 0.3),
      point: { pixelSize: sel ? 17 : 13, color: C.Color.fromCssColorString(sel ? '#ffd84a' : '#cfeeff'), outlineColor: C.Color.fromCssColorString('#1677b8'), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      ...(n > 1 ? { label: { text: String(i + 1), font: '700 12px system-ui, sans-serif', fillColor: C.Color.fromCssColorString('#0b3d5c'), showBackground: true, backgroundColor: C.Color.WHITE.withAlpha(0.9), backgroundPadding: new C.Cartesian2(4, 2), pixelOffset: new C.Cartesian2(14, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 400) } } : {}),
    })
  })
  // misura di ogni lato, a metà lato
  if (n > 1) {
    const f = new Frame(o.pts[0][0], o.pts[0][1])
    for (let i = 0; i < (chiuso ? n : n - 1); i++) {
      const a = o.pts[i], b = o.pts[(i + 1) % n]
      const l = dist(f.toXY(a), f.toXY(b))
      const m: LL = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      hs.entities.add({ position: pos(m[0], m[1], zDi(o, m) + 0.3), label: { text: l.toFixed(2).replace('.', ',') + ' m', font: '600 12px system-ui, sans-serif', fillColor: C.Color.BLACK, showBackground: true, backgroundColor: C.Color.fromCssColorString('#ffd84a').withAlpha(0.92), backgroundPadding: new C.Cartesian2(5, 3), disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: new C.DistanceDisplayCondition(0, 300) } })
    }
  }
}
/** Le piazze con piani sotto il terreno scavano il terreno (e Google 3D) dentro il loro perimetro. */
function scavi(lista: Obj[]) {
  // terreno nostro: si scava solo dove i piani stanno sotto terra
  // Google 3D: una piazza toglie sempre ciò che c'è dentro il suo perimetro (il progetto sostituisce l'esistente)
  const terra: C.Cartesian3[][] = [], google: C.Cartesian3[][] = []
  for (const o of lista) {
    if (o.par.scava !== true) continue
    const posiz = o.pts.map(p => C.Cartesian3.fromDegrees(p[0], p[1]))
    if (o.tipo === 'piazza') {
      google.push(posiz)
      const P = calcoli.get(o.id)
      if (P && P.scavo >= 1) terra.push(posiz)
    } else if (o.tipo === 'volume' && o.par.scava) { terra.push(posiz); google.push(posiz) }
  }
  const metti = (vecchia: C.ClippingPolygonCollection | undefined, l: C.Cartesian3[][], set: (c: C.ClippingPolygonCollection) => void) => {
    if (!vecchia) { if (l.length) set(new C.ClippingPolygonCollection({ polygons: l.map(positions => new C.ClippingPolygon({ positions })) })); return }
    vecchia.removeAll()
    for (const positions of l) vecchia.add(new C.ClippingPolygon({ positions }))
  }
  metti(viewer.scene.globe.clippingPolygons, terra, c => { viewer.scene.globe.clippingPolygons = c })
  const t = googleTileset()
  if (t) metti(t.clippingPolygons, google, c => { t.clippingPolygons = c })
}

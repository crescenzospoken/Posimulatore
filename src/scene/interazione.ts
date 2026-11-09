import * as C from 'cesium'
import { viewer, pos } from './viewer'
import { GEOIDE, quota } from './terreno'
import { useS, type Misura } from '../store'
import type { LL } from '../engine/geo'
import { uid } from '../engine/model'

export type Punto = { p: LL; z: number; su?: string }
/** Punto 3D sotto il cursore: terreno, edifici, oggetti o Google 3D. */
export function puntoA(win: C.Cartesian2): Punto | null {
  const s = viewer.scene
  let c: C.Cartesian3 | undefined
  if (s.pickPositionSupported) c = s.pickPosition(win)
  if (!c) { const ray = viewer.camera.getPickRay(win); if (ray) c = s.globe.pick(ray, s) }
  if (!c) return null
  const g = C.Cartographic.fromCartesian(c)
  if (!g) return null
  const p: LL = [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)]
  let z = g.height - GEOIDE
  const zt = quota(p[0], p[1])
  // se il punto è a meno di 30 cm dal terreno lo appoggiamo al terreno
  if (Math.abs(z - zt) < 0.3 || !isFinite(z)) z = zt
  const pk = s.pick(win)
  const su = pk && pk.id instanceof C.Entity ? String(pk.id.id).split(':')[0] : undefined
  return { p, z, su }
}
const idDi = (pk: unknown): string | null => {
  if (!pk || typeof pk !== 'object') return null
  const o = pk as { id?: unknown }
  if (o.id instanceof C.Entity) return String(o.id.id)
  if (typeof o.id === 'string') return o.id
  return null
}

let anteprima: C.Entity | undefined
let cursore: LL | null = null
let trascina: { id: string; i: number | null; da: LL; orig: LL[] } | null = null

export function avviaInterazione(onCursore: (p: Punto | null) => void, fine: () => void) {
  const h = new C.ScreenSpaceEventHandler(viewer.canvas)
  const S = () => useS.getState()
  const ctrl = viewer.scene.screenSpaceCameraController

  anteprima = viewer.entities.add({
    polyline: {
      positions: new C.CallbackProperty(() => {
        const s = S()
        const pts = s.strumento.k === 'disegna' ? s.bozza : s.strumento.k === 'misura' ? (s.misure.at(-1)?.pts.map(q => q.p) ?? []) : []
        const tutti = [...pts, ...(cursore && pts.length && (s.strumento.k === 'disegna' || s.strumento.k === 'misura') ? [cursore] : [])]
        if (s.strumento.k === 'disegna' && (s.strumento.min >= 3) && tutti.length > 2) tutti.push(tutti[0])
        return tutti.length > 1 ? C.Cartesian3.fromDegreesArray(tutti.flat()) : []
      }, false),
      width: 3, clampToGround: true,
      material: new C.PolylineDashMaterialProperty({ color: C.Color.fromCssColorString('#38b6ff'), dashLength: 12 }),
    },
  })

  h.setInputAction((e: C.ScreenSpaceEventHandler.PositionedEvent) => {
    const s = S()
    const t = s.strumento
    if (t.k === 'cammina') return
    const pt = puntoA(e.position)
    if (t.k === 'disegna') {
      if (!pt) return
      const b = [...s.bozza, pt.p]
      // il primo punto decide la quota d'appoggio: se si clicca su una piazza o un volume, si sta lì sopra
      if (b.length === 1) zBozza = pt.su && pt.su !== 'h' && s.opzione().oggetti.some(o => o.id === pt.su && (o.tipo === 'piazza' || o.tipo === 'volume')) ? pt.z : undefined
      useS.setState({ bozza: b })
      viewer.scene.requestRender()
      if (b.length >= t.max) fine()
      return
    }
    if (t.k === 'misura') {
      if (!pt) return
      const m = s.misure.at(-1)
      const nuova = !m || m.modo !== t.modo || chiusa(m)
      const lista: Misura[] = nuova ? [...s.misure, { id: uid(), modo: t.modo, pts: [pt] }] : [...s.misure.slice(0, -1), { ...m, pts: [...m.pts, pt] }]
      useS.setState({ misure: lista })
      return
    }
    // naviga: selezione
    const pk = viewer.scene.pick(e.position)
    const id = idDi(pk)
    if (id?.startsWith('ed:')) { useS.setState({ selEdificio: id.slice(3), sel: null, pannello: 'oggetto', info: pt ? { p: pt.p, z: pt.z } : null }); return }
    if (id && !id.startsWith('st:') && !id.startsWith('lu:') && !id.startsWith('h:')) {
      const oid = id.split(':')[0]
      if (s.opzione().oggetti.some(o => o.id === oid)) { useS.setState({ sel: oid, selEdificio: null, pannello: 'oggetto' }); return }
    }
    useS.setState({ sel: null, selEdificio: null, info: pt ? { p: pt.p, z: pt.z } : null, pannello: pt ? 'oggetto' : s.pannello })
  }, C.ScreenSpaceEventType.LEFT_CLICK)

  h.setInputAction(() => { if (S().strumento.k === 'disegna') fine() }, C.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

  h.setInputAction((e: C.ScreenSpaceEventHandler.PositionedEvent) => {
    const s = S()
    if (s.strumento.k !== 'naviga' || !s.sel) return
    const id = idDi(viewer.scene.pick(e.position))
    if (!id) return
    const o = s.opzione().oggetti.find(x => x.id === s.sel)
    if (!o) return
    let i: number | null = null
    if (id.startsWith('h:')) { const [, oid, k] = id.split(':'); if (oid !== o.id) return; i = Number(k) }
    else if (id.split(':')[0] !== o.id) return
    const pt = puntoA(e.position)
    if (!pt) return
    ctrl.enableInputs = false
    s.aggiorna(o.id, () => {}, true) // un passo nella storia prima di muovere
    trascina = { id: o.id, i, da: pt.p, orig: o.pts.map(q => [...q] as LL) }
  }, C.ScreenSpaceEventType.LEFT_DOWN)

  h.setInputAction(() => {
    if (trascina) { trascina = null; ctrl.enableInputs = true }
  }, C.ScreenSpaceEventType.LEFT_UP)

  let ultimo = 0
  h.setInputAction((e: C.ScreenSpaceEventHandler.MotionEvent) => {
    const now = performance.now()
    if (trascina) {
      const pt = puntoGlobo(e.endPosition)
      if (!pt) return
      const d: LL = [pt[0] - trascina.da[0], pt[1] - trascina.da[1]]
      const tr = trascina
      S().aggiorna(tr.id, o => {
        o.pts = tr.orig.map((q, k) => (tr.i === null || tr.i === k ? [q[0] + d[0], q[1] + d[1]] : q) as LL)
      }, false)
      return
    }
    if (now - ultimo < 40) return
    ultimo = now
    const pt = puntoA(e.endPosition)
    cursore = pt?.p ?? null
    onCursore(pt)
    const k = S().strumento.k
    if (k === 'disegna' || k === 'misura') viewer.scene.requestRender()
  }, C.ScreenSpaceEventType.MOUSE_MOVE)

  // tocco: su telefono il trascinamento con un dito sposta l'oggetto selezionato come col mouse
  return () => { h.destroy(); if (anteprima) viewer.entities.remove(anteprima) }
}
let zBozza: number | undefined
export const quotaBozza = () => zBozza
function puntoGlobo(win: C.Cartesian2): LL | null {
  const ray = viewer.camera.getPickRay(win)
  const c = ray && viewer.scene.globe.pick(ray, viewer.scene)
  if (!c) return null
  const g = C.Cartographic.fromCartesian(c)
  return [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)]
}
export const chiusa = (m: Misura) => (m.modo === 'quota' && m.pts.length >= 1) || (m.modo === 'altezza' && m.pts.length >= 2)

// ---------- disegno delle misure ----------
const dm = new C.CustomDataSource('misure')
let dmPronto = false
export async function disegnaMisure(lista: Misura[]) {
  if (!dmPronto) { await viewer.dataSources.add(dm); dmPronto = true }
  dm.entities.removeAll()
  for (const m of lista) {
    const P = m.pts.map(q => pos(q.p[0], q.p[1], q.z + 0.05))
    m.pts.forEach((q, i) => dm.entities.add({ position: P[i], point: { pixelSize: 9, color: C.Color.fromCssColorString('#ffd84a'), outlineColor: C.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY } }))
    if (m.modo === 'quota' && m.pts[0]) {
      dm.entities.add({ position: P[0], label: lab(`${m.pts[0].z.toFixed(1).replace('.', ',')} m s.l.m.`) })
      continue
    }
    if (P.length > 1) {
      const chiudi = m.modo === 'area' && P.length > 2
      dm.entities.add({ polyline: { positions: chiudi ? [...P, P[0]] : P, width: 3, material: C.Color.fromCssColorString('#ffd84a'), depthFailMaterial: C.Color.fromCssColorString('#ffd84a').withAlpha(0.5) } })
    }
    if (m.modo === 'area' && P.length > 2) dm.entities.add({ polygon: { hierarchy: P, material: C.Color.fromCssColorString('#ffd84a').withAlpha(0.25), classificationType: C.ClassificationType.BOTH } })
    const r = risultato(m)
    if (r && P.length > 1) {
      const c = C.BoundingSphere.fromPoints(P).center
      dm.entities.add({ position: c, label: lab(r) })
    }
  }
  viewer.scene.requestRender()
}
const lab = (t: string): C.LabelGraphics.ConstructorOptions => ({ text: t, font: '600 14px system-ui, sans-serif', fillColor: C.Color.BLACK, showBackground: true, backgroundColor: C.Color.fromCssColorString('#ffd84a'), pixelOffset: new C.Cartesian2(0, -18), disableDepthTestDistance: Number.POSITIVE_INFINITY })
import { Frame } from '../engine/geo'
const fmt = (v: number, d = 2) => v.toFixed(d).replace('.', ',')
export function risultato(m: Misura): string {
  const p = m.pts
  if (m.modo === 'quota') return p[0] ? `${fmt(p[0].z, 1)} m s.l.m.` : ''
  if (p.length < 2) return ''
  const f = new Frame(p[0].p[0], p[0].p[1])
  if (m.modo === 'altezza') return `Dislivello ${fmt(Math.abs(p[1].z - p[0].z))} m`
  if (m.modo === 'area') {
    if (p.length < 3) return ''
    const xy = p.map(q => f.toXY(q.p))
    let a = 0
    for (let i = 0; i < xy.length; i++) { const u = xy[i], v = xy[(i + 1) % xy.length]; a += u[0] * v[1] - v[0] * u[1] }
    return `${Math.round(Math.abs(a) / 2).toLocaleString('it-IT')} m²`
  }
  let o = 0, d3 = 0
  for (let i = 1; i < p.length; i++) {
    const a = f.toXY(p[i - 1].p), b = f.toXY(p[i].p)
    const dh = Math.hypot(b[0] - a[0], b[1] - a[1])
    o += dh; d3 += Math.hypot(dh, p[i].z - p[i - 1].z)
  }
  const dz = p.at(-1)!.z - p[0].z
  return `${fmt(o)} m in pianta · ${fmt(d3)} m reali · dislivello ${fmt(dz, 1)} m · pendenza ${o > 0 ? Math.round((dz / o) * 100) : 0}%`
}

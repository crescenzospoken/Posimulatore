import * as C from 'cesium'
import { viewer } from './viewer'
import { GEOIDE } from './terreno'
import { aspettoFacciate } from './facciate'
import type { LL } from '../engine/geo'

export type Edificio = { id: string; r: LL[]; b: number; g: number; h: number; stima: boolean; n?: string; t?: string }
let dati: Edificio[] = []
let prim: C.Primitive | undefined
let ultima = ''
const PALETTE = ['#ffffff', '#fbf8f1', '#ffffff', '#f9f3e6', '#fde3c8', '#f9cfb1', '#f6b99c', '#fbe39f', '#f7d7a6', '#f3c3b5', '#ffffff', '#f6e7c8', '#fbd2a2', '#eeb48c', '#fff7e8']
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h) }

export async function caricaEdifici() {
  dati = await (await fetch('/data/edifici.json')).json()
  return dati
}
export const edificio = (id: string) => dati.find(e => e.id === id)
export const coloreDi = (id: string) => PALETTE[hash(id) % PALETTE.length]
export function edificiVicini(lon: number, lat: number, r = 0.0015) {
  return dati.filter(e => Math.abs(e.r[0][0] - lon) < r && Math.abs(e.r[0][1] - lat) < r)
}

export function disegnaEdifici(visibile: boolean, modifiche: Record<string, { h?: number; via?: boolean; col?: string }>, sel: string | null, rossi: string[] = [], plastico = true) {
  const chiave = JSON.stringify(modifiche) + '|' + sel + '|' + rossi.join(',') + '|' + plastico
  const R = new Set(rossi)
  if (prim) prim.show = visibile
  if (!visibile || chiave === ultima) return
  ultima = chiave
  const inst: C.GeometryInstance[] = []
  for (const e of dati) {
    const m = modifiche[e.id]
    if (m?.via) continue
    const h = m?.h ?? e.h
    const col = e.id === sel ? C.Color.fromCssColorString('#8fd3ff') : R.has(e.id) ? C.Color.fromCssColorString('#e8796b') : C.Color.fromCssColorString(m?.col ?? PALETTE[hash(e.id) % PALETTE.length])
    inst.push(new C.GeometryInstance({
      id: 'ed:' + e.id,
      geometry: new C.PolygonGeometry({
        polygonHierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(e.r.flat())),
        height: e.b + GEOIDE,
        extrudedHeight: e.g + h + GEOIDE,
        vertexFormat: C.VertexFormat.POSITION_AND_NORMAL,
      }),
      attributes: {
        color: C.ColorGeometryInstanceAttribute.fromColor(col),
        base: new C.GeometryInstanceAttribute({ componentDatatype: C.ComponentDatatype.FLOAT, componentsPerAttribute: 1, value: [e.g + h + GEOIDE] }),
      },
    }))
  }
  const nuovo = new C.Primitive({
    geometryInstances: inst,
    appearance: aspettoFacciate(14.4855, 40.6287, plastico),
    shadows: C.ShadowMode.ENABLED,
    asynchronous: true,
  })
  viewer.scene.primitives.add(nuovo)
  const vecchio = prim
  prim = nuovo
  // il vecchio si toglie quando il nuovo è pronto, così non lampeggia
  const rimuovi = () => { if (vecchio) viewer.scene.primitives.remove(vecchio) }
  if (vecchio) {
    const t = setInterval(() => { if (nuovo.ready || nuovo.isDestroyed()) { clearInterval(t); rimuovi() } }, 100)
  }
}

/** Cupole che fanno riconoscere Positano: la maiolica della Collegiata e quella bianca di Chiesa Nuova. */
const CUPOLE = [
  { id: 'w1268998290', lon: 14.487054, lat: 40.628339, r: 6.5, maiolica: true },
  { id: 'w407485325', lon: 14.48177, lat: 40.629787, r: 8.5, maiolica: false },
]
let cupole = false
export function disegnaCupole(v: C.Viewer) {
  if (cupole) return
  cupole = true
  for (const c of CUPOLE) {
    const e = edificio(c.id)
    if (!e) continue
    const z = e.g + e.h + GEOIDE
    const mat = c.maiolica
      ? new C.CheckerboardMaterialProperty({ evenColor: C.Color.fromCssColorString('#f2c230'), oddColor: C.Color.fromCssColorString('#2f8a5b'), repeat: new C.Cartesian2(28, 10) })
      : C.Color.fromCssColorString('#f4f1ea')
    v.entities.add({ id: 'cupola:' + c.id, position: C.Cartesian3.fromDegrees(c.lon, c.lat, z), ellipsoid: { radii: new C.Cartesian3(c.r, c.r, c.r * 1.05), maximumCone: Math.PI / 2, material: mat, shadows: C.ShadowMode.ENABLED } })
    v.entities.add({ id: 'cupola:l' + c.id, position: C.Cartesian3.fromDegrees(c.lon, c.lat, z + c.r * 1.05 + 1), cylinder: { length: 2, topRadius: 0.9, bottomRadius: 1.1, material: C.Color.fromCssColorString('#f4f1ea') } })
  }
}

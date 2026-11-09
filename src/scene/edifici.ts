import * as C from 'cesium'
import { viewer } from './viewer'
import { GEOIDE } from './terreno'
import { aspettoFacciate } from './facciate'
import type { LL } from '../engine/geo'

export type Edificio = { id: string; r: LL[]; b: number; g: number; h: number; stima: boolean; n?: string; t?: string }
let dati: Edificio[] = []
let prim: C.Primitive | undefined
let ultima = ''
const PALETTE = ['#f4e6cc', '#f2d9b4', '#efcfa6', '#f6efe3', '#e8bf98', '#f1e1a6', '#eadacb', '#f3e9d2', '#e9cdb6', '#f5dcc2', '#dfe3d8', '#e6b896']
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

export function disegnaEdifici(visibile: boolean, modifiche: Record<string, { h?: number; via?: boolean; col?: string }>, sel: string | null, rossi: string[] = []) {
  const chiave = JSON.stringify(modifiche) + '|' + sel + '|' + rossi.join(',')
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
    appearance: aspettoFacciate(14.4855, 40.6287),
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

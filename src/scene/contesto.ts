import * as C from 'cesium'
import { pos, viewer } from './viewer'
import type { LL } from '../engine/geo'

export type Strada = { id: string; k: string; w: number; c: LL[]; n?: string; o?: 1; ponte?: 1; galleria?: 1 }
export type Luogo = { n: string; k: string; p: LL; z: number }
let strade: Strada[] = [], luoghi: Luogo[] = []
const ds = new C.CustomDataSource('contesto-strade')
const dn = new C.CustomDataSource('contesto-nomi')
const dc = new C.CustomDataSource('contesto-confine')
const COL: Record<string, string> = { primary: '#ffcf4a', tertiary: '#ffe08a', unclassified: '#ffffff', residential: '#ffffff', service: '#dddddd', living_street: '#dddddd', pedestrian: '#d6c7ff', steps: '#ff9f9f', footway: '#ffb3b3', path: '#ffb3b3', track: '#c9a77a' }
const NOMI = new Set(['village', 'hamlet', 'suburb', 'locality', 'beach', 'place_of_worship', 'peak', 'viewpoint', 'parking', 'platform', 'stop_position', 'island', 'islet', 'square', 'town_hall', 'school', 'pharmacy'])

export async function caricaContesto() {
  ;[strade, luoghi] = await Promise.all([(await fetch('/data/strade.json')).json(), (await fetch('/data/luoghi.json')).json()])
  const confine: LL[][] = await (await fetch('/data/confine.json')).json()
  for (const s of strade)
    ds.entities.add({ id: 'st:' + s.id, polyline: { positions: C.Cartesian3.fromDegreesArray(s.c.flat()), width: s.k === 'primary' ? 4 : s.k.match(/steps|footway|path/) ? 2 : 3, clampToGround: true, material: C.Color.fromCssColorString(COL[s.k] ?? '#fff').withAlpha(0.85) } })
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
  await Promise.all([viewer.dataSources.add(ds), viewer.dataSources.add(dn), viewer.dataSources.add(dc)])
}
export function mostraContesto(strade: boolean, nomi: boolean, confine: boolean) {
  ds.show = strade; dn.show = nomi; dc.show = confine
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

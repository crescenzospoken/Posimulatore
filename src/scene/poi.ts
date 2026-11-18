import * as C from 'cesium'
import { viewer, pos } from './viewer'
import { quota } from './oggetti'
import { categoria, unisciPoi, type Poi, type PoiDb, type PoiOsm } from '../engine/poi'

const ds = new C.CustomDataSource('poi')
let osm: PoiOsm[] = [], tutti: Poi[] = []
const icone = new Map<string, string>()

/** Icona tonda col simbolo della categoria (disegnata una volta per categoria). */
function icona(k: string, scelto = false) {
  const chiave = k + (scelto ? '!' : '')
  let u = icone.get(chiave)
  if (u) return u
  const c = categoria(k), L = 64, cv = document.createElement('canvas')
  cv.width = cv.height = L
  const g = cv.getContext('2d')!
  g.beginPath(); g.arc(L / 2, L / 2, L / 2 - 3, 0, Math.PI * 2)
  g.fillStyle = scelto ? '#ffffff' : c.col; g.fill()
  g.lineWidth = scelto ? 6 : 4; g.strokeStyle = scelto ? c.col : '#ffffff'; g.stroke()
  g.font = '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(c.icona, L / 2, L / 2 + 2)
  u = cv.toDataURL(); icone.set(chiave, u)
  return u
}

export async function caricaPoi() {
  osm = (await (await fetch('/data/poi.json')).json()).punti
  await viewer.dataSources.add(ds)
  return ricaricaPoi()
}
/** Rilegge le correzioni a mano dal server (dopo una modifica o all'avvio). */
export async function ricaricaPoi() {
  let db: PoiDb[] = []
  try { const r = await fetch('/api/poi'); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) db = await r.json() } catch { /* sviluppo senza Worker */ }
  tutti = unisciPoi(osm, db)
  return tutti
}
export const elencoPoi = () => tutti
export const poiDa = (id: string) => tutti.find(p => p.id === id)

let firma = ''
export function disegnaPoi(cat: Set<string>, sel: string | null, conNascosti: boolean) {
  const f = [...cat].join() + '|' + sel + '|' + conNascosti + '|' + tutti.length + '|' + tutti.map(p => p.p.join() + p.c + p.n + (p.nascosto ? 1 : 0)).join().length
  if (f === firma) return
  firma = f
  ds.entities.removeAll()
  for (const p of tutti) {
    if (!cat.has(p.c) || (p.nascosto && !conNascosti)) continue
    const c = categoria(p.c), scelto = p.id === sel
    ds.entities.add({
      id: 'poi:' + p.id,
      position: pos(p.p[0], p.p[1], quota(p.p[0], p.p[1]) + 2.5),
      billboard: {
        image: icona(p.c, scelto), width: scelto ? 40 : 30, height: scelto ? 40 : 30, verticalOrigin: C.VerticalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY, scaleByDistance: new C.NearFarScalar(150, 1, 3000, 0.55),
        color: p.nascosto ? C.Color.WHITE.withAlpha(0.45) : C.Color.WHITE,
      },
      // senza nome si vede solo il simbolo (una fila di «Parcheggi» uguali non dice niente); col nome solo da vicino
      label: p.n || scelto ? {
        text: p.n ?? c.nome, font: '600 13px system-ui, sans-serif', fillColor: C.Color.fromCssColorString('#1d2730'),
        outlineColor: C.Color.WHITE, outlineWidth: 4, style: C.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: C.VerticalOrigin.TOP, pixelOffset: new C.Cartesian2(0, 18),
        distanceDisplayCondition: new C.DistanceDisplayCondition(0, scelto ? 1e5 : 450), disableDepthTestDistance: Number.POSITIVE_INFINITY,
      } : undefined,
    })
  }
  viewer.scene.requestRender()
}
/** Dopo i caricamenti di Google le quote cambiano: i simboli si rimettono a posto. */
export const rifaiPoi = () => { firma = '' }

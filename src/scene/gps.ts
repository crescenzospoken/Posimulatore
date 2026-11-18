import * as C from 'cesium'
import { viewer, pos } from './viewer'
import { quota } from './oggetti'
import { GEOIDE } from './terreno'
import type { LL } from '../engine/geo'

export type Posizione = { p: LL; precisione: number }
let id: number | null = null
let punto: C.Entity | undefined, cerchio: C.Entity | undefined
let ultima: Posizione | null = null
export const ultimaPosizione = () => ultima
export const dentroPositano = (p: LL) => Math.abs(p[0] - 14.485) < 0.06 && Math.abs(p[1] - 40.62) < 0.05

/** Segue la posizione del telefono (pallino blu e cerchio della precisione). */
export function avviaGps(su: (p: Posizione) => void, errore: (t: string) => void) {
  if (!navigator.geolocation) { errore('Questo dispositivo non dà la posizione'); return }
  if (id !== null) return
  id = navigator.geolocation.watchPosition(
    g => {
      ultima = { p: [g.coords.longitude, g.coords.latitude], precisione: Math.min(g.coords.accuracy, 500) }
      disegna(ultima)
      su(ultima)
    },
    e => { errore(e.code === e.PERMISSION_DENIED ? 'Posizione non permessa: abilitala nelle impostazioni del browser' : 'Posizione non disponibile adesso'); fermaGps() },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  )
}
export function fermaGps() {
  if (id !== null) navigator.geolocation.clearWatch(id)
  id = null
  if (punto) viewer.entities.remove(punto)
  if (cerchio) viewer.entities.remove(cerchio)
  punto = cerchio = undefined
  viewer.scene.requestRender()
}
export const gpsAcceso = () => id !== null

function disegna(q: Posizione) {
  const z = quota(q.p[0], q.p[1])
  const at = pos(q.p[0], q.p[1], z + 1.5)
  if (!punto) {
    punto = viewer.entities.add({ id: 'gps:io', position: at, point: { pixelSize: 16, color: C.Color.fromCssColorString('#1a73e8'), outlineColor: C.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY } })
    cerchio = viewer.entities.add({ id: 'gps:cerchio', position: at, ellipse: { semiMajorAxis: q.precisione, semiMinorAxis: q.precisione, height: z + 1 + GEOIDE, material: C.Color.fromCssColorString('#1a73e8').withAlpha(0.15), outline: false } })
  } else {
    punto.position = new C.ConstantPositionProperty(at)
    cerchio!.position = new C.ConstantPositionProperty(at)
    cerchio!.ellipse!.semiMajorAxis = new C.ConstantProperty(Math.max(q.precisione, 3))
    cerchio!.ellipse!.semiMinorAxis = new C.ConstantProperty(Math.max(q.precisione, 3))
    cerchio!.ellipse!.height = new C.ConstantProperty(z + 1 + GEOIDE)
  }
  viewer.scene.requestRender()
}

/** Porta la vista sulla posizione, dall'alto e un po' inclinata. */
export function centraSu(p: LL) {
  const z = quota(p[0], p[1])
  viewer.camera.flyTo({ destination: pos(p[0], p[1] - 0.0016, z + 190), orientation: { heading: 0, pitch: C.Math.toRadians(-50), roll: 0 }, duration: 1.2 })
}

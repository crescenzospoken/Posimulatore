import * as C from 'cesium'
import { viewer, pos, quotaGoogle, googleAcceso } from './viewer'
import { quota as quotaTerreno } from './terreno'
import { puntiVia } from './contesto'
import type { Percorso, Tappa } from '../engine/percorso'

const BLU = C.Color.fromCssColorString('#0a7cff')
let linea: C.Entity | undefined
const segni: C.Entity[] = []

const zSuolo = (p: [number, number]) => quotaGoogle(p[0], p[1]) ?? quotaTerreno(p[0], p[1])

/** Disegna il percorso: linea blu alla quota vera della strada, visibile anche dietro gli edifici (più chiara). */
export function disegnaPercorso(r: Percorso | null, da: Tappa | null, a: Tappa | null) {
  if (linea) viewer.entities.remove(linea)
  segni.splice(0).forEach(e => viewer.entities.remove(e))
  linea = undefined
  if (r && r.pts.length > 1) {
    linea = viewer.entities.add({
      polyline: {
        positions: puntiVia(r.pts.map(p => [p[0], p[1]]), r.pts.map(p => p[2]), googleAcceso(), 1.6),
        width: 9, arcType: C.ArcType.NONE,
        material: new C.PolylineOutlineMaterialProperty({ color: BLU, outlineColor: C.Color.WHITE, outlineWidth: 2 }),
        depthFailMaterial: new C.ColorMaterialProperty(BLU.withAlpha(0.55)),
      },
    })
  }
  ;([['A', da, '#1f9d55'], ['B', a, '#d93a2b']] as const).forEach(([lettera, t, col]) => {
    if (!t) return
    segni.push(viewer.entities.add({
      position: pos(t.p[0], t.p[1], zSuolo(t.p) + 3),
      point: { pixelSize: 18, color: C.Color.fromCssColorString(col), outlineColor: C.Color.WHITE, outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
      label: {
        text: t.nome ? `${lettera} · ${t.nome}` : lettera, font: '600 15px system-ui, sans-serif', fillColor: C.Color.WHITE,
        showBackground: true, backgroundColor: C.Color.fromCssColorString(col), backgroundPadding: new C.Cartesian2(8, 5),
        verticalOrigin: C.VerticalOrigin.BOTTOM, pixelOffset: new C.Cartesian2(0, -16), disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    }))
  })
  viewer.scene.requestRender()
}

/** Inquadra tutto il percorso dall'alto, un po' inclinato, da sud (dal mare si legge meglio Positano). */
export function inquadraPercorso(r: Percorso) {
  const bs = C.BoundingSphere.fromPoints(r.pts.map(p => pos(p[0], p[1], p[2])))
  const telefono = matchMedia('(max-width: 760px)').matches
  // sul telefono la scheda copre la metà bassa: si guarda un punto più a sud, così il percorso sale nella metà alta
  // sul computer la scheda sta a destra: si guarda un po' più a est, così il percorso resta a sinistra
  const g = C.Cartographic.fromCartesian(bs.center)
  if (telefono) g.latitude -= (bs.radius * 0.75) / 6371000
  else g.longitude += (bs.radius * 0.45) / (6371000 * Math.cos(g.latitude))
  bs.center = C.Cartographic.toCartesian(g)
  viewer.camera.flyToBoundingSphere(bs, { offset: new C.HeadingPitchRange(C.Math.toRadians(-15), C.Math.toRadians(telefono ? -62 : -55), Math.max(160, bs.radius * (telefono ? 3.9 : 3.4))), duration: 1.6 })
}

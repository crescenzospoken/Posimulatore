import { t as tr } from '../i18n'
import * as C from 'cesium'
import { viewer, pos, quotaGoogle, googleAcceso } from './viewer'
import { quota as quotaTerreno } from './terreno'
import { puntiVia } from './contesto'
import { impostaVoci } from './sovrapposti'
import type { Percorso, Tappa } from '../engine/percorso'

const BLU = C.Color.fromCssColorString('#0a7cff'), CHIARO = C.Color.fromCssColorString('#9cc2f5')
let linee: C.Entity[] = []

const zSuolo = (p: [number, number]) => quotaGoogle(p[0], p[1]) ?? quotaTerreno(p[0], p[1])

/** Il percorso scelto (blu pieno) e le alternative (più sottili e chiare). Si vedono sempre, anche dove il 3D di Google
 * li coprirebbe: con un percorso aperto sono l'unica cosa che conta, e le altre vie si spengono (vedi App). */
export function disegnaPercorso(r: Percorso | null, tappe: Tappa[], altri: Percorso[] = []) {
  for (const l of linee) viewer.entities.remove(l)
  linee = []
  const g = googleAcceso()
  const traccia = (x: Percorso, scelto: boolean) => {
    if (x.pts.length < 2) return
    const m = new C.PolylineOutlineMaterialProperty(scelto ? { color: BLU, outlineColor: C.Color.WHITE, outlineWidth: 2 } : { color: CHIARO, outlineColor: C.Color.WHITE.withAlpha(0.9), outlineWidth: 1 })
    linee.push(viewer.entities.add({ polyline: { positions: puntiVia(x.pts.map(p => [p[0], p[1]]), x.pts.map(p => p[2]), g, scelto ? 1.8 : 1.4), width: scelto ? 9 : 5, arcType: C.ArcType.NONE, material: m, depthFailMaterial: m, zIndex: scelto ? 2 : 1 } }))
  }
  // prima le alternative, poi il percorso scelto sopra
  for (const x of altri) if (x !== r) traccia(x, false)
  if (r) traccia(r, true)
  // tappe in HTML sopra la scena (nitide sul telefono): A verde, ultima rossa, intermedie blu con la loro lettera
  impostaVoci('tappa', tappe.map((t, i) => {
    const ultima = i === tappe.length - 1 && i > 0, prima = i === 0
    return {
      id: 'tappa:' + i, tipo: 'tappa' as const, pos: pos(t.p[0], t.p[1], zSuolo(t.p) + 3),
      testo: String.fromCharCode(65 + i) + ' · ' + (t.nome ?? tr('punto scelto')),
      icona: prima ? 'my_location' : ultima ? 'location_on' : 'route', col: prima ? '#188038' : ultima ? '#c5221f' : '#0b6bcb', scelto: true, maxDist: 1e9,
    }
  }))
  // le linee si costruiscono in più fotogrammi: senza queste richieste restavano invisibili finché non si toccava la mappa
  for (const ms of [0, 120, 400, 1000, 2200]) setTimeout(() => viewer.scene.requestRender(), ms)
}

/** Inquadra tutto il percorso dall'alto, un po' inclinato, da sud (dal mare si legge meglio Positano). */
export function inquadraPercorso(r: Percorso) {
  const bs = C.BoundingSphere.fromPoints(r.pts.map(p => pos(p[0], p[1], p[2])))
  const telefono = matchMedia('(max-width: 760px)').matches
  // sul telefono la scheda ridotta e la barra in alto coprono poco: basta guardare un filo più a sud
  // sul computer la scheda sta a destra: si guarda un po' più a est, così il percorso resta a sinistra
  const g = C.Cartographic.fromCartesian(bs.center)
  if (telefono) g.latitude -= (bs.radius * 0.2) / 6371000
  else g.longitude += (bs.radius * 0.45) / (6371000 * Math.cos(g.latitude))
  bs.center = C.Cartographic.toCartesian(g)
  viewer.camera.flyToBoundingSphere(bs, { offset: new C.HeadingPitchRange(C.Math.toRadians(-15), C.Math.toRadians(telefono ? -62 : -55), Math.max(160, bs.radius * (telefono ? 3.6 : 3.4))), duration: 1.6 })
}

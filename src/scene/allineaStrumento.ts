// Strumento «Allinea» (solo editor): a piombo sul 3D di Google si trascinano tutte le linee finché combaciano con
// quello che si vede; al rilascio nasce un punto di controllo dove si è iniziato a trascinare, con lo spostamento
// totale lì (quello che c'era più il trascinamento). Mentre si trascina le linee si muovono tutte insieme (anteprima).
import * as C from 'cesium'
import { viewer } from './viewer'
import { quotaGoogle } from './viewer'
import { GEOIDE, quota as quotaTerreno } from './terreno'
import { scarto } from './allinea'
import { anteprimaSpostamento } from './contesto'

let attivo = false
let fatto: ((p: { lon: number; lat: number; e: number; n: number }) => void) | undefined
let giu: ((e: PointerEvent) => void) | undefined
let smetti: (() => void) | undefined

/** Porta la vista a piombo sul punto al centro (stessa direzione): solo così i pixel diventano metri senza errori. */
export function aPiombo(altezza = 300) {
  const c = viewer.camera, g = centro()
  const z = (quotaGoogle(g[0], g[1]) ?? quotaTerreno(g[0], g[1])) + GEOIDE
  c.flyTo({ destination: C.Cartesian3.fromDegrees(g[0], g[1], z + altezza), orientation: { heading: c.heading, pitch: -Math.PI / 2, roll: 0 }, duration: 0.6 })
}
/** Punto del terreno al centro dello schermo. */
function centro(): [number, number] {
  const c = viewer.camera, k = c.positionCartographic
  if (c.pitch < -1.45) return [C.Math.toDegrees(k.longitude), C.Math.toDegrees(k.latitude)]
  // vista inclinata: dove la direzione di vista incontra il piano alla quota del suolo sotto la camera
  const lon0 = C.Math.toDegrees(k.longitude), lat0 = C.Math.toDegrees(k.latitude)
  const suolo = (quotaGoogle(lon0, lat0) ?? quotaTerreno(lon0, lat0)) + GEOIDE
  const su = C.Cartesian3.normalize(c.positionWC, new C.Cartesian3())
  const giu = -C.Cartesian3.dot(c.directionWC, su)
  if (giu < 0.05) return [lon0, lat0]
  const t = Math.min(4000, (k.height - suolo) / giu)
  const g = C.Cartographic.fromCartesian(C.Cartesian3.add(c.positionWC, C.Cartesian3.multiplyByScalar(c.directionWC, t, new C.Cartesian3()), new C.Cartesian3()))
  return [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)]
}
/** Metri al pixel e versori est/nord dello schermo, validi con la vista a piombo. */
function scala() {
  const c = viewer.camera, k = c.positionCartographic
  const lon = C.Math.toDegrees(k.longitude), lat = C.Math.toDegrees(k.latitude)
  const suolo = (quotaGoogle(lon, lat) ?? quotaTerreno(lon, lat)) + GEOIDE
  const fr = c.frustum as C.PerspectiveFrustum
  const mpp = (2 * Math.max(30, k.height - suolo) * Math.tan(((fr.fovy as number | undefined) ?? fr.fov ?? 1) / 2)) / viewer.canvas.clientHeight
  // a piombo: «destra» dello schermo è est ruotato della direzione, «su» è nord ruotato
  const h = c.heading
  return { mpp, lon, lat, dx: [Math.cos(h), -Math.sin(h)] as const, su: [Math.sin(h), Math.cos(h)] as const }
}
const metri = (px: number, py: number, s: ReturnType<typeof scala>): [number, number] => [(px * s.dx[0] - py * s.su[0]) * s.mpp, (px * s.dx[1] - py * s.su[1]) * s.mpp]

/** Accende o spegne il trascinamento delle linee. Acceso: la mappa non si muove, si spostano le linee. */
export function trascinaLinee(on: boolean, alRilascio?: typeof fatto) {
  const tela = viewer.canvas, ctrl = viewer.scene.screenSpaceCameraController
  if (giu) { tela.removeEventListener('pointerdown', giu, true); giu = undefined }
  smetti?.()
  attivo = on; fatto = alRilascio
  ctrl.enableInputs = !on
  tela.style.cursor = on ? 'move' : ''
  if (!on) return
  aPiombo(Math.min(450, Math.max(180, viewer.camera.positionCartographic.height - ((quotaGoogle(...centro()) ?? 0) + GEOIDE))))
  giu = (e: PointerEvent) => {
    // un solo trascinamento alla volta, solo dito o tasto sinistro: prima un rilascio perso (dito uscito dallo
    // schermo, secondo dito) lasciava in ascolto il trascinamento vecchio e al rilascio dopo si salvavano più punti
    if (!attivo || !e.isPrimary || e.button > 0) return
    e.preventDefault()
    smetti?.()
    const s = scala(), r = tela.getBoundingClientRect(), dito = e.pointerId
    // punto del terreno sotto il dito: dal centro dello schermo, in metri
    const [oe, on_] = metri(e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2, s)
    const lon = s.lon + oe / 84560, lat = s.lat + on_ / 111030
    const x0 = e.clientX, y0 = e.clientY
    let de = 0, dn = 0
    const muovi = (ev: PointerEvent) => { if (ev.pointerId !== dito) return; [de, dn] = metri(ev.clientX - x0, ev.clientY - y0, s); anteprimaSpostamento(de, dn, lon, lat) }
    const stacca = () => { window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', su); window.removeEventListener('pointercancel', annulla); smetti = undefined }
    const annulla = (ev?: PointerEvent) => { if (ev && ev.pointerId !== dito) return; stacca(); anteprimaSpostamento(0, 0, lon, lat) }
    const su = (ev: PointerEvent) => {
      if (ev.pointerId !== dito) return
      stacca()
      if (Math.hypot(de, dn) < 0.2) { anteprimaSpostamento(0, 0, lon, lat); return }
      const [e0, n0] = scarto(lon, lat)
      fatto?.({ lon, lat, e: Math.round((e0 + de) * 10) / 10, n: Math.round((n0 + dn) * 10) / 10 })
    }
    smetti = () => annulla()
    window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', su); window.addEventListener('pointercancel', annulla)
  }
  tela.addEventListener('pointerdown', giu, true)
}

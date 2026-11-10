import * as C from 'cesium'
import { viewer } from './viewer'
import { GEOIDE } from './terreno'
import { quota } from './oggetti'
import { useS } from '../store'
import { Frame, inside } from '../engine/geo'

export const tasti = { avanti: 0, indietro: 0, sinistra: 0, destra: 0, corri: 0 }
let attivo = false
let yaw = 0, pitch = 0
let rimuovi: (() => void) | null = null
const OCCHI = 1.65

/** Quota del piano su cui si cammina: piazze e volumi disegnati, altrimenti il terreno. */
function suolo(lon: number, lat: number) {
  let z = quota(lon, lat)
  for (const o of useS.getState().opzione().oggetti) {
    if ((o.tipo === 'piazza' || o.tipo === 'area') && o.z !== undefined && o.pts.length > 2) {
      const f = new Frame(lon, lat)
      if (inside([0, 0], o.pts.map(p => f.toXY(p))) && o.z > z - 4) z = Math.max(z, o.z)
    }
  }
  return z
}

export function avviaCammina() {
  if (attivo) return
  attivo = true
  const cam = viewer.camera
  const ctrl = viewer.scene.screenSpaceCameraController
  ctrl.enableInputs = false
  // parte dal punto guardato al centro dello schermo
  const centro = new C.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2)
  const ray = cam.getPickRay(centro)
  const hit = ray && viewer.scene.globe.pick(ray, viewer.scene)
  // se il punto guardato è lontano (vista radente), si parte da sotto la camera
  const vicino = hit && C.Cartesian3.distance(hit, cam.positionWC) < 300
  const g = vicino ? C.Cartographic.fromCartesian(hit) : cam.positionCartographic.clone()
  let lon = C.Math.toDegrees(g.longitude), lat = C.Math.toDegrees(g.latitude)
  yaw = cam.heading; pitch = -0.08
  const pone = () => cam.setView({ destination: C.Cartesian3.fromDegrees(lon, lat, suolo(lon, lat) + OCCHI + GEOIDE), orientation: { heading: yaw, pitch, roll: 0 } })
  pone()
  let t0 = performance.now()
  const tick = () => {
    const now = performance.now(), dt = Math.min(0.1, (now - t0) / 1000); t0 = now
    const v = (tasti.corri ? 6 : 1.6) * dt
    const f = tasti.avanti - tasti.indietro, l = tasti.destra - tasti.sinistra
    if (f || l) {
      const fr = new Frame(lon, lat)
      const dx = Math.sin(yaw) * f + Math.cos(yaw) * l, dy = Math.cos(yaw) * f - Math.sin(yaw) * l
      const nl = fr.toLL([dx * v, dy * v])
      // niente salti oltre 1 m per passo: muri e dirupi fermano
      if (Math.abs(suolo(nl[0], nl[1]) - suolo(lon, lat)) < 1.2) { lon = nl[0]; lat = nl[1] }
    }
    pone()
    viewer.scene.requestRender()
  }
  viewer.clock.onTick.addEventListener(tick)
  const kd = (e: KeyboardEvent, on: number) => {
    const k = e.key.toLowerCase()
    if (k === 'w' || k === 'arrowup') tasti.avanti = on
    else if (k === 's' || k === 'arrowdown') tasti.indietro = on
    else if (k === 'a' || k === 'arrowleft') tasti.sinistra = on
    else if (k === 'd' || k === 'arrowright') tasti.destra = on
    else if (k === 'shift') tasti.corri = on
    else return
    e.preventDefault()
  }
  const down = (e: KeyboardEvent) => kd(e, 1), up = (e: KeyboardEvent) => kd(e, 0)
  let px: { x: number; y: number } | null = null
  const pd = (e: PointerEvent) => { if (e.target === viewer.canvas) px = { x: e.clientX, y: e.clientY } }
  const pm = (e: PointerEvent) => {
    if (!px) return
    yaw += (e.clientX - px.x) * 0.004
    pitch = Math.max(-1.3, Math.min(1.2, pitch - (e.clientY - px.y) * 0.004))
    px = { x: e.clientX, y: e.clientY }
  }
  const pu = () => { px = null }
  window.addEventListener('keydown', down); window.addEventListener('keyup', up)
  window.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu)
  rimuovi = () => {
    viewer.clock.onTick.removeEventListener(tick)
    window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
    window.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu)
    Object.keys(tasti).forEach(k => (tasti[k as keyof typeof tasti] = 0))
    ctrl.enableInputs = true
    // torna in alto, guardando lo stesso punto
    cam.setView({ destination: C.Cartesian3.fromDegrees(lon, lat - 0.0008, suolo(lon, lat) + 80 + GEOIDE), orientation: { heading: yaw, pitch: C.Math.toRadians(-35), roll: 0 } })
  }
}
export function fermaCammina() {
  if (!attivo) return
  attivo = false
  rimuovi?.(); rimuovi = null
}

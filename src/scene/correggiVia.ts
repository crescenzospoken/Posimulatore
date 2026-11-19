// Correzione a mano di una via: maniglie trascinabili sui vertici, sopra il satellite Esri (mai su Google 3D, che non si
// può ricalcare). Le maniglie sono HTML sopra la scena; il trascinamento legge il terreno con globe.pick (Google è spento).
import * as C from 'cesium'
import { viewer, pos } from './viewer'
import { quota as quotaTerreno } from './terreno'
import type { LL } from '../engine/geo'

let strato: HTMLDivElement | undefined
let punti: LL[] = []
let scelto: number | null = null
let suCambio: ((c: LL[], fine: boolean) => void) | undefined
let suScelta: ((i: number) => void) | undefined
const scratch = new C.Cartesian2()

function aggiorna() {
  if (!strato) return
  const els = strato.children
  punti.forEach((p, i) => {
    const el = els[i] as HTMLElement | undefined
    if (!el) return
    const s = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, pos(p[0], p[1], quotaTerreno(p[0], p[1]) + 1), scratch)
    if (!s) { el.style.display = 'none'; return }
    el.style.display = ''
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`
    el.classList.toggle('scelto', i === scelto)
  })
}

function costruisci() {
  if (!strato) return
  strato.innerHTML = ''
  punti.forEach((_, i) => {
    const b = document.createElement('button')
    b.className = 'maniglia-via'; b.setAttribute('aria-label', 'Punto ' + (i + 1)); b.textContent = String(i + 1)
    b.addEventListener('pointerdown', e => inizia(e, i))
    strato!.appendChild(b)
  })
  aggiorna()
  viewer.scene.requestRender()
}

function inizia(e: PointerEvent, i: number) {
  e.preventDefault(); e.stopPropagation()
  scelto = i; suScelta?.(i)
  const ctrl = viewer.scene.screenSpaceCameraController
  ctrl.enableInputs = false
  const rect = viewer.canvas.getBoundingClientRect()
  const muovi = (ev: PointerEvent) => {
    const ray = viewer.camera.getPickRay(new C.Cartesian2(ev.clientX - rect.left, ev.clientY - rect.top))
    const c = ray && viewer.scene.globe.pick(ray, viewer.scene)
    if (!c) return
    const g = C.Cartographic.fromCartesian(c)
    punti = punti.map((p, k) => (k === i ? [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)] : p))
    aggiorna(); viewer.scene.requestRender()
    suCambio?.(punti, false)
  }
  const fine = () => {
    window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine)
    ctrl.enableInputs = true
    suCambio?.(punti, true)
  }
  window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', fine)
}

/** Mostra le maniglie per questi punti; cambia() riceve i punti nuovi durante e alla fine del trascinamento. */
export function apriCorrezione(c: LL[], vSel: number | null, cambia: (c: LL[], fine: boolean) => void, sceglie: (i: number) => void) {
  if (!strato) {
    strato = document.createElement('div'); strato.className = 'sovrapposti maniglie'
    viewer.container.appendChild(strato)
    viewer.scene.postRender.addEventListener(aggiorna)
  }
  const stessi = c.length === punti.length && c.every((p, i) => p[0] === punti[i][0] && p[1] === punti[i][1])
  punti = c; scelto = vSel; suCambio = cambia; suScelta = sceglie
  if (!stessi || strato.children.length !== c.length) costruisci(); else aggiorna()
}
export function chiudiCorrezione() {
  punti = []; scelto = null
  if (strato) strato.innerHTML = ''
  viewer.scene.requestRender()
}

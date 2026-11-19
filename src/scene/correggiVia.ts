// Correzione a mano di una via: maniglie trascinabili sui vertici, sopra il satellite Esri (mai su Google 3D, che non si
// può ricalcare). Le maniglie sono HTML sopra la scena; il trascinamento legge il terreno con globe.pick (Google è spento).
// Selezione multipla: in «più punti» un tocco aggiunge o toglie; trascinando un punto scelto si muovono tutti insieme;
// col riquadro si scelgono di colpo tutti quelli dentro.
import * as C from 'cesium'
import { viewer, pos } from './viewer'
import { quota as quotaTerreno } from './terreno'
import type { LL } from '../engine/geo'

let strato: HTMLDivElement | undefined, riquadro: HTMLDivElement | undefined
let punti: LL[] = []
let scelti = new Set<number>()
let multipla = false
let suCambio: ((c: LL[], fine: boolean) => void) | undefined
let suScelta: ((s: number[]) => void) | undefined
const scratch = new C.Cartesian2()
const schermo = new Map<number, [number, number]>()

function aggiorna() {
  if (!strato) return
  const els = strato.children
  schermo.clear()
  punti.forEach((p, i) => {
    const el = els[i] as HTMLElement | undefined
    if (!el) return
    const s = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, pos(p[0], p[1], quotaTerreno(p[0], p[1]) + 1), scratch)
    if (!s) { el.style.display = 'none'; return }
    schermo.set(i, [s.x, s.y])
    el.style.display = ''
    el.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px)`
    el.classList.toggle('scelto', scelti.has(i))
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
const avvisa = () => suScelta?.([...scelti].sort((a, b) => a - b))

const terrenoSotto = (x: number, y: number) => {
  const rect = viewer.canvas.getBoundingClientRect()
  const ray = viewer.camera.getPickRay(new C.Cartesian2(x - rect.left, y - rect.top))
  const c = ray && viewer.scene.globe.pick(ray, viewer.scene)
  if (!c) return null
  const g = C.Cartographic.fromCartesian(c)
  return [C.Math.toDegrees(g.longitude), C.Math.toDegrees(g.latitude)] as LL
}

function inizia(e: PointerEvent, i: number) {
  e.preventDefault(); e.stopPropagation()
  // chi si trascina: tutti i punti scelti se questo è fra loro, altrimenti solo lui
  const tocco = { x: e.clientX, y: e.clientY }, eraScelto = scelti.has(i)
  if (!eraScelto) { if (!multipla) scelti.clear(); scelti.add(i); avvisa(); aggiorna() }
  const muovono = [...scelti]
  const ctrl = viewer.scene.screenSpaceCameraController
  ctrl.enableInputs = false
  const partenza = terrenoSotto(e.clientX, e.clientY) ?? punti[i]
  const prima = punti.map(p => [...p] as LL)
  let mosso = false
  const muovi = (ev: PointerEvent) => {
    if (!mosso && Math.hypot(ev.clientX - tocco.x, ev.clientY - tocco.y) < 6) return
    mosso = true
    const q = terrenoSotto(ev.clientX, ev.clientY)
    if (!q) return
    const dx = q[0] - partenza[0], dy = q[1] - partenza[1]
    punti = prima.map((p, k) => (muovono.includes(k) ? [p[0] + dx, p[1] + dy] : p))
    aggiorna(); viewer.scene.requestRender()
    suCambio?.(punti, false)
  }
  const fine = () => {
    window.removeEventListener('pointermove', muovi); window.removeEventListener('pointerup', fine)
    ctrl.enableInputs = true
    // un tocco senza trascinare in «più punti» toglie il punto se c'era già
    if (!mosso && multipla && eraScelto) { scelti.delete(i); avvisa(); aggiorna() }
    if (mosso) suCambio?.(punti, true)
  }
  window.addEventListener('pointermove', muovi); window.addEventListener('pointerup', fine)
}

/** Mostra le maniglie per questi punti; cambia() riceve i punti nuovi durante e alla fine del trascinamento. */
export function apriCorrezione(c: LL[], sel: number[], cambia: (c: LL[], fine: boolean) => void, sceglie: (s: number[]) => void) {
  if (!strato) {
    strato = document.createElement('div'); strato.className = 'sovrapposti maniglie'
    viewer.container.appendChild(strato)
    viewer.scene.postRender.addEventListener(aggiorna)
  }
  const stessi = c.length === punti.length && c.every((p, i) => p[0] === punti[i][0] && p[1] === punti[i][1])
  punti = c; scelti = new Set(sel.filter(i => i < c.length)); suCambio = cambia; suScelta = sceglie
  if (!stessi || strato.children.length !== c.length) costruisci(); else aggiorna()
}
export function chiudiCorrezione() {
  punti = []; scelti.clear(); multipla = false
  if (strato) strato.innerHTML = ''
  fineRiquadro()
  viewer.scene.requestRender()
}
export const sceltaMultipla = (on: boolean) => { multipla = on }

/** Riquadro: il prossimo trascinamento sulla mappa disegna un rettangolo e sceglie i punti dentro (aggiunti a quelli già scelti). */
export function avviaRiquadro(fatto: () => void) {
  fineRiquadro()
  riquadro = document.createElement('div'); riquadro.className = 'riquadro-scelta'
  const vetro = document.createElement('div'); vetro.className = 'riquadro-vetro'
  viewer.container.appendChild(vetro); vetro.appendChild(riquadro)
  let a: [number, number] | null = null
  const rect = () => viewer.container.getBoundingClientRect()
  vetro.addEventListener('pointerdown', e => { e.preventDefault(); vetro.setPointerCapture(e.pointerId); const r = rect(); a = [e.clientX - r.left, e.clientY - r.top]; disegna(a, a) })
  vetro.addEventListener('pointermove', e => { if (!a) return; const r = rect(); disegna(a, [e.clientX - r.left, e.clientY - r.top]) })
  vetro.addEventListener('pointerup', e => {
    if (!a) return
    const r = rect(), b: [number, number] = [e.clientX - r.left, e.clientY - r.top]
    const [x0, x1] = [Math.min(a[0], b[0]), Math.max(a[0], b[0])], [y0, y1] = [Math.min(a[1], b[1]), Math.max(a[1], b[1])]
    for (const [i, [x, y]] of schermo) if (x >= x0 && x <= x1 && y >= y0 && y <= y1) scelti.add(i)
    avvisa(); aggiorna(); fineRiquadro(); fatto()
  })
  function disegna(p: [number, number], q: [number, number]) {
    Object.assign(riquadro!.style, { left: Math.min(p[0], q[0]) + 'px', top: Math.min(p[1], q[1]) + 'px', width: Math.abs(q[0] - p[0]) + 'px', height: Math.abs(q[1] - p[1]) + 'px', display: 'block' })
  }
}
export function fineRiquadro() { document.querySelector('.riquadro-vetro')?.remove(); riquadro = undefined }

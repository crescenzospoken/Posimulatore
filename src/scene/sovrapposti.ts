// Nomi delle vie e simboli dei punti di interesse in HTML sopra la scena, invece che dentro Cesium:
// sul telefono la scena si disegna a bassa risoluzione e le scritte venivano sgranate; qui restano nitide.
// Si mostrano solo i più vicini (al massimo MAX_POI simboli e MAX_VIE nomi), ricalcolati a ogni disegno della scena.
import * as C from 'cesium'
import { viewer } from './viewer'

export type Voce = { id: string; pos: C.Cartesian3; testo: string; tipo: 'poi' | 'via'; maxDist: number; icona?: string; col?: string; scelto?: boolean; tenue?: boolean; clic?: () => void }
const MAX_POI = 60, MAX_VIE = 24
let voci: Voce[] = []
let strato: HTMLDivElement
const elementi = new Map<string, HTMLElement>()
const scratch = new C.Cartesian2()

export function avviaSovrapposti(contenitore: HTMLElement) {
  strato = document.createElement('div')
  strato.className = 'sovrapposti'
  contenitore.appendChild(strato)
  viewer.scene.postRender.addEventListener(aggiorna)
}
/** Sostituisce tutte le voci di un tipo (le vie si impostano una volta, i punti quando cambiano filtri o dati). */
export function impostaVoci(tipo: Voce['tipo'], nuove: Voce[]) {
  voci = [...voci.filter(v => v.tipo !== tipo), ...nuove]
  for (const [id, el] of elementi) if (!voci.some(v => v.id === id)) { el.remove(); elementi.delete(id) }
  viewer.scene.requestRender()
}

function elemento(v: Voce) {
  let el = elementi.get(v.id)
  const firma = v.testo + '|' + (v.scelto ? 1 : 0) + '|' + (v.tenue ? 1 : 0) + '|' + v.icona
  if (el && el.dataset.f === firma) return el
  if (!el) {
    el = document.createElement(v.tipo === 'poi' ? 'button' : 'div')
    el.className = v.tipo === 'poi' ? 'segno-poi' : 'nome-via'
    if (v.tipo === 'poi') el.addEventListener('click', e => { e.stopPropagation(); voci.find(x => x.id === v.id)?.clic?.() })
    strato.appendChild(el)
    elementi.set(v.id, el)
  }
  el.dataset.f = firma
  if (v.tipo === 'poi') {
    el.innerHTML = ''
    const i = document.createElement('span'); i.className = 'icona'; i.textContent = v.icona ?? '📍'; i.style.background = v.col ?? '#5f6368'
    el.appendChild(i)
    if (v.testo) { const t = document.createElement('span'); t.className = 'testo'; t.textContent = v.testo; el.appendChild(t) }
    el.setAttribute('aria-label', v.testo || 'Punto di interesse')
    el.classList.toggle('scelto', !!v.scelto); el.classList.toggle('tenue', !!v.tenue)
  } else el.textContent = v.testo
  return el
}

function aggiorna() {
  if (!strato) return
  const cam = viewer.camera.positionWC
  const vicini: { v: Voce; d: number }[] = []
  for (const v of voci) {
    const d = C.Cartesian3.distance(cam, v.pos)
    if (d <= v.maxDist || v.scelto) vicini.push({ v, d })
  }
  vicini.sort((a, b) => (b.v.scelto ? 1 : 0) - (a.v.scelto ? 1 : 0) || (a.v.tipo === 'poi' ? 0 : 1) - (b.v.tipo === 'poi' ? 0 : 1) || a.d - b.d)
  const usati = new Set<string>()
  const occupati: [number, number, number, number][] = []
  const w = viewer.canvas.clientWidth, h = viewer.canvas.clientHeight
  let nPoi = 0, nVie = 0
  const testi = new Map<string, [number, number][]>()
  for (const { v, d } of vicini) {
    if (v.tipo === 'poi' ? nPoi >= MAX_POI : nVie >= MAX_VIE) continue
    const p = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, v.pos, scratch)
    if (!p || p.x < -40 || p.y < -20 || p.x > w + 40 || p.y > h + 20) continue
    // i nomi delle vie non si sovrappongono fra loro né ai simboli
    if (v.tipo === 'via') {
      const r: [number, number, number, number] = [p.x - 60, p.y - 10, p.x + 60, p.y + 10]
      if (occupati.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1])) continue
      // la stessa via (più tratti in OSM) si scrive una volta sola ogni 260 px
      const gia = testi.get(v.testo) ?? []
      if (gia.some(([x, y]) => Math.hypot(x - p.x, y - p.y) < 260)) continue
      gia.push([p.x, p.y]); testi.set(v.testo, gia)
      occupati.push(r); nVie++
    } else { occupati.push([p.x - 16, p.y - 16, p.x + 16, p.y + 16]); nPoi++ }
    const el = elemento(v)
    // il nome del punto si vede solo da vicino (o se è quello scelto)
    if (v.tipo === 'poi') el.classList.toggle('con-nome', !!v.scelto || d < 450)
    el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
    el.style.display = ''
    usati.add(v.id)
  }
  for (const [id, el] of elementi) if (!usati.has(id) && el.style.display !== 'none') el.style.display = 'none'
}

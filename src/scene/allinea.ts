// Allineamento visivo delle vie al 3D di Google. I tracciati di OpenStreetMap sono spostati di qualche metro rispetto
// a quello che si vede nel 3D, in modo diverso da zona a zona. Due fonti di punti di controllo (lon, lat, metri verso
// est, metri verso nord):
//  - `public/data/allinea-google.json`: misure automatiche su foto a piombo, una stazione ogni ~70 m lungo le carrabili;
//  - D1 `allinea` (`/api/allinea`): punti messi a mano con lo strumento «Allinea». Vincono sempre: sul punto il
//    risultato è esattamente quello trascinato, attorno sfuma (pieno entro 45 m, spento a 160 m).
// È SOLO una correzione del disegno sopra Google: percorsi, tempi, ricerca e correzione a mano usano i dati originali.
import type { LL } from '../engine/geo'

export type Manuale = { id: string; lon: number; lat: number; e: number; n: number }
type P = { x: number; y: number; e: number; n: number }
let auto: P[] = [], manuali: Manuale[] = []
// punti manuali come scarto rispetto al campo automatico in quel punto: così il raccordo parte da zero lontano da loro
let residui: P[] = []
const KX = 84560, KY = 111030, SIGMA = 60, FINE = 300, ZERO = 600
/** Entro PIENO metri da un punto manuale vale il suo spostamento (mescolato con gli altri vicini); poi sfuma fino a SPENTO. */
const PIENO = 45, SPENTO = 160

/** Campo automatico: media gaussiana delle stazioni misurate sulle foto; si spegne lontano da ogni misura. */
function campoAuto(x: number, y: number): [number, number] {
  let sw = 0, se = 0, sn = 0, dMin = Infinity
  for (const p of auto) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d2 > ZERO * ZERO) continue
    if (d2 < dMin) dMin = d2
    const w = Math.exp(-d2 / (2 * SIGMA * SIGMA)) + 1e-9
    sw += w; se += w * p.e; sn += w * p.n
  }
  if (!sw) return [0, 0]
  const d = Math.sqrt(dMin), f = d <= FINE ? 1 : Math.max(0, 1 - (d - FINE) / (ZERO - FINE))
  return [(se / sw) * f, (sn / sw) * f]
}
function componi() {
  residui = manuali.map(p => { const x = p.lon * KX, y = p.lat * KY, [ae, an] = campoAuto(x, y); return { x, y, e: p.e - ae, n: p.n - an } })
}
export async function caricaAllineamento() {
  try {
    const r = await fetch('/data/allinea-google.json')
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) auto = ((await r.json()).punti as number[][]).map(p => ({ x: p[0] * KX, y: p[1] * KY, e: p[2], n: p[3] }))
  } catch { /* senza file le vie restano dove sono */ }
  await ricaricaManuali()
}
export async function ricaricaManuali() {
  try { const r = await fetch('/api/allinea'); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) manuali = await r.json() } catch { /* sviluppo senza Worker */ }
  componi()
}
export const puntiManuali = () => manuali
/** Il punto manuale più vicino entro `raggio` metri (un nuovo trascinamento lì lo aggiorna invece di aggiungerne un altro). */
export function manualeVicino(lon: number, lat: number, raggio = 20): Manuale | undefined {
  let m: Manuale | undefined, dm = raggio
  for (const p of manuali) { const d = Math.hypot((p.lon - lon) * KX, (p.lat - lat) * KY); if (d < dm) { dm = d; m = p } }
  return m
}
/** Spostamento in metri (est, nord) da dare a un punto perché cada sulla strada vista nel 3D.
 * = campo automatico + correzione dei punti manuali. Sul punto manuale il risultato è ESATTAMENTE il suo valore
 * (pesi 1/d²); fra più punti vicini si passa dall'uno all'altro con continuità; oltre SPENTO resta solo il campo automatico. */
export function scarto(lo: number, la: number): [number, number] {
  const x = lo * KX, y = la * KY
  const [ae, an] = campoAuto(x, y)
  if (!residui.length) return [ae, an]
  let sw = 0, se = 0, sn = 0, dMin = Infinity
  for (const p of residui) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d2 > SPENTO * SPENTO) continue
    if (d2 < dMin) dMin = d2
    const w = 1 / (d2 + 0.01)
    sw += w; se += w * p.e; sn += w * p.n
  }
  if (!sw) return [ae, an]
  const d = Math.sqrt(dMin), t = d <= PIENO ? 1 : Math.max(0, 1 - (d - PIENO) / (SPENTO - PIENO)), f = t * t * (3 - 2 * t)
  return [ae + (se / sw) * f, an + (sn / sw) * f]
}
export function allinea(p: LL): LL {
  const [e, n] = scarto(p[0], p[1])
  return [p[0] + e / KX, p[1] + n / KY]
}

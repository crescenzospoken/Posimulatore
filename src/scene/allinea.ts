// Allineamento visivo delle vie al 3D di Google. I tracciati di OpenStreetMap sono spostati di qualche metro rispetto
// a quello che si vede nel 3D, in modo diverso da zona a zona. Due fonti di punti di controllo (lon, lat, metri verso
// est, metri verso nord):
//  - `public/data/allinea-google.json`: misure automatiche su foto a piombo, una stazione ogni ~70 m lungo le carrabili;
//  - D1 `allinea` (`/api/allinea`): punti messi a mano con lo strumento «Allinea». Contano 6 volte di più, e le misure
//    automatiche entro 90 m da un punto manuale non contano più.
// Lo spostamento di un punto qualsiasi è la media dei controlli vicini (peso gaussiano, 60 m).
// È SOLO una correzione del disegno sopra Google: percorsi, tempi, ricerca e correzione a mano usano i dati originali.
import type { LL } from '../engine/geo'

export type Manuale = { id: string; lon: number; lat: number; e: number; n: number }
type P = { x: number; y: number; e: number; n: number; w: number }
let auto: P[] = [], manuali: Manuale[] = [], punti: P[] = []
const KX = 84560, KY = 111030, SIGMA = 60, FINE = 300, ZERO = 600, VICINO = 90, PESO_MANUALE = 6

function componi() {
  const m = manuali.map(p => ({ x: p.lon * KX, y: p.lat * KY, e: p.e, n: p.n, w: PESO_MANUALE }))
  punti = [...m, ...auto.filter(a => !m.some(q => (q.x - a.x) ** 2 + (q.y - a.y) ** 2 < VICINO * VICINO))]
}
export async function caricaAllineamento() {
  try {
    const r = await fetch('/data/allinea-google.json')
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) auto = ((await r.json()).punti as number[][]).map(p => ({ x: p[0] * KX, y: p[1] * KY, e: p[2], n: p[3], w: 1 }))
  } catch { /* senza file le vie restano dove sono */ }
  await ricaricaManuali()
}
export async function ricaricaManuali() {
  try { const r = await fetch('/api/allinea'); if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) manuali = await r.json() } catch { /* sviluppo senza Worker */ }
  componi()
}
export const puntiManuali = () => manuali
/** Spostamento in metri (est, nord) da dare a un punto perché cada sulla strada vista nel 3D. */
export function scarto(lo: number, la: number): [number, number] {
  if (!punti.length) return [0, 0]
  const x = lo * KX, y = la * KY
  let sw = 0, se = 0, sn = 0, dMin = Infinity
  for (const p of punti) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d2 > ZERO * ZERO) continue
    if (d2 < dMin) dMin = d2
    const w = p.w * (Math.exp(-d2 / (2 * SIGMA * SIGMA)) + 1e-9)
    sw += w; se += w * p.e; sn += w * p.n
  }
  if (!sw) return [0, 0]
  // lontano da ogni misura (sentieri in montagna) la correzione si spegne piano: lì non sappiamo quanto vale
  const d = Math.sqrt(dMin), f = d <= FINE ? 1 : Math.max(0, 1 - (d - FINE) / (ZERO - FINE))
  return [(se / sw) * f, (sn / sw) * f]
}
export function allinea(p: LL): LL {
  const [e, n] = scarto(p[0], p[1])
  return [p[0] + e / KX, p[1] + n / KY]
}

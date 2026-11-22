// Allineamento visivo delle vie al 3D di Google. I tracciati di OpenStreetMap sono spostati di qualche metro rispetto
// a quello che si vede nel 3D, in modo diverso da zona a zona. `public/data/allinea-google.json` contiene punti di
// controllo (lon, lat, metri verso est, metri verso nord) misurati guardando a piombo; qui si ricava lo spostamento
// di un punto qualsiasi come media dei controlli vicini (peso gaussiano, 60 m: le stazioni distano circa 70 m).
// È SOLO una correzione del disegno sopra Google: percorsi, tempi, ricerca e correzione a mano usano i dati originali.
import type { LL } from '../engine/geo'

type Controllo = [number, number, number, number]
let punti: { x: number; y: number; e: number; n: number }[] = []
const KX = 84560, KY = 111030, SIGMA = 60, FINE = 300, ZERO = 600

export async function caricaAllineamento() {
  try {
    const r = await fetch('/data/allinea-google.json')
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return
    punti = ((await r.json()).punti as Controllo[]).map(p => ({ x: p[0] * KX, y: p[1] * KY, e: p[2], n: p[3] }))
  } catch { /* senza file le vie restano dove sono */ }
}
/** Spostamento in metri (est, nord) da dare a un punto perché cada sulla strada vista nel 3D. */
export function scarto(lo: number, la: number): [number, number] {
  if (!punti.length) return [0, 0]
  const x = lo * KX, y = la * KY
  let sw = 0, se = 0, sn = 0, dMin = Infinity
  for (const p of punti) {
    const d2 = (p.x - x) ** 2 + (p.y - y) ** 2
    if (d2 > ZERO * ZERO) continue
    if (d2 < dMin) dMin = d2
    const w = Math.exp(-d2 / (2 * SIGMA * SIGMA)) + 1e-9
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

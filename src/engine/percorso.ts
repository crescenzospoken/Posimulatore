// Percorsi a piedi da A a B sulla rete OpenStreetMap, con le quote vere (LiDAR 2 m dove c'è).
// Tempi con la regola DIN 33466: 4 km/h in piano, 300 m/h di dislivello in salita, 500 in discesa;
// il tempo è il maggiore fra orizzontale e verticale più metà del minore.
// Sulle scale: 0,85 m/s in piano, 360 m/h su, 600 giù (stima, da tarare con i tempi veri).
import type { LL } from './geo'

export type Via = { id: string; k: string; c: LL[]; n?: string; galleria?: 1; ponte?: 1 }
type Arco = { v: string; t: number; d: number; su: number; giu: number; scale: number; seg: [number, number] }
export type Rete = { nodi: Map<string, { p: LL; z: number }>; archi: Map<string, Arco[]>; vie: Via[]; quote: number[][] }
export type Percorso = { pts: [number, number, number][]; minuti: number; ritorno: number; metri: number; salita: number; discesa: number; metriScale: number; gradini: number; nomi: string[] }

const KX = 111320 * Math.cos((40.63 * Math.PI) / 180), KY = 110950
const chiave = (p: LL) => p[0] + ',' + p[1]
const VP = 1.11, VS = 0.85

/** Scarto fra superficie (LiDAR DSM, ultimo ritorno) e terreno nudo (DTM) lungo una via, se la strada sta su arcate o solette.
 * Conta solo se è fra 1 e 12 m e regge sulla mediana di 5 vertici: tetti, alberi e auto sopra un vertice solo si scartano.
 * Esempio: via Colombo alla Sponda, su arcate, sta 5-6 m sopra il terreno nudo. */
export function scartoSoletta(dtm: number[], dsm: (number | undefined)[]): number[] {
  const d = dtm.map((z, i) => { const s = dsm[i]; return s !== undefined && s - z > 1 && s - z < 12 ? s - z : 0 })
  return d.map((_, i) => { const w = d.slice(Math.max(0, i - 2), i + 3).sort((a, b) => a - b); return w[w.length >> 1] })
}

/** Quote lungo una via: LiDAR al vertice se c'è, altrimenti il terreno; più la soletta se la strada è sospesa;
 * gallerie e ponti in linea retta fra gli estremi; lisciatura leggera. */
export function quoteVia(v: Via, zDi: (p: LL) => number, sDi?: (p: LL) => number | undefined): number[] {
  let z = v.c.map(zDi)
  if (sDi) { const sc = scartoSoletta(z, v.c.map(sDi)); z = z.map((x, i) => x + sc[i]) }
  if ((v.galleria || v.ponte) && z.length > 2) {
    let tot = 0; const d = [0]
    for (let i = 1; i < v.c.length; i++) d.push((tot += Math.hypot((v.c[i][0] - v.c[i - 1][0]) * KX, (v.c[i][1] - v.c[i - 1][1]) * KY)))
    const a = z[0], b = z[z.length - 1]
    z = d.map(x => a + ((b - a) * x) / (tot || 1))
  } else if (z.length > 3) {
    z = z.map((_, i) => (z[Math.max(i - 1, 0)] + z[i] + z[Math.min(i + 1, z.length - 1)]) / 3)
  }
  return z
}

export function tempoTratto(d: number, dz: number, scala: boolean) {
  const su = Math.max(dz, 0), giu = Math.max(-dz, 0)
  const th = d / (scala ? VS : VP)
  const tv = (su * 3600) / (scala ? 360 : 300) + (giu * 3600) / (scala ? 600 : 500)
  return Math.max(th, tv) + 0.5 * Math.min(th, tv)
}

export function creaRete(vie: Via[], zDi: (p: LL) => number, sDi?: (p: LL) => number | undefined): Rete {
  const nodi: Rete['nodi'] = new Map(), archi: Rete['archi'] = new Map(), quote: number[][] = []
  vie.forEach((v, iv) => {
    const z = quoteVia(v, zDi, sDi)
    quote.push(z)
    const scala = v.k === 'steps'
    for (let i = 0; i < v.c.length; i++) {
      const k = chiave(v.c[i])
      if (!nodi.has(k)) nodi.set(k, { p: v.c[i], z: z[i] })
      if (i === 0) continue
      const a = chiave(v.c[i - 1])
      const d = Math.hypot((v.c[i][0] - v.c[i - 1][0]) * KX, (v.c[i][1] - v.c[i - 1][1]) * KY)
      if (d < 0.01) continue
      const dz = z[i] - z[i - 1]
      const add = (da: string, a2: string, dz2: number) => {
        const l = archi.get(da) ?? []; archi.set(da, l)
        l.push({ v: a2, t: tempoTratto(d, dz2, scala), d, su: Math.max(dz2, 0), giu: Math.max(-dz2, 0), scale: scala ? d : 0, seg: [iv, i] })
      }
      add(a, k, dz); add(k, a, -dz)
    }
  })
  return { nodi, archi, vie, quote }
}

/** Nodo della rete più vicino a un punto (entro maxM metri). */
export function nodoVicino(r: Rete, p: LL, maxM = 250): string | null {
  let best: string | null = null, bd = maxM * maxM
  for (const [k, n] of r.nodi) {
    if (!r.archi.has(k)) continue
    const dx = (n.p[0] - p[0]) * KX, dy = (n.p[1] - p[1]) * KY, d = dx * dx + dy * dy
    if (d < bd) { bd = d; best = k }
  }
  return best
}

class Heap { a: [number, string][] = []
  push(x: [number, string]) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p } }
  pop() { const a = this.a, top = a[0], last = a.pop()!; if (a.length) { a[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m } } return top }
  get size() { return this.a.length } }

function dijkstra(r: Rete, a: string, b: string) {
  const D = new Map<string, number>([[a, 0]]), P = new Map<string, [string, Arco]>(), h = new Heap()
  h.push([0, a])
  while (h.size) {
    const [t, u] = h.pop()
    if (u === b) break
    if (t > (D.get(u) ?? Infinity)) continue
    for (const e of r.archi.get(u) ?? []) {
      const n = t + e.t
      if (n < (D.get(e.v) ?? Infinity)) { D.set(e.v, n); P.set(e.v, [u, e]); h.push([n, e.v]) }
    }
  }
  if (!D.has(b)) return null
  const archi: Arco[] = [], nodi = [b]
  for (let u = b; u !== a;) { const [pu, e] = P.get(u)!; archi.unshift(e); nodi.unshift(pu); u = pu }
  return { nodi, archi }
}

export function cammino(r: Rete, da: LL, a: LL): Percorso | null {
  const na = nodoVicino(r, da), nb = nodoVicino(r, a)
  if (!na || !nb) return null
  const x = dijkstra(r, na, nb)
  if (!x) return null
  const y = dijkstra(r, nb, na)
  let t = 0, d = 0, su = 0, giu = 0, sc = 0, scSu = 0
  const nomi: string[] = []
  for (const e of x.archi) {
    t += e.t; d += e.d; su += e.su; giu += e.giu; sc += e.scale; if (e.scale) scSu += e.su + e.giu
    const n = r.vie[e.seg[0]].n
    if (n && nomi.at(-1) !== n) nomi.push(n)
  }
  const pts = x.nodi.map(k => { const n = r.nodi.get(k)!; return [n.p[0], n.p[1], n.z] as [number, number, number] })
  return {
    pts, minuti: t / 60, ritorno: y ? y.archi.reduce((s, e) => s + e.t, 0) / 60 : NaN, metri: d, salita: su, discesa: giu, metriScale: sc,
    // alzata media dei gradini a Positano stimata in 16 cm (da verificare col censimento)
    gradini: Math.round(scSu / 0.16), nomi: [...new Set(nomi)],
  }
}

export const minutiTesto = (m: number) => !isFinite(m) ? '–' : m < 60 ? `${Math.max(1, Math.round(m))} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`

/** Link condivisibile: ?da=lon,lat,Nome&a=lon,lat,Nome */
export type Tappa = { p: LL; nome?: string }
export const tappaInLink = (t: Tappa) => `${t.p[0].toFixed(6)},${t.p[1].toFixed(6)}${t.nome ? ',' + t.nome : ''}`
export function tappaDaLink(s: string | null): Tappa | null {
  if (!s) return null
  const [lo, la, ...n] = s.split(',')
  const p: LL = [Number(lo), Number(la)]
  if (!isFinite(p[0]) || !isFinite(p[1]) || Math.abs(p[0] - 14.49) > 0.2 || Math.abs(p[1] - 40.62) > 0.2) return null
  const nome = n.join(',').trim().slice(0, 80)
  return { p, ...(nome ? { nome } : {}) }
}

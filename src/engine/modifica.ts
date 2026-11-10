// Modifiche di precisione ai punti di un oggetto. Tutto in metri su un piano locale con origine nel primo punto:
// E = verso est, N = verso nord. Funzioni pure: prendono e restituiscono coordinate geografiche.
import { Frame, type LL, type XY, add, dist, mul, norm, sub } from './geo'

export const r2 = (v: number) => Math.round(v * 100) / 100
/** Coordinate locali (E, N) in metri di ogni punto rispetto al primo. */
export function locali(pts: LL[]): XY[] {
  if (!pts.length) return []
  const f = new Frame(pts[0][0], pts[0][1])
  return pts.map(p => f.toXY(p))
}
function conLocali(pts: LL[], g: (xy: XY[]) => XY[]): LL[] {
  const f = new Frame(pts[0][0], pts[0][1])
  return g(pts.map(p => f.toXY(p))).map(q => f.toLL(q))
}
/** Sposta il punto i alle coordinate locali (e, n). Il punto 0 è l'origine: spostarlo trasla solo lui. */
export const muoviPunto = (pts: LL[], i: number, e: number, n: number): LL[] =>
  conLocali(pts, xy => xy.map((q, k) => (k === i ? [e, n] : q)))
/** Lunghezza dei lati: per le linee n-1 lati, per i poligoni (chiuso) n lati. */
export function lati(pts: LL[], chiuso: boolean): { l: number; az: number }[] {
  const xy = locali(pts), n = xy.length, out: { l: number; az: number }[] = []
  for (let i = 0; i < (chiuso ? n : n - 1); i++) {
    const a = xy[i], b = xy[(i + 1) % n]
    out.push({ l: dist(a, b), az: (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360 })
  }
  return out
}
/** Porta il lato i alla lunghezza l muovendo il suo secondo estremo lungo la direzione del lato. */
export function lunghezzaLato(pts: LL[], i: number, l: number): LL[] {
  return conLocali(pts, xy => {
    const n = xy.length, j = (i + 1) % n
    const u = norm(sub(xy[j], xy[i]))
    return xy.map((q, k) => (k === j ? add(xy[i], mul(u, Math.max(0.01, l))) : q))
  })
}
/** Orienta il lato i all'azimut dato (gradi da nord, orari) tenendo la sua lunghezza. */
export function azimutLato(pts: LL[], i: number, az: number): LL[] {
  return conLocali(pts, xy => {
    const n = xy.length, j = (i + 1) % n, l = dist(xy[i], xy[j]), t = az * Math.PI / 180
    return xy.map((q, k) => (k === j ? add(xy[i], [Math.sin(t) * l, Math.cos(t) * l]) : q))
  })
}
/** Nuovo punto a metà del lato che parte da i. */
export function inserisci(pts: LL[], i: number): LL[] {
  const j = (i + 1) % pts.length
  const m: LL = [(pts[i][0] + pts[j][0]) / 2, (pts[i][1] + pts[j][1]) / 2]
  return [...pts.slice(0, i + 1), m, ...pts.slice(i + 1)]
}
export const togliPunto = (pts: LL[], i: number, minimo: number): LL[] => (pts.length <= minimo ? pts : pts.filter((_, k) => k !== i))
/** Trasla tutto di (e, n) metri. */
export function trasla(pts: LL[], e: number, n: number): LL[] {
  const f = new Frame(pts[0][0], pts[0][1])
  return pts.map(p => f.toLL(add(f.toXY(p), [e, n])))
}
/** Ruota di `gradi` (orari) attorno al baricentro dei punti. */
export function ruota(pts: LL[], gradi: number): LL[] {
  return conLocali(pts, xy => {
    const c: XY = [xy.reduce((s, q) => s + q[0], 0) / xy.length, xy.reduce((s, q) => s + q[1], 0) / xy.length]
    const t = -gradi * Math.PI / 180, co = Math.cos(t), si = Math.sin(t)
    return xy.map(q => { const d = sub(q, c); return [c[0] + d[0] * co - d[1] * si, c[1] + d[0] * si + d[1] * co] as XY })
  })
}
/** Mette in squadra il punto i: lo sposta perché il lato che arriva e quello che parte facciano 90°. */
export function squadra(pts: LL[], i: number): LL[] {
  return conLocali(pts, xy => {
    const n = xy.length, a = xy[(i - 1 + n) % n], b = xy[(i + 1) % n], p = xy[i]
    // il punto in squadra sta sul cerchio di diametro a-b: prendiamo il più vicino a p
    const c = mul(add(a, b), 0.5), r = dist(a, b) / 2, d = sub(p, c), l = Math.hypot(d[0], d[1]) || 1
    return xy.map((q, k) => (k === i ? add(c, mul(d, r / l)) : q))
  })
}
/** Arrotonda le coordinate locali al passo dato (m). */
export const alPasso = (pts: LL[], passo: number): LL[] =>
  passo > 0 ? conLocali(pts, xy => xy.map(q => [Math.round(q[0] / passo) * passo, Math.round(q[1] / passo) * passo] as XY)) : pts

import { type XY, add, dist, mul, norm, perp, rect, sub } from './geo'
import { NORME } from './norme'
export type Disposizione = 'linea' | 'pettine' | 'spina'
export type TipoStallo = 'auto' | 'disabili' | 'moto' | 'carico'
export function misureStallo(disp: Disposizione, tipo: TipoStallo): { l: number; p: number } {
  if (tipo === 'moto') return { l: NORME.stalloMotoL.valore, p: NORME.stalloMotoP.valore }
  if (tipo === 'disabili') return { l: NORME.stalloDisabiliL.valore, p: 5.0 }
  if (tipo === 'carico') return { l: 2.5, p: 10 }
  if (disp === 'linea') return { l: NORME.stalloLineaP.valore, p: NORME.stalloLineaL.valore } // lungo il bordo 5 m
  return { l: NORME.stalloPettineL.valore, p: NORME.stalloPettineP.valore }
}
/**
 * Fila di stalli lungo la spezzata `line` (il bordo strada), sul lato sinistro (lato=1) o destro (-1).
 * Ritorna i rettangoli degli stalli in metri locali.
 */
export function filaStalli(line: XY[], disp: Disposizione, tipo: TipoStallo, lato: 1 | -1 = 1, lOver?: number, pOver?: number): XY[][] {
  const m = misureStallo(disp, tipo)
  const l = lOver ?? m.l, p = pOver ?? m.p
  const out: XY[][] = []
  for (let s = 1; s < line.length; s++) {
    const a = line[s - 1], b = line[s]
    const len = dist(a, b)
    const u = norm(sub(b, a))
    const v = mul(perp(u), lato)
    if (disp === 'spina') {
      // stalli a 45°: passo lungo il bordo l/sin45, rettangolo ruotato
      const passo = l / Math.SQRT1_2
      const c = Math.SQRT1_2
      const w: XY = norm(add(mul(u, c), mul(v, c)))
      const n = Math.floor((len - p * c) / passo)
      for (let i = 0; i < n; i++) {
        const o = add(a, mul(u, i * passo + p * c))
        // rettangolo con asse lungo w (profondità) e larghezza l lungo perp(w) verso u
        const q = mul(perp(w), -lato)
        out.push([o, add(o, mul(q, l)), add(add(o, mul(q, l)), mul(w, p)), add(o, mul(w, p))])
      }
      continue
    }
    const n = Math.floor(len / l + 1e-6)
    const off = (len - n * l) / 2
    for (let i = 0; i < n; i++) {
      const o = add(a, mul(u, off + i * l))
      out.push(lato === 1 ? rect(o, u, l, p) : [o, add(o, mul(u, l)), add(add(o, mul(u, l)), mul(v, p)), add(o, mul(v, p))])
    }
  }
  return out
}

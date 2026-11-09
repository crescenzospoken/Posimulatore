// Geometria locale: coordinate geografiche <-> metri su un piano tangente.
// Su qualche centinaio di metri l'errore è sotto il centimetro.
export type LL = [number, number] // [lon, lat] in gradi
export type XY = [number, number] // metri, x verso est, y verso nord

const R = 6378137
export class Frame {
  kx: number
  ky: number
  constructor(public lon0: number, public lat0: number) {
    const f = (lat0 * Math.PI) / 180
    this.kx = (Math.PI / 180) * R * Math.cos(f)
    this.ky = (Math.PI / 180) * R * (1 - 0.00669438 * Math.sin(f) ** 2) ** 0.5 * 0.99665
  }
  toXY([lon, lat]: LL): XY {
    return [(lon - this.lon0) * this.kx, (lat - this.lat0) * this.ky]
  }
  toLL([x, y]: XY): LL {
    return [this.lon0 + x / this.kx, this.lat0 + y / this.ky]
  }
}
export const frameFor = (pts: LL[]) => {
  const n = pts.length || 1
  return new Frame(pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n)
}

export const dist = (a: XY, b: XY) => Math.hypot(b[0] - a[0], b[1] - a[1])
export const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]]
export const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]]
export const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k]
export const norm = (a: XY): XY => {
  const l = Math.hypot(a[0], a[1]) || 1
  return [a[0] / l, a[1] / l]
}
export const perp = (a: XY): XY => [-a[1], a[0]]
export const dot = (a: XY, b: XY) => a[0] * b[0] + a[1] * b[1]

export function area(poly: XY[]): number {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}
export const ccw = (poly: XY[]) => (area(poly) < 0 ? [...poly].reverse() : poly)

export function inside(p: XY, poly: XY[]): boolean {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j]
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c
  }
  return c
}

export function distToSeg(p: XY, a: XY, b: XY): number {
  const ab = sub(b, a)
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)))
  return dist(p, add(a, mul(ab, t)))
}
export function distToPoly(p: XY, poly: XY[]): number {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSeg(p, poly[i], poly[(i + 1) % poly.length]))
  return d
}
/** Il rettangolo (4 vertici) sta tutto dentro il poligono con margine m? */
export function rectInside(rect: XY[], poly: XY[], m = 0): boolean {
  return rect.every(p => inside(p, poly) && distToPoly(p, poly) >= m - 1e-9) && segsDontCross(rect, poly)
}
function segX(a: XY, b: XY, c: XY, d: XY) {
  const o = (p: XY, q: XY, r: XY) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]))
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0
}
function segsDontCross(a: XY[], b: XY[]) {
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      if (segX(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length])) return false
  return true
}
export function polysOverlap(a: XY[], b: XY[]): boolean {
  if (!segsDontCross(a, b)) return true
  return inside(a[0], b) || inside(b[0], a)
}
export function lineLength(pts: XY[]) {
  let s = 0
  for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i])
  return s
}
/** Rettangolo orientato: origine o, asse u (versore), lunghezza l lungo u, profondità d lungo perp(u). */
export function rect(o: XY, u: XY, l: number, d: number): XY[] {
  const v = perp(u)
  return [o, add(o, mul(u, l)), add(add(o, mul(u, l)), mul(v, d)), add(o, mul(v, d))]
}
/** Direzione principale del poligono: il lato più lungo. */
export function mainAxis(poly: XY[]): { u: XY; i: number } {
  let best = 0, bi = 0
  for (let i = 0; i < poly.length; i++) {
    const l = dist(poly[i], poly[(i + 1) % poly.length])
    if (l > best) { best = l; bi = i }
  }
  return { u: norm(sub(poly[(bi + 1) % poly.length], poly[bi])), i: bi }
}
export const fmtM = (m: number) => (Math.abs(m) < 10 ? m.toFixed(2) : m.toFixed(1)).replace('.', ',') + ' m'
export const fmtM2 = (m: number) => Math.round(m).toLocaleString('it-IT') + ' m²'

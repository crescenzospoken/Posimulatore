const R = 6378137;
export class Frame {
    lon0;
    lat0;
    kx;
    ky;
    constructor(lon0, lat0) {
        this.lon0 = lon0;
        this.lat0 = lat0;
        const f = (lat0 * Math.PI) / 180;
        this.kx = (Math.PI / 180) * R * Math.cos(f);
        this.ky = (Math.PI / 180) * R * (1 - 0.00669438 * Math.sin(f) ** 2) ** 0.5 * 0.99665;
    }
    toXY([lon, lat]) {
        return [(lon - this.lon0) * this.kx, (lat - this.lat0) * this.ky];
    }
    toLL([x, y]) {
        return [this.lon0 + x / this.kx, this.lat0 + y / this.ky];
    }
}
export const frameFor = (pts) => {
    const n = pts.length || 1;
    return new Frame(pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n);
};
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, k) => [a[0] * k, a[1] * k];
export const norm = (a) => {
    const l = Math.hypot(a[0], a[1]) || 1;
    return [a[0] / l, a[1] / l];
};
export const perp = (a) => [-a[1], a[0]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export function area(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
}
export const ccw = (poly) => (area(poly) < 0 ? [...poly].reverse() : poly);
export function inside(p, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const a = poly[i], b = poly[j];
        if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0])
            c = !c;
    }
    return c;
}
export function distToSeg(p, a, b) {
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)));
    return dist(p, add(a, mul(ab, t)));
}
export function distToPoly(p, poly) {
    let d = Infinity;
    for (let i = 0; i < poly.length; i++)
        d = Math.min(d, distToSeg(p, poly[i], poly[(i + 1) % poly.length]));
    return d;
}
/** Il rettangolo (4 vertici) sta tutto dentro il poligono con margine m? */
export function rectInside(rect, poly, m = 0) {
    return rect.every(p => inside(p, poly) && distToPoly(p, poly) >= m - 1e-9) && segsDontCross(rect, poly);
}
function segX(a, b, c, d) {
    const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
    return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
function segsDontCross(a, b) {
    for (let i = 0; i < a.length; i++)
        for (let j = 0; j < b.length; j++)
            if (segX(a[i], a[(i + 1) % a.length], b[j], b[(j + 1) % b.length]))
                return false;
    return true;
}
export function polysOverlap(a, b) {
    if (!segsDontCross(a, b))
        return true;
    return inside(a[0], b) || inside(b[0], a);
}
export function lineLength(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++)
        s += dist(pts[i - 1], pts[i]);
    return s;
}
/** Rettangolo orientato: origine o, asse u (versore), lunghezza l lungo u, profondità d lungo perp(u). */
export function rect(o, u, l, d) {
    const v = perp(u);
    return [o, add(o, mul(u, l)), add(add(o, mul(u, l)), mul(v, d)), add(o, mul(v, d))];
}
/** Direzione principale del poligono: il lato più lungo. */
export function mainAxis(poly) {
    let best = 0, bi = 0;
    for (let i = 0; i < poly.length; i++) {
        const l = dist(poly[i], poly[(i + 1) % poly.length]);
        if (l > best) {
            best = l;
            bi = i;
        }
    }
    return { u: norm(sub(poly[(bi + 1) % poly.length], poly[bi])), i: bi };
}
export const fmtM = (m) => (Math.abs(m) < 10 ? m.toFixed(2) : m.toFixed(1)).replace('.', ',') + ' m';
export const fmtM2 = (m) => Math.round(m).toLocaleString('it-IT') + ' m²';

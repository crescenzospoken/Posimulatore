import * as C from 'cesium'
/** Ondulazione del geoide (EGM96) a Positano: quota ellissoidica = quota s.l.m. + GEOIDE. */
export const GEOIDE = 47.6
type Griglia = { w: number; e: number; s: number; n: number; step: number; nx: number; ny: number; a: Uint16Array }
let det: Griglia, ctx: Griglia
const dentro = (g: Griglia, lon: number, lat: number) => lon >= g.w && lon <= g.e && lat >= g.s && lat <= g.n
function bil(g: Griglia, lon: number, lat: number) {
  let fx = (lon - g.w) / g.step, fy = (g.n - lat) / g.step
  fx = Math.min(Math.max(fx, 0), g.nx - 1.001); fy = Math.min(Math.max(fy, 0), g.ny - 1.001)
  const x0 = fx | 0, y0 = fy | 0, dx = fx - x0, dy = fy - y0, a = g.a, i = y0 * g.nx + x0
  return ((a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dy) + (a[i + g.nx] * (1 - dx) + a[i + g.nx + 1] * dx) * dy) / 10
}
/** Quota del terreno in m s.l.m. (modello a 10 m nel comune, 30 m attorno, 0 sul mare). */
export function quota(lon: number, lat: number): number {
  if (det && dentro(det, lon, lat)) return bil(det, lon, lat)
  if (ctx && dentro(ctx, lon, lat)) return bil(ctx, lon, lat)
  return 0
}
export const dettaglioBox = () => det && { w: det.w, e: det.e, s: det.s, n: det.n }

export async function caricaTerreno(base = '/data/') {
  const meta = await (await fetch(base + 'terreno.json')).json()
  const load = async (k: 'dettaglio' | 'contesto') => {
    const buf = await (await fetch(`${base}terreno-${k}.bin`)).arrayBuffer()
    return { ...meta[k], a: new Uint16Array(buf) } as Griglia
  }
  ;[det, ctx] = await Promise.all([load('dettaglio'), load('contesto')])
  const N = 65
  const ts = new C.GeographicTilingScheme()
  return new C.CustomHeightmapTerrainProvider({
    width: N, height: N, tilingScheme: ts,
    credit: new C.Credit('Terreno: TINITALY 1.1 INGV (CC BY 4.0), Copernicus DEM GLO-30'),
    callback(x, y, level) {
      const r = ts.tileXYToRectangle(x, y, level)
      const w = C.Math.toDegrees(r.west), e = C.Math.toDegrees(r.east), s = C.Math.toDegrees(r.south), n = C.Math.toDegrees(r.north)
      const out = new Float32Array(N * N)
      for (let j = 0; j < N; j++) {
        const lat = n - ((n - s) * j) / (N - 1)
        for (let i = 0; i < N; i++) out[j * N + i] = quota(w + ((e - w) * i) / (N - 1), lat) + GEOIDE
      }
      return out
    },
  })
}

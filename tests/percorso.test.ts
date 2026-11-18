import { describe, expect, it } from 'vitest'
// @ts-ignore: nei test si leggono i dati veri dal disco (tipi di Node non installati)
import { readFileSync } from 'node:fs'
import { creaRete, cammino, tappaDaLink, tappaInLink, tempoTratto, type Via } from '../src/engine/percorso'
import type { LL } from '../src/engine/geo'

const D = 'public/data/'
const vie: Via[] = JSON.parse(readFileSync(D + 'strade.json', 'utf8'))
const Q = new Map<string, number>((JSON.parse(readFileSync(D + 'quote-vie.json', 'utf8')).punti as number[][]).map(p => [p[0] + ',' + p[1], p[2]]))
const m = JSON.parse(readFileSync(D + 'terreno.json', 'utf8')).dettaglio
const buf = readFileSync(D + 'terreno-dettaglio.bin')
const A = new Uint16Array(buf.buffer, buf.byteOffset, buf.byteLength / 2)
const tin = (lon: number, lat: number) => {
  const fx = Math.min(Math.max((lon - m.w) / m.step, 0), m.nx - 1.001), fy = Math.min(Math.max((m.n - lat) / m.step, 0), m.ny - 1.001)
  const x0 = fx | 0, y0 = fy | 0, dx = fx - x0, dy = fy - y0, i = y0 * m.nx + x0
  return ((A[i] * (1 - dx) + A[i + 1] * dx) * (1 - dy) + (A[i + m.nx] * (1 - dx) + A[i + m.nx + 1] * dx) * dy) / 10
}
const rete = creaRete(vie, p => Q.get(p[0] + ',' + p[1]) ?? tin(p[0], p[1]))
const L: Record<string, LL> = { chiesaNuova: [14.4823335, 40.6294794], spiaggia: [14.4862, 40.6279], montepertuso: [14.493447, 40.631504], collegiata: [14.487054, 40.628339] }

describe('percorsi a piedi', () => {
  it('regola DIN: piano e salita', () => {
    expect(tempoTratto(1110, 0, false)).toBeCloseTo(1000, 0) // 1,11 km in piano a 4 km/h: 1000 s
    expect(tempoTratto(0.001, 300, false)).toBeCloseTo(3600, -1)
  })
  it('Chiesa Nuova -> Spiaggia Grande come lo script (25 min, ritorno 34)', () => {
    const p = cammino(rete, L.chiesaNuova, L.spiaggia)!
    expect(p.minuti).toBeGreaterThan(21); expect(p.minuti).toBeLessThan(29)
    expect(p.ritorno).toBeGreaterThan(p.minuti)
    expect(p.discesa).toBeGreaterThan(120)
  })
  it('Montepertuso -> Collegiata (49 min, ritorno 69)', () => {
    const p = cammino(rete, L.montepertuso, L.collegiata)!
    expect(p.minuti).toBeGreaterThan(42); expect(p.minuti).toBeLessThan(56)
    expect(p.ritorno).toBeGreaterThan(60)
    expect(p.gradini).toBeGreaterThan(500)
  })
  it('link: andata e ritorno, scarta punti fuori Positano', () => {
    const t = tappaDaLink(tappaInLink({ p: [14.4823335, 40.6294794], nome: 'CREO, Positano' }))!
    expect(t.nome).toBe('CREO, Positano'); expect(t.p[0]).toBeCloseTo(14.4823335, 5)
    expect(tappaDaLink('12.5,41.9,Roma')).toBeNull()
    expect(tappaDaLink('abc')).toBeNull()
  })
})

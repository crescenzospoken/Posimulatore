import { describe, expect, it } from 'vitest'
import { Frame, area, inside, type XY } from '../src/engine/geo'
import { calcolaPiazza, PIAZZA_DEF } from '../src/engine/piazza'
import { filaStalli } from '../src/engine/stalli'

describe('geo', () => {
  it('andata e ritorno metri/gradi', () => {
    const f = new Frame(14.4823, 40.6295)
    const ll = f.toLL([100, -50])
    const xy = f.toXY(ll)
    expect(xy[0]).toBeCloseTo(100, 6)
    expect(xy[1]).toBeCloseTo(-50, 6)
    // un grado di longitudine a 40,63° è circa 84,6 km
    expect(f.kx / 1000).toBeGreaterThan(84)
    expect(f.kx / 1000).toBeLessThan(85)
  })
  it('area e punto interno', () => {
    const q: XY[] = [[0, 0], [10, 0], [10, 5], [0, 5]]
    expect(area(q)).toBe(50)
    expect(inside([5, 2], q)).toBe(true)
    expect(inside([11, 2], q)).toBe(false)
  })
})

describe('stalli', () => {
  it('in linea: 5 m l\'uno lungo il bordo', () => {
    expect(filaStalli([[0, 0], [26, 0]], 'linea', 'auto').length).toBe(5)
  })
  it('a pettine: 2,5 m l\'uno', () => {
    expect(filaStalli([[0, 0], [25, 0]], 'pettine', 'auto').length).toBe(10)
  })
  it('a spina 45°: meno stalli che a pettine', () => {
    const n = filaStalli([[0, 0], [25, 0]], 'spina', 'auto').length
    expect(n).toBeGreaterThan(4)
    expect(n).toBeLessThan(10)
  })
})

describe('piazza a sbalzo', () => {
  const rett: XY[] = [[0, 0], [40, 0], [40, 17], [0, 17]]
  const piano = () => 130 // terreno piatto 10 m sotto la piazza
  it('un piano di parcheggio: stalli, rampa, controlli', () => {
    const p = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140 }, piano)
    expect(p.area).toBeCloseTo(680, 0)
    expect(p.livelli.length).toBe(2)
    expect(p.rampaL).toBeCloseTo(20, 5) // 3,2 / 0,16
    expect(p.stalliTot).toBeGreaterThan(15)
    expect(p.controlli.find(c => c.testo.startsWith('Altezza libera'))?.esito).toBe('ok')
    expect(p.pilastri.length).toBeGreaterThan(0)
    expect(p.pilastri.every(c => c.base === 130)).toBe(true)
  })
  it('interpiano troppo basso: errore', () => {
    const p = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140, hLiv: 2.6 }, piano)
    expect(p.controlli.find(c => c.testo.startsWith('Altezza libera'))?.esito).toBe('errore')
  })
  it('scavo quando il terreno sale sopra il fondo', () => {
    const p = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140 }, () => 140)
    // fondo a 140 - 3,2 - 0,5 = 136,3: 3,7 m su 680 m²
    expect(p.scavo).toBeGreaterThan(2300)
    expect(p.scavo).toBeLessThan(2700)
  })
  it('senza parcheggio: solo pilastri dal terreno', () => {
    const p = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140, livelli: 0 }, piano)
    expect(p.stalliTot).toBe(0)
    expect(p.rampa).toBeNull()
    expect(p.pilastri.length).toBeGreaterThan(5)
  })
  it('poligono in senso orario: stesso lato d\'attacco', () => {
    const cw = [...rett].reverse()
    // lato 0 di rett = (0,0)-(40,0); in cw quel lato è l'indice 2: (40,0)->(0,0)
    const a = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140, attacco: 0 }, piano)
    const b = calcolaPiazza(cw, { ...PIAZZA_DEF, quota: 140, attacco: 2 }, piano)
    expect(b.stalliTot).toBe(a.stalliTot)
    expect(Math.abs(b.u[0])).toBeCloseTo(1, 6)
  })
  it('segnala gli edifici sotto', () => {
    const p = calcolaPiazza(rett, { ...PIAZZA_DEF, quota: 140 }, piano, [{ id: 'w1', poly: [[5, 5], [8, 5], [8, 8], [5, 8]] }, { id: 'w2', poly: [[50, 5], [55, 5], [55, 8]] }])
    expect(p.interferenze).toEqual(['w1'])
  })
})

describe('piazza con ingresso dal basso', () => {
  it('senza rampa interna entrano più posti', () => {
    const r: XY[] = [[0, 0], [40, 0], [40, 17], [0, 17]]
    const con = calcolaPiazza(r, { ...PIAZZA_DEF, quota: 140 }, () => 130)
    const senza = calcolaPiazza(r, { ...PIAZZA_DEF, quota: 140, rampa: false }, () => 130)
    expect(senza.rampa).toBeNull()
    expect(senza.stalliTot).toBeGreaterThan(con.stalliTot)
  })
})

import { Frame as F2 } from '../src/engine/geo'
import { azimutLato, inserisci, lati, locali, lunghezzaLato, muoviPunto, ruota, squadra, togliPunto, trasla } from '../src/engine/modifica'
describe('modifica di precisione', () => {
  const f = new F2(14.4823, 40.6295)
  const q = ([[0, 0], [10, 0], [10, 6], [0, 6]] as [number, number][]).map(p => f.toLL(p))
  it('coordinate locali e lati', () => {
    const l = locali(q)
    expect(l[2][0]).toBeCloseTo(10, 3); expect(l[2][1]).toBeCloseTo(6, 3)
    const s = lati(q, true)
    expect(s.map(x => Math.round(x.l * 100) / 100)).toEqual([10, 6, 10, 6])
    expect(s[0].az).toBeCloseTo(90, 3) // verso est
  })
  it('lunghezza di un lato: si muove solo il secondo estremo', () => {
    const p = lunghezzaLato(q, 0, 12.5)
    expect(lati(p, true)[0].l).toBeCloseTo(12.5, 3)
    expect(p[0]).toEqual(q[0]); expect(p[3]).toEqual(q[3])
  })
  it('azimut di un lato', () => {
    const p = azimutLato(q, 0, 0) // ora punta a nord
    const l = locali(p)
    expect(l[1][0]).toBeCloseTo(0, 3); expect(l[1][1]).toBeCloseTo(10, 3)
  })
  it('sposta un punto, inserisci e togli', () => {
    expect(locali(muoviPunto(q, 2, 11, 7))[2]).toEqual([expect.closeTo(11, 3), expect.closeTo(7, 3)])
    const p = inserisci(q, 0)
    expect(p.length).toBe(5); expect(locali(p)[1][0]).toBeCloseTo(5, 3)
    expect(togliPunto(p, 1, 3).length).toBe(4)
    expect(togliPunto(q.slice(0, 3), 1, 3).length).toBe(3) // non scende sotto il minimo
  })
  it('trasla e ruota tengono le misure', () => {
    const t = trasla(q, 3, -2)
    expect(new F2(q[0][0], q[0][1]).toXY(t[0])[0]).toBeCloseTo(3, 3)
    const r = ruota(q, 90)
    expect(lati(r, true).map(x => Math.round(x.l * 100) / 100)).toEqual([10, 6, 10, 6])
    expect(lati(r, true)[0].az).toBeCloseTo(180, 2) // da est a sud: rotazione oraria
  })
  it('squadra: 90° nel punto', () => {
    const storto = muoviPunto(q, 1, 11, 1.5)
    const l = locali(squadra(storto, 1))
    const a = [l[0][0] - l[1][0], l[0][1] - l[1][1]], b = [l[2][0] - l[1][0], l[2][1] - l[1][1]]
    expect(a[0] * b[0] + a[1] * b[1]).toBeCloseTo(0, 6)
  })
})

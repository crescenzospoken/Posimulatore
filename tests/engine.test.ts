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

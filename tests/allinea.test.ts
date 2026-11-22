import { describe, it, expect, vi, beforeAll } from 'vitest'
import { caricaAllineamento, scarto, manualeVicino } from '../src/scene/allinea'

const KX = 84560, KY = 111030
describe('allineamento delle vie', () => {
  beforeAll(async () => {
    vi.stubGlobal('fetch', async (u: string) => new Response(JSON.stringify(u.includes('allinea-google')
      ? { punti: [[14.48, 40.62, 2, 0], [14.48 + 70 / KX, 40.62, 0, 0], [14.49, 40.63, 0, 0]] }
      : [{ id: 'a', lon: 14.4805, lat: 40.6203, e: 10, n: -4 }, { id: 'b', lon: 14.4805 + 30 / KX, lat: 40.6203, e: 2, n: 6 }]), { headers: { 'content-type': 'application/json' } }))
    await caricaAllineamento()
  })
  it('sul punto manuale il risultato è esattamente il suo valore', () => {
    const [e, n] = scarto(14.4805, 40.6203); expect(e).toBeCloseTo(10, 1); expect(n).toBeCloseTo(-4, 1)
    const [e2, n2] = scarto(14.4805 + 30 / KX, 40.6203); expect(e2).toBeCloseTo(2, 1); expect(n2).toBeCloseTo(6, 1)
  })
  it('fra due punti manuali vicini passa dall\'uno all\'altro', () => {
    const [e] = scarto(14.4805 + 15 / KX, 40.6203); expect(e).toBeGreaterThan(2); expect(e).toBeLessThan(10)
  })
  it('lontano dai punti manuali resta solo la misura automatica', () => {
    const [e, n] = scarto(14.49, 40.63); expect(Math.hypot(e, n)).toBeLessThan(0.05)
  })
  it('un trascinamento vicino aggiorna il punto che c\'è già', () => {
    expect(manualeVicino(14.4805 + 8 / KX, 40.6203)?.id).toBe('a'); expect(manualeVicino(14.4805, 40.6203 + 60 / KY)).toBeUndefined()
  })
})

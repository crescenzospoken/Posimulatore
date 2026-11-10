import { Frame, type XY } from './engine/geo'
import { type Progetto, uid } from './engine/model'
import { PIAZZA_DEF } from './engine/piazza'

/** Bivio di Chiesa Nuova: SS163 (Via G. Marconi) con Via Pasitea, nodo OpenStreetMap. */
export const CHIESA_NUOVA: [number, number] = [14.4823335, 40.6294794]

export function esempio(): Progetto {
  const f = new Frame(...CHIESA_NUOVA)
  const ll = (p: XY[]) => p.map(q => f.toLL(q))
  const oA = uid()
  // Area indicata da Crescenzo il 10/11: il triangolo sotto il muro della statale, fra la strada alta (circa 160 m)
  // e il tornante basso di Via Pasitea (circa 146 m), dove oggi c'è un edificio basso con un albero.
  const Z = 160.3
  const piazza = {
    id: uid(), tipo: 'piazza' as const, nome: 'Piazza a sbalzo con parcheggio', z: Z,
    // contorno misurato sulle quote di Google (10/11): muro della statale a x = 5 m, bordo est 2 m dentro il cordolo della strada bassa
    pts: ll([[5, 1.5], [5, 19], [5, 23], [8, 21.5], [12, 17.5], [16, 13.5], [20, 9.5], [21.5, 6], [21.5, 0.5], [20.5, -2], [17, -4.5], [14, -5], [11.5, -3.5], [7.5, -0.5]]),
    par: { ...PIAZZA_DEF, attacco: 0, livelli: 3, hLiv: 3.4, rampa: false } as Record<string, number | boolean>,
  }
  return {
    id: uid(), nome: 'Piazza a Chiesa Nuova', creato: new Date().toISOString(), modificato: new Date().toISOString(),
    attiva: oA,
    opzioni: [
      {
        id: oA, nome: 'Opzione A', edifici: {},
        oggetti: [
          piazza,
          { id: uid(), tipo: 'area', nome: 'Area di attesa', pts: ll([[8, 2], [8, 11], [14, 9], [16, 3]]), z: Z, par: { uso: 'attesa' } },
          { id: uid(), tipo: 'modello', nome: 'Gazebo 3x3', pts: ll([[17, -1]]), z: Z, par: { m: 'gazebo33', rot: 20 } },
          { id: uid(), tipo: 'modello', nome: 'Gruppo di persone', pts: ll([[11, 6]]), z: Z, par: { m: 'gruppo', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Albero', pts: ll([[8, 18]]), z: Z, par: { m: 'pino', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Panchina', pts: ll([[12.5, 14.5]]), z: Z, par: { m: 'panchina', rot: 45 } },
          { id: uid(), tipo: 'modello', nome: 'Panchina', pts: ll([[17.5, 9.5]]), z: Z, par: { m: 'panchina', rot: 45 } },
          { id: uid(), tipo: 'modello', nome: 'Lampione', pts: ll([[6.5, 20]]), z: Z, par: { m: 'palo', rot: 90 } },
          { id: uid(), tipo: 'modello', nome: 'Lampione', pts: ll([[20, 2]]), z: Z, par: { m: 'palo', rot: 250 } },
        ],
      },
    ],
    vista: { lon: 14.48335, lat: 40.62935, h: 222, heading: 262, pitch: -38 },
  }
}

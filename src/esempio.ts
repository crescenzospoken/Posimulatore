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
  const Z = 160.5
  const piazza = {
    id: uid(), tipo: 'piazza' as const, nome: 'Piazza a sbalzo con parcheggio', z: Z,
    pts: ll([[6, -2], [6, 22], [13, 18], [22, 9], [27, 2]]),
    par: { ...PIAZZA_DEF, attacco: 0, livelli: 2, rampa: false } as Record<string, number | boolean>,
  }
  return {
    id: uid(), nome: 'Piazza a Chiesa Nuova', creato: new Date().toISOString(), modificato: new Date().toISOString(),
    attiva: oA,
    opzioni: [
      {
        id: oA, nome: 'Opzione A', edifici: {},
        oggetti: [
          piazza,
          { id: uid(), tipo: 'area', nome: 'Area di attesa', pts: ll([[8, 2], [8, 12], [15, 9], [17, 3]]), z: Z, par: { uso: 'attesa' } },
          { id: uid(), tipo: 'modello', nome: 'Gazebo 3x3', pts: ll([[21, 4]]), z: Z, par: { m: 'gazebo33', rot: 20 } },
          { id: uid(), tipo: 'modello', nome: 'Gruppo di persone', pts: ll([[12, 7]]), z: Z, par: { m: 'gruppo', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Albero', pts: ll([[9, 17]]), z: Z, par: { m: 'albero', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Panchina', pts: ll([[14, 14]]), z: Z, par: { m: 'panchina', rot: 55 } },
          { id: uid(), tipo: 'modello', nome: 'Panchina', pts: ll([[19, 9.5]]), z: Z, par: { m: 'panchina', rot: 50 } },
          { id: uid(), tipo: 'modello', nome: 'Lampione', pts: ll([[8, 20]]), z: Z, par: { m: 'palo', rot: 90 } },
          { id: uid(), tipo: 'modello', nome: 'Lampione', pts: ll([[24, 2.5]]), z: Z, par: { m: 'palo', rot: 200 } },
        ],
      },
    ],
    vista: { lon: 14.48335, lat: 40.62935, h: 222, heading: 262, pitch: -38 },
  }
}

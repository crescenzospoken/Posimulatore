import { Frame, type XY } from './engine/geo'
import { type Progetto, uid } from './engine/model'
import { PIAZZA_DEF } from './engine/piazza'

/** Bivio di Chiesa Nuova: SS163 (Via G. Marconi) con Via Pasitea, nodo OpenStreetMap. */
export const CHIESA_NUOVA: [number, number] = [14.4823335, 40.6294794]

export function esempio(): Progetto {
  const f = new Frame(...CHIESA_NUOVA)
  const ll = (p: XY[]) => p.map(q => f.toLL(q))
  const oA = uid()
  const piazza = {
    id: uid(), tipo: 'piazza' as const, nome: 'Piazza a sbalzo con parcheggio', z: 139.5,
    pts: ll([[-2, -4], [-32, -9], [-30, -20], [-3, -15]]),
    par: { ...PIAZZA_DEF, attacco: 0, livelli: 1, rampaPos: 0.05 } as Record<string, number | boolean>,
  }
  return {
    id: uid(), nome: 'Esempio · Piazza a Chiesa Nuova', creato: new Date().toISOString(), modificato: new Date().toISOString(),
    attiva: oA,
    opzioni: [
      {
        id: oA, nome: 'Opzione A', edifici: {},
        oggetti: [
          piazza,
          { id: uid(), tipo: 'area', nome: 'Area di attesa', pts: ll([[-7, -8.5], [-19, -10.5], [-18, -16.5], [-6, -14.5]]), z: 139.5, par: { uso: 'attesa' } },
          { id: uid(), tipo: 'modello', nome: 'Gazebo 6x3', pts: ll([[-25, -14]]), z: 139.5, par: { m: 'gazebo63', rot: -80 } },
          { id: uid(), tipo: 'modello', nome: 'Gruppo di persone', pts: ll([[-12, -12]]), z: 139.5, par: { m: 'gruppo', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Albero', pts: ll([[-5, -12]]), z: 139.5, par: { m: 'albero', rot: 0 } },
          { id: uid(), tipo: 'modello', nome: 'Autobus', pts: ll([[-1, 9]]), par: { m: 'bus', rot: -10 } },
        ],
      },
    ],
    vista: { lon: 14.48150, lat: 40.62800, h: 215, heading: 25, pitch: -35 },
  }
}

// Misure di riferimento con la loro fonte. stato: 'norma' = letta nel testo; 'prassi' = uso corrente, da verificare.
export type Regola = { valore: number; unita: string; fonte: string; stato: 'norma' | 'prassi' }
export const NORME = {
  strisciaUrbana: { valore: 0.12, unita: 'm', fonte: 'DPR 495/1992 art. 138 (strade urbane)', stato: 'prassi' },
  strisciaExtra: { valore: 0.15, unita: 'm', fonte: 'DPR 495/1992 art. 138 (strade extraurbane)', stato: 'prassi' },
  zebraStriscia: { valore: 0.5, unita: 'm', fonte: 'DPR 495/1992 art. 145', stato: 'prassi' },
  zebraMinLocale: { valore: 2.5, unita: 'm', fonte: 'DPR 495/1992 art. 145 (strade locali)', stato: 'prassi' },
  stalloLineaL: { valore: 2.0, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  stalloLineaP: { valore: 5.0, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  stalloPettineL: { valore: 2.5, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  stalloPettineP: { valore: 5.0, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  stalloDisabiliL: { valore: 3.2, unita: 'm', fonte: 'DPR 495/1992 fig. II.445/a', stato: 'prassi' },
  stalloMotoL: { valore: 1.0, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  stalloMotoP: { valore: 2.0, unita: 'm', fonte: 'prassi comunale', stato: 'prassi' },
  autorimessaH: { valore: 2.4, unita: 'm', fonte: 'DM Interno 1/2/1986 (autorimesse), altezza minima', stato: 'prassi' },
  rampaMax: { valore: 0.2, unita: '', fonte: 'DM Interno 1/2/1986, pendenza massima rampe', stato: 'prassi' },
  corsia90: { valore: 6.0, unita: 'm', fonte: 'prassi per stalli a 90°', stato: 'prassi' },
  rampaL: { valore: 3.5, unita: 'm', fonte: 'prassi, rampa a senso unico', stato: 'prassi' },
  parapetto: { valore: 1.1, unita: 'm', fonte: 'NTC 2018 / regolamenti edilizi, parapetti', stato: 'prassi' },
} satisfies Record<string, Regola>

// Modelli parametrici fatti di parti semplici (scatole, cilindri, sfere), in metri locali.
// x verso destra, y in avanti, z in alto; l'origine è a terra al centro.
export type Parte =
  | { f: 'box'; c: [number, number, number]; d: [number, number, number]; col: string }
  | { f: 'cil'; c: [number, number, number]; r: number; h: number; col: string; r2?: number }
  | { f: 'sfera'; c: [number, number, number]; r: [number, number, number]; col: string }
export type Modello = { id: string; nome: string; gruppo: string; dim: [number, number, number]; parti: Parte[]; nota?: string }

const auto = (col: string): Parte[] => [
  { f: 'box', c: [0, 0, 0.45], d: [1.8, 4.3, 0.7], col },
  { f: 'box', c: [0, -0.2, 1.1], d: [1.6, 2.2, 0.6], col: '#2b3440' },
  ...[[-0.8, 1.35], [0.8, 1.35], [-0.8, -1.35], [0.8, -1.35]].map(([x, y]) => ({ f: 'cil', c: [x, y, 0.32], r: 0.32, h: 0.22, col: '#1d1d1d' }) as Parte),
]
const gazebo = (w: number, l: number): Parte[] => [
  ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => ({ f: 'box', c: [(sx * w) / 2 - sx * 0.05, (sy * l) / 2 - sy * 0.05, 1.1], d: [0.06, 0.06, 2.2], col: '#d9d9d9' }) as Parte),
  { f: 'box', c: [0, 0, 2.25], d: [w, l, 0.12], col: '#f7f7f2' },
  { f: 'cil', c: [0, 0, 2.6], r: Math.min(w, l) * 0.12, r2: Math.max(w, l) * 0.62, h: 0.6, col: '#f7f7f2' },
]
export const CATALOGO: Modello[] = [
  { id: 'auto', nome: 'Automobile', gruppo: 'Veicoli', dim: [1.8, 4.3, 1.45], parti: auto('#b8c4cf') },
  { id: 'auto-rossa', nome: 'Automobile rossa', gruppo: 'Veicoli', dim: [1.8, 4.3, 1.45], parti: auto('#b33a2f') },
  { id: 'minivan', nome: 'Furgone', gruppo: 'Veicoli', dim: [2.0, 5.2, 2.3], parti: [
    { f: 'box', c: [0, 0, 1.2], d: [2.0, 5.2, 1.9], col: '#eeeeee' },
    { f: 'box', c: [0, 2.1, 1.55], d: [1.9, 0.9, 0.8], col: '#2b3440' },
    ...[[-0.9, 1.7], [0.9, 1.7], [-0.9, -1.7], [0.9, -1.7]].map(([x, y]) => ({ f: 'cil', c: [x, y, 0.35], r: 0.35, h: 0.25, col: '#1d1d1d' }) as Parte)] },
  { id: 'bus', nome: 'Autobus di linea (10 m)', gruppo: 'Veicoli', dim: [2.5, 10.0, 3.2], parti: [
    { f: 'box', c: [0, 0, 1.75], d: [2.5, 10, 2.9], col: '#2f6db3' },
    { f: 'box', c: [0, 0, 2.2], d: [2.52, 9.2, 0.9], col: '#26303b' },
    ...[[-1.15, 3.3], [1.15, 3.3], [-1.15, -2.8], [1.15, -2.8]].map(([x, y]) => ({ f: 'cil', c: [x, y, 0.5], r: 0.5, h: 0.3, col: '#1d1d1d' }) as Parte)], nota: 'Ingombro tipico dei bus della costiera, da verificare' },
  { id: 'moto', nome: 'Scooter', gruppo: 'Veicoli', dim: [0.7, 1.9, 1.2], parti: [
    { f: 'box', c: [0, 0, 0.55], d: [0.5, 1.6, 0.5], col: '#3c3c3c' },
    { f: 'cil', c: [0, 0.75, 0.3], r: 0.3, h: 0.12, col: '#111' }, { f: 'cil', c: [0, -0.7, 0.3], r: 0.3, h: 0.12, col: '#111' }] },
  { id: 'persona', nome: 'Persona', gruppo: 'Persone', dim: [0.5, 0.3, 1.75], parti: [
    { f: 'cil', c: [0, 0, 0.75], r: 0.2, h: 1.5, col: '#5a6b7d' }, { f: 'sfera', c: [0, 0, 1.62], r: [0.12, 0.12, 0.14], col: '#e2b48f' }] },
  { id: 'gruppo', nome: 'Gruppo di 6 persone', gruppo: 'Persone', dim: [2, 2, 1.75], parti:
    [[-0.6, -0.5], [0.4, -0.7], [0.8, 0.3], [-0.2, 0.2], [-0.8, 0.7], [0.3, 0.9]].flatMap(([x, y], i) => [
      { f: 'cil', c: [x, y, 0.75], r: 0.2, h: 1.5, col: ['#5a6b7d', '#a0522d', '#2e8b57', '#6a5acd', '#c0392b', '#34495e'][i] } as Parte,
      { f: 'sfera', c: [x, y, 1.62], r: [0.12, 0.12, 0.14], col: '#e2b48f' } as Parte]) },
  { id: 'gazebo33', nome: 'Gazebo 3x3', gruppo: 'Strutture temporanee', dim: [3, 3, 2.9], parti: gazebo(3, 3) },
  { id: 'gazebo63', nome: 'Gazebo 6x3', gruppo: 'Strutture temporanee', dim: [6, 3, 2.9], parti: gazebo(6, 3) },
  { id: 'palco', nome: 'Palco 8x6', gruppo: 'Strutture temporanee', dim: [8, 6, 1.2], parti: [
    { f: 'box', c: [0, 0, 0.5], d: [8, 6, 1.0], col: '#3b3b3b' },
    ...[[-3.9, -2.9], [3.9, -2.9], [3.9, 2.9], [-3.9, 2.9]].map(([x, y]) => ({ f: 'box', c: [x, y, 3], d: [0.3, 0.3, 4], col: '#888' }) as Parte),
    { f: 'box', c: [0, 0, 5.0], d: [8.2, 6.2, 0.3], col: '#888' }] },
  { id: 'tenda', nome: 'Tenda pneumatica 6x6 (protezione civile)', gruppo: 'Strutture temporanee', dim: [6, 6, 3], parti: [
    { f: 'box', c: [0, 0, 0.9], d: [6, 6, 1.8], col: '#3d6fb3' }, { f: 'cil', c: [0, 0, 2.4], r: 0.5, r2: 4.2, h: 1.2, col: '#3d6fb3' }] },
  { id: 'container', nome: 'Container 20 piedi', gruppo: 'Strutture temporanee', dim: [2.44, 6.06, 2.59], parti: [{ f: 'box', c: [0, 0, 1.3], d: [2.44, 6.06, 2.59], col: '#c46a2b' }] },
  { id: 'bagno', nome: 'Bagno chimico', gruppo: 'Strutture temporanee', dim: [1.2, 1.2, 2.3], parti: [{ f: 'box', c: [0, 0, 1.15], d: [1.2, 1.2, 2.3], col: '#2b6cb0' }] },
  { id: 'transenna', nome: 'Transenna 2 m', gruppo: 'Strutture temporanee', dim: [2, 0.6, 1.1], parti: [
    { f: 'box', c: [0, 0, 1.05], d: [2, 0.04, 0.05], col: '#cfcfcf' }, { f: 'box', c: [0, 0, 0.15], d: [2, 0.04, 0.05], col: '#cfcfcf' },
    { f: 'box', c: [-0.95, 0, 0.55], d: [0.05, 0.6, 1.1], col: '#cfcfcf' }, { f: 'box', c: [0.95, 0, 0.55], d: [0.05, 0.6, 1.1], col: '#cfcfcf' }] },
  { id: 'cartello', nome: 'Cartello stradale', gruppo: 'Arredo e segnaletica verticale', dim: [0.6, 0.1, 2.8], parti: [
    { f: 'cil', c: [0, 0, 1.25], r: 0.03, h: 2.5, col: '#9a9a9a' }, { f: 'cil', c: [0, 0, 2.5], r: 0.3, h: 0.04, col: '#1f5fbf' }], nota: 'Disco orientato verso l\'alto: usare la rotazione per il verso' },
  { id: 'palo', nome: 'Lampione', gruppo: 'Arredo e segnaletica verticale', dim: [0.3, 1.2, 5.5], parti: [
    { f: 'cil', c: [0, 0, 2.6], r: 0.06, h: 5.2, col: '#2e3a2e' }, { f: 'box', c: [0, 0.45, 5.2], d: [0.2, 0.9, 0.12], col: '#2e3a2e' }] },
  { id: 'panchina', nome: 'Panchina', gruppo: 'Arredo e segnaletica verticale', dim: [1.8, 0.6, 0.85], parti: [
    { f: 'box', c: [0, 0, 0.45], d: [1.8, 0.45, 0.06], col: '#8b5a2b' }, { f: 'box', c: [0, 0.22, 0.7], d: [1.8, 0.05, 0.35], col: '#8b5a2b' },
    { f: 'box', c: [-0.8, 0, 0.22], d: [0.06, 0.45, 0.44], col: '#333' }, { f: 'box', c: [0.8, 0, 0.22], d: [0.06, 0.45, 0.44], col: '#333' }] },
  { id: 'fioriera', nome: 'Fioriera', gruppo: 'Arredo e segnaletica verticale', dim: [1, 1, 1.1], parti: [
    { f: 'box', c: [0, 0, 0.3], d: [1, 1, 0.6], col: '#c9b79c' }, { f: 'sfera', c: [0, 0, 0.8], r: [0.5, 0.5, 0.35], col: '#3f7d3a' }] },
  { id: 'albero', nome: 'Albero', gruppo: 'Arredo e segnaletica verticale', dim: [4, 4, 6], parti: [
    { f: 'cil', c: [0, 0, 1.5], r: 0.15, h: 3, col: '#6b4a2b' }, { f: 'sfera', c: [0, 0, 4.2], r: [2, 2, 1.8], col: '#3d7a35' }] },
  { id: 'dissuasore', nome: 'Dissuasore (paletto)', gruppo: 'Arredo e segnaletica verticale', dim: [0.15, 0.15, 0.9], parti: [{ f: 'cil', c: [0, 0, 0.45], r: 0.075, h: 0.9, col: '#555' }] },
  { id: 'ascensore', nome: 'Torre ascensore', gruppo: 'Strutture', dim: [2.5, 2.5, 12], parti: [{ f: 'box', c: [0, 0, 6], d: [2.5, 2.5, 12], col: '#d8dde2' }], nota: 'Altezza da impostare' },
]
export const modello = (id: string) => CATALOGO.find(m => m.id === id) ?? CATALOGO[0]

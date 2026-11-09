import type { LL } from './geo'
export type Tipo =
  | 'linea' | 'zebra' | 'arresto' | 'stalli' | 'freccia' | 'area' | 'volume' | 'barriera' | 'modello' | 'piazza' | 'testo'
export type Par = Record<string, number | string | boolean>
export type Obj = {
  id: string
  tipo: Tipo
  nome: string
  pts: LL[]
  /** quota di appoggio in m s.l.m.; se assente si appoggia al terreno */
  z?: number
  par: Par
}
export type Opzione = { id: string; nome: string; oggetti: Obj[]; edifici: Record<string, { h?: number; via?: boolean; col?: string }> }
export type Progetto = { id: string; nome: string; creato: string; modificato: string; opzioni: Opzione[]; attiva: string; vista?: Vista }
export type Vista = { lon: number; lat: number; h: number; heading: number; pitch: number }

export const uid = () => Math.random().toString(36).slice(2, 10)

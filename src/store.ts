import { create } from 'zustand'
import type { LL } from './engine/geo'
import { type Obj, type Opzione, type Progetto, type Tipo, type Vista, uid } from './engine/model'
import { esempio } from './esempio'

export type Strumento =
  | { k: 'naviga' }
  | { k: 'disegna'; tipo: Tipo; par: Obj['par']; nome: string; min: number; max: number; aiuto: string }
  | { k: 'misura'; modo: 'distanza' | 'area' | 'altezza' | 'quota' }
  | { k: 'cammina' }
export type Misura = { id: string; modo: 'distanza' | 'area' | 'altezza' | 'quota'; pts: { p: LL; z: number }[] }
export type Livelli = {
  orto: 'pcn2012' | 'esri' | 'osm'
  edifici: boolean
  stile: 'plastico' | 'facciate'
  strade: boolean
  nomi: boolean
  confine: boolean
  google: boolean
  googleScelto?: boolean
  ombre: boolean
  nitido: boolean
  ora: number // ore decimali, ora locale
  giorno: string // AAAA-MM-GG
}
type Stato = {
  progetti: Progetto[]
  pid: string
  sel: string | null
  selEdificio: string | null
  strumento: Strumento
  bozza: LL[]
  misure: Misura[]
  livelli: Livelli
  ionToken: string
  ionTokenSito: string
  ultimaQuota: number | null
  googleGiro: number
  /** punto scelto dell'oggetto selezionato */
  vSel: number | null
  /** passo delle modifiche in metri (0 = libero) */
  passo: number
  info: { p: LL; z: number } | null
  pannello: 'oggetto' | 'livelli' | 'progetto' | 'catalogo' | 'aiuto' | null
  passato: string[]
  futuro: string[]
  avviso: string | null
  // azioni
  progetto: () => Progetto
  opzione: () => Opzione
  modifica: (f: (o: Opzione) => void, salvaStoria?: boolean) => void
  aggiungi: (o: Omit<Obj, 'id'>) => string
  aggiorna: (id: string, f: (o: Obj) => void, salvaStoria?: boolean) => void
  togli: (id: string) => void
  duplica: (id: string) => void
  annulla: () => void
  ripeti: () => void
  set: (p: Partial<Stato>) => void
  setLivelli: (p: Partial<Livelli>) => void
  nuovoProgetto: (nome: string) => void
  apriProgetto: (id: string) => void
  rinominaProgetto: (nome: string) => void
  eliminaProgetto: (id: string) => void
  nuovaOpzione: (copia: boolean) => void
  apriOpzione: (id: string) => void
  importa: (p: Progetto) => void
  salvaVista: (v: Vista) => void
  dici: (t: string) => void
}
const KEY = 'posimulatore.v5'
type Salvato = { progetti: Progetto[]; pid: string; livelli?: Livelli; ionToken?: string }
function leggi(): Salvato | null {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null } catch { return null }
}
const LIV0: Livelli = { orto: 'esri', edifici: true, stile: 'plastico', strade: false, nomi: true, confine: true, google: false, ombre: true, nitido: true, ora: 12.5, giorno: '2026-06-21' }
const iniziale = leggi()
const prog0 = iniziale?.progetti?.length ? iniziale.progetti : [esempio()]
let timer: ReturnType<typeof setTimeout> | undefined
function salva(s: Stato) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ progetti: s.progetti, pid: s.pid, livelli: s.livelli, ionToken: s.ionToken })) } catch { /* pieno o privato */ }
  }, 300)
}

export const useS = create<Stato>((set, get) => ({
  progetti: prog0,
  pid: iniziale?.pid && prog0.some(p => p.id === iniziale.pid) ? iniziale.pid : prog0[0].id,
  sel: null,
  selEdificio: null,
  strumento: { k: 'naviga' },
  bozza: [],
  misure: [],
  livelli: { ...LIV0, ...(iniziale?.livelli ?? {}), google: Boolean(iniziale?.ionToken) && (iniziale?.livelli?.googleScelto ?? true) },
  ionToken: iniziale?.ionToken ?? '',
  ionTokenSito: '',
  ultimaQuota: null,
  googleGiro: 0,
  vSel: null,
  passo: 0.1,
  info: null,
  pannello: null,
  passato: [],
  futuro: [],
  avviso: null,
  progetto: () => get().progetti.find(p => p.id === get().pid)!,
  opzione: () => { const p = get().progetto(); return p.opzioni.find(o => o.id === p.attiva) ?? p.opzioni[0] },
  modifica(f, salvaStoria = true) {
    const s = get()
    const prima = JSON.stringify(s.opzione())
    const progetti = s.progetti.map(p => {
      if (p.id !== s.pid) return p
      const opzioni = p.opzioni.map(o => {
        if (o.id !== (p.attiva ?? p.opzioni[0].id)) return o
        const c: Opzione = JSON.parse(JSON.stringify(o)); f(c); return c
      })
      return { ...p, opzioni, modificato: new Date().toISOString() }
    })
    set({ progetti, ...(salvaStoria ? { passato: [...s.passato.slice(-99), prima], futuro: [] } : {}) })
    salva(get())
  },
  aggiungi(o) {
    const id = uid()
    get().modifica(op => { op.oggetti.push({ ...o, id }) })
    set({ sel: id, pannello: 'oggetto' })
    return id
  },
  aggiorna(id, f, salvaStoria = true) {
    get().modifica(op => { const o = op.oggetti.find(x => x.id === id); if (o) f(o) }, salvaStoria)
  },
  togli(id) {
    get().modifica(op => { op.oggetti = op.oggetti.filter(o => o.id !== id) })
    if (get().sel === id) set({ sel: null })
  },
  duplica(id) {
    const o = get().opzione().oggetti.find(x => x.id === id)
    if (!o) return
    const d = 0.00003
    get().aggiungi({ ...JSON.parse(JSON.stringify(o)), nome: o.nome + ' (copia)', pts: o.pts.map(([x, y]) => [x + d, y - d]) })
  },
  annulla() {
    const s = get(); const prima = s.passato.at(-1); if (!prima) return
    const ora = JSON.stringify(s.opzione())
    const o: Opzione = JSON.parse(prima)
    set({ progetti: s.progetti.map(p => p.id !== s.pid ? p : { ...p, opzioni: p.opzioni.map(x => (x.id === o.id ? o : x)) }), passato: s.passato.slice(0, -1), futuro: [...s.futuro, ora] })
    salva(get())
  },
  ripeti() {
    const s = get(); const dopo = s.futuro.at(-1); if (!dopo) return
    const ora = JSON.stringify(s.opzione())
    const o: Opzione = JSON.parse(dopo)
    set({ progetti: s.progetti.map(p => p.id !== s.pid ? p : { ...p, opzioni: p.opzioni.map(x => (x.id === o.id ? o : x)) }), futuro: s.futuro.slice(0, -1), passato: [...s.passato, ora] })
    salva(get())
  },
  set(p) { set(p); if ('ionToken' in p) salva(get()) },
  setLivelli(p) { set({ livelli: { ...get().livelli, ...p, ...('google' in p ? { googleScelto: p.google } : {}) } }); salva(get()) },
  nuovoProgetto(nome) {
    const o: Opzione = { id: uid(), nome: 'Opzione A', oggetti: [], edifici: {} }
    const p: Progetto = { id: uid(), nome, creato: new Date().toISOString(), modificato: new Date().toISOString(), opzioni: [o], attiva: o.id }
    set({ progetti: [...get().progetti, p], pid: p.id, sel: null, passato: [], futuro: [] }); salva(get())
  },
  apriProgetto(id) { set({ pid: id, sel: null, passato: [], futuro: [] }); salva(get()) },
  rinominaProgetto(nome) { set({ progetti: get().progetti.map(p => (p.id === get().pid ? { ...p, nome } : p)) }); salva(get()) },
  eliminaProgetto(id) {
    let progetti = get().progetti.filter(p => p.id !== id)
    if (!progetti.length) progetti = [esempio()]
    set({ progetti, pid: progetti[0].id, sel: null, passato: [], futuro: [] }); salva(get())
  },
  nuovaOpzione(copia) {
    const p = get().progetto()
    const lettera = String.fromCharCode(65 + p.opzioni.length)
    const base = copia ? JSON.parse(JSON.stringify(get().opzione())) : { oggetti: [], edifici: {} }
    const o: Opzione = { ...base, id: uid(), nome: 'Opzione ' + lettera }
    set({ progetti: get().progetti.map(x => (x.id === p.id ? { ...x, opzioni: [...x.opzioni, o], attiva: o.id } : x)), sel: null, passato: [], futuro: [] })
    salva(get())
  },
  apriOpzione(id) { set({ progetti: get().progetti.map(x => (x.id === get().pid ? { ...x, attiva: id } : x)), sel: null, passato: [], futuro: [] }); salva(get()) },
  importa(p) {
    const n = { ...p, id: uid(), nome: p.nome + ' (importato)' }
    set({ progetti: [...get().progetti, n], pid: n.id, sel: null }); salva(get())
  },
  salvaVista(v) { set({ progetti: get().progetti.map(p => (p.id === get().pid ? { ...p, vista: v } : p)) }); salva(get()) },
  dici(t) { set({ avviso: t }); setTimeout(() => { if (get().avviso === t) set({ avviso: null }) }, 4000) },
}))
export const oggetti = () => useS.getState().opzione().oggetti

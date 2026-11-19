import { create } from 'zustand'
import { telefono, qualitaIniziale } from './scene/viewer'
import type { LL } from './engine/geo'
import { type Obj, type Opzione, type Progetto, type Tipo, type Vista, uid } from './engine/model'
import type { Tappa } from './engine/percorso'
import { CATEGORIE } from './engine/poi'

export type Strumento =
  | { k: 'naviga' }
  | { k: 'disegna'; tipo: Tipo; par: Obj['par']; nome: string; min: number; max: number; aiuto: string }
  | { k: 'misura'; modo: 'distanza' | 'area' | 'altezza' | 'quota' }
  | { k: 'cammina' }
  | { k: 'percorso' }
  | { k: 'poi' }
  | { k: 'vie' }
export type Utente = { email: string; nome: string; ruolo: 'attesa' | 'editor' | 'admin' }
export type Misura = { id: string; modo: 'distanza' | 'area' | 'altezza' | 'quota'; pts: { p: LL; z: number }[] }
export type Livelli = {
  orto: 'pcn2012' | 'esri' | 'osm' | 'mappa'
  edifici: boolean
  stile: 'plastico' | 'facciate'
  strade: boolean
  nomi: boolean
  confine: boolean
  google: boolean
  googleScelto?: boolean
  ombre: boolean
  nitido: boolean
  /** mostra gli oggetti di progetto (piazze, segnaletica, arredi) */
  progetto: boolean
  qualita: 'leggera' | 'normale' | 'alta'
  /** colori delle vie per gruppo (statale, strade, scale...): vuoto = colori di base */
  coloriVie: Record<string, string>
  /** versione delle impostazioni di base, per cambiarle una volta a chi le aveva già salvate */
  rev?: number
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
  /** chiave di Google Map Tiles del sito: il 3D si prende da Google diretto (uso pubblico permesso); Cesium ion resta di riserva */
  googleKey: string
  ultimaQuota: number | null
  googleGiro: number
  /** punto scelto dell'oggetto selezionato */
  vSel: number | null
  /** passo delle modifiche in metri (0 = libero) */
  passo: number
  info: { p: LL; z: number } | null
  pannello: 'oggetto' | 'livelli' | 'progetto' | 'catalogo' | 'aiuto' | 'percorso' | 'accesso' | 'utenti' | 'poi' | 'via' | null
  /** via in correzione (id OSM) e la sua bozza: punti, quota delle arcate, controllata */
  selVia: string | null
  viaBozza: { c: LL[]; dz: number; controllata: boolean } | null
  viaVSel: number | null
  /** chi ha fatto l'accesso (null = visitatore); solo editor e admin vedono gli strumenti di modifica */
  utente: Utente | null
  /** l'editor ha acceso la modalità modifica (progetti, disegno, edifici) */
  inModifica: boolean
  /** categorie di punti di interesse accese */
  poiCat: string[]
  /** punto di interesse scelto (scheda aperta) o in modifica */
  selPoi: string | null
  /** luogo di Google scelto dalla ricerca: solo in memoria, mai salvato (regole di Google) */
  selGoogle: import('./engine/luoghiGoogle').LuogoGoogle | null
  /** nuova posizione scelta sulla mappa per il punto aperto (quando si sposta) */
  poiPos: LL | null
  spostaPoi: boolean
  /** colori di base delle vie per tutti, scelti dall'amministratore */
  coloriBase: Record<string, string>
  /** percorso a piedi da A a B; scegli = quale dei due prende il prossimo clic sulla mappa */
  percorso: { da: Tappa | null; a: Tappa | null; scegli: 'da' | 'a' | null }
  /** punto «Casa» del visitatore (dove alloggia): partenza di base dei percorsi; scegliCasa = il prossimo clic sulla mappa lo fissa */
  casa: Tappa | null
  scegliCasa: boolean
  /** il visitatore ha già visto (o chiuso) la richiesta del punto Casa */
  casaChiesta: boolean
  /** aperto da un link o da un QR: interfaccia ridotta al solo percorso */
  ospite: boolean
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
type Salvato = { progetti: Progetto[]; pid: string; livelli?: Livelli; ionToken?: string; partenza?: Tappa | null; poiCat?: string[]; inModifica?: boolean; senzaEsempio?: boolean; casa?: Tappa | null; casaChiesta?: boolean }
function leggi(): Salvato | null {
  try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null } catch { return null }
}
const LIV0: Livelli = { orto: 'esri', edifici: false, stile: 'plastico', strade: true, nomi: true, confine: true, google: false, ombre: false, nitido: !telefono(), progetto: false, qualita: qualitaIniziale(), coloriVie: {}, rev: 3, ora: 12.5, giorno: '2026-06-21' }
const iniziale = leggi()
/** Progetto vuoto di partenza (la piazza d'esempio a Chiesa Nuova è stata tolta su richiesta, 18/11). */
function vuoto(): Progetto {
  const o: Opzione = { id: uid(), nome: 'Opzione A', oggetti: [], edifici: {} }
  return { id: uid(), nome: 'Nuovo progetto', creato: new Date().toISOString(), modificato: new Date().toISOString(), opzioni: [o], attiva: o.id }
}
// chi aveva già salvato il progetto d'esempio «Piazza a Chiesa Nuova» lo perde una volta sola; i suoi progetti restano
const salvati = (iniziale?.progetti ?? []).filter(p => iniziale?.senzaEsempio || p.nome !== 'Piazza a Chiesa Nuova')
const prog0 = salvati.length ? salvati : [vuoto()]
let timer: ReturnType<typeof setTimeout> | undefined
function salva(s: Stato) {
  clearTimeout(timer)
  timer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ progetti: s.progetti, pid: s.pid, livelli: s.livelli, ionToken: s.ionToken, partenza: s.ospite ? leggi()?.partenza : s.percorso.da, poiCat: s.poiCat, inModifica: s.inModifica, senzaEsempio: true, casa: s.casa, casaChiesta: s.casaChiesta })) } catch { /* pieno o privato */ }
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
  // chi aveva salvato i livelli prima della qualità aveva le ombre accese di base: si ripartono spente (pesano molto)
  // rev 2 (18/11): edifici OSM e oggetti di progetto spenti di base, sono i livelli che pesano di più
  livelli: { ...LIV0, ...(iniziale?.livelli ?? {}), ...(iniziale?.livelli && !('qualita' in iniziale.livelli) ? { ombre: false, nitido: LIV0.nitido } : {}), ...((iniziale?.livelli?.rev ?? 0) < 2 ? { edifici: false, progetto: false } : {}), ...((iniziale?.livelli?.rev ?? 0) < 3 ? { strade: true, coloriVie: {}, rev: 3 } : {}), google: Boolean(iniziale?.ionToken) && (iniziale?.livelli?.googleScelto ?? true) },
  ionToken: iniziale?.ionToken ?? '',
  ionTokenSito: '',
  googleKey: '',
  ultimaQuota: null,
  googleGiro: 0,
  vSel: null,
  passo: 0.1,
  info: null,
  pannello: null,
  percorso: { da: iniziale?.partenza ?? null, a: null, scegli: null },
  ospite: false,
  selVia: null,
  viaBozza: null,
  viaVSel: null,
  casa: iniziale?.casa ?? null,
  scegliCasa: false,
  casaChiesta: iniziale?.casaChiesta ?? false,
  utente: null,
  inModifica: iniziale?.inModifica ?? false,
  poiCat: iniziale?.poiCat ?? CATEGORIE.filter(c => c.base).map(c => c.k),
  selPoi: null,
  selGoogle: null,
  poiPos: null,
  spostaPoi: false,
  coloriBase: {},
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
  set(p) { set(p); if ('ionToken' in p || 'poiCat' in p || 'inModifica' in p || 'casa' in p || 'casaChiesta' in p) salva(get()) },
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
    if (!progetti.length) progetti = [vuoto()]
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

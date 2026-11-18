import { useEffect, useState, type FormEvent } from 'react'
import { useS, type Utente } from '../store'
import { CATEGORIE, categoria, orariLeggibili } from '../engine/poi'
import { poiDa, ricaricaPoi } from '../scene/poi'
import { ultimaPosizione, dentroPositano } from '../scene/gps'

/** Chiamata alle API: JSON, intestazione propria (le scritture la richiedono) e messaggio d'errore leggibile. */
export async function chiama<T = unknown>(via: string, metodo = 'GET', corpo?: unknown): Promise<T> {
  const r = await fetch('/api/' + via, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Posimulatore': '1' }, body: corpo === undefined ? undefined : JSON.stringify(corpo), credentials: 'same-origin' })
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new Error((j as { errore?: string } | null)?.errore ?? 'Il server non risponde, riprova')
  // senza Worker (sviluppo) arriva la pagina HTML al posto del JSON
  if (j === null && via !== 'io') throw new Error('Il server non risponde, riprova')
  return j as T
}
export const puoModificare = (u: { ruolo: string } | null) => u?.ruolo === 'editor' || u?.ruolo === 'admin'

/** Fila di categorie da accendere e spegnere, come i filtri di Google Maps. */
export function Servizi() {
  const s = useS()
  const [tutte, setTutte] = useState(false)
  const on = new Set(s.poiCat)
  const cambia = (k: string) => s.set({ poiCat: on.has(k) ? s.poiCat.filter(x => x !== k) : [...s.poiCat, k] })
  const lista = tutte ? CATEGORIE : CATEGORIE.filter(c => c.base || on.has(c.k))
  return (
    <div className="servizi" role="toolbar" aria-label="Punti di interesse">
      {lista.map(c => (
        <button key={c.k} className={'chip' + (on.has(c.k) ? ' acceso' : '')} aria-pressed={on.has(c.k)} onClick={() => cambia(c.k)}><span aria-hidden>{c.icona}</span>{c.nome}</button>
      ))}
      <button className="chip quiet" onClick={() => setTutte(!tutte)}>{tutte ? 'Meno' : 'Altri…'}</button>
    </div>
  )
}

/** Scheda di un punto di interesse: nome, categoria, note, orari, «Portami qui». */
export function SchedaPoi() {
  const s = useS()
  const p = s.selPoi ? poiDa(s.selPoi) : undefined
  if (!p) return null
  const c = categoria(p.c)
  const portami = () => {
    const io = ultimaPosizione()
    const da = io && dentroPositano(io.p) ? { p: io.p, nome: 'La mia posizione' } : s.percorso.da
    s.set({ strumento: { k: 'percorso' }, percorso: { da, a: { p: p.p, nome: p.n ?? c.nome }, scegli: da ? null : 'da' }, selPoi: null, pannello: null })
  }
  const x = p.x ?? {}
  return (
    <section className="scheda-poi" aria-label={p.n ?? c.nome}>
      <div className="pannello-testa">
        <h2><span aria-hidden>{c.icona}</span> {p.n ?? c.nome}</h2>
        <button className="quiet" onClick={() => s.set({ selPoi: null })} aria-label="Chiudi">✕</button>
      </div>
      <p className="nota">{c.nome}{p.nascosto ? ' · nascosto ai visitatori' : ''}</p>
      {p.note && <p>{p.note}</p>}
      {x.opening_hours && <p>Orari: {orariLeggibili(x.opening_hours)}</p>}
      {x.fee && <p>{x.fee === 'yes' ? 'A pagamento' : x.fee === 'no' ? 'Gratuito' : x.fee}</p>}
      {x.wheelchair === 'yes' && <p>Accessibile in sedia a rotelle</p>}
      {x.phone && <p><a href={'tel:' + x.phone.replace(/\s/g, '')}>{x.phone}</a></p>}
      <div className="riga-bottoni">
        <button className="primary" onClick={portami}>🧭 Portami qui</button>
        {puoModificare(s.utente) && s.inModifica && <button onClick={() => s.set({ pannello: 'poi' })}>Modifica</button>}
      </div>
      <p className="nota">{p.fonte === 'osm' ? 'Dati © OpenStreetMap' : 'Aggiunto dal Comune'}</p>
    </section>
  )
}

/** Pannello per aggiungere o correggere un punto (solo editor). Il punto nuovo nasce col clic sulla mappa. */
export function ModificaPoi() {
  const s = useS()
  const p = s.selPoi ? poiDa(s.selPoi) : undefined
  const nuovo = s.selPoi?.startsWith('nuovo:')
  const [d, setD] = useState({ c: p?.c ?? 'bagni', n: p?.n ?? '', note: p?.note ?? '', nascosto: !!p?.nascosto })
  const [lavoro, setLavoro] = useState(false)
  useEffect(() => { setD({ c: p?.c ?? d.c, n: p?.n ?? '', note: p?.note ?? '', nascosto: !!p?.nascosto }) }, [s.selPoi])
  const coord = s.poiPos ?? p?.p ?? (nuovo && s.selPoi ? (s.selPoi.split(':').slice(1, 3).map(Number) as [number, number]) : null)
  if (!coord) return <p className="nota">Tocca un punto della mappa per aggiungerlo, o un simbolo per correggerlo.</p>
  const id = nuovo ? 'mano:' + Math.random().toString(36).slice(2, 10) : s.selPoi!
  const salva = async () => {
    setLavoro(true)
    try {
      await chiama('poi/' + encodeURIComponent(id), 'PUT', { ...d, lon: coord[0], lat: coord[1] })
      await ricaricaPoi(); s.set({ selPoi: id, poiPos: null, googleGiro: s.googleGiro + 1, poiCat: s.poiCat.includes(d.c) ? s.poiCat : [...s.poiCat, d.c] }); s.dici('Salvato: lo vedono tutti')
    } catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  const togli = async () => {
    setLavoro(true)
    try { await chiama('poi/' + encodeURIComponent(id), 'DELETE'); await ricaricaPoi(); s.set({ selPoi: null, pannello: null, googleGiro: s.googleGiro + 1 }); s.dici(p?.fonte === 'osm' ? 'Tornato com\'era su OpenStreetMap' : 'Punto eliminato') }
    catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  return (
    <div className="campi">
      <label>Categoria
        <select value={d.c} onChange={e => setD({ ...d, c: e.target.value })}>{CATEGORIE.map(c => <option key={c.k} value={c.k}>{c.icona} {c.nome}</option>)}</select>
      </label>
      <label>Nome<input value={d.n} maxLength={80} placeholder="Es. Bagni pubblici di Piazza dei Mulini" onChange={e => setD({ ...d, n: e.target.value })} /></label>
      <label>Note per chi lo cerca<textarea value={d.note} maxLength={400} rows={3} placeholder="Orari, prezzo, come si arriva" onChange={e => setD({ ...d, note: e.target.value })} /></label>
      <label className="riga"><span>Nascondi ai visitatori<small>Resta visibile solo a chi modifica</small></span><input type="checkbox" checked={d.nascosto} onChange={e => setD({ ...d, nascosto: e.target.checked })} /></label>
      <p className="nota">Posizione {coord[1].toFixed(6)}, {coord[0].toFixed(6)}{s.poiPos ? ' (nuova, da salvare)' : ''}</p>
      <button className={'quiet' + (s.spostaPoi ? ' acceso' : '')} aria-pressed={s.spostaPoi} onClick={() => s.set({ spostaPoi: !s.spostaPoi, strumento: { k: 'poi' } })}>{s.spostaPoi ? 'Tocca la mappa dove va' : 'Sposta sulla mappa'}</button>
      <div className="riga-bottoni">
        <button className="primary" disabled={lavoro} onClick={salva}>{nuovo ? 'Aggiungi' : 'Salva'}</button>
        {!nuovo && (p?.fonte === 'mano' || p?.nascosto || p?.note) && <button className="danger" disabled={lavoro} onClick={togli}>{p?.fonte === 'osm' ? 'Annulla le correzioni' : 'Elimina'}</button>}
      </div>
    </div>
  )
}

/** Accesso e registrazione. Chi si registra resta in attesa finché l'amministratore non lo abilita. */
export function Accesso() {
  const s = useS()
  const [modo, setModo] = useState<'accedi' | 'registrati'>('accedi')
  const [d, setD] = useState({ email: '', nome: '', password: '' })
  const [err, setErr] = useState<string | null>(null)
  const [lavoro, setLavoro] = useState(false)
  if (s.utente) {
    const u = s.utente
    return (
      <div className="campi">
        <p>Hai fatto l'accesso come <b>{u.nome}</b> ({u.email}).</p>
        {u.ruolo === 'attesa' && <p className="nota">Il tuo account aspetta di essere abilitato dall'amministratore. Intanto puoi usare la mappa come tutti.</p>}
        {puoModificare(u) && <label className="riga"><span>Modalità modifica<small>Progetti, disegno, edifici, punti di interesse</small></span><input type="checkbox" checked={s.inModifica} onChange={e => s.set({ inModifica: e.target.checked })} /></label>}
        {u.ruolo === 'admin' && <button onClick={() => s.set({ pannello: 'utenti' })}>Utenti e permessi</button>}
        <button className="quiet" onClick={async () => { try { await chiama('esci', 'POST') } catch { /* già fuori */ } s.set({ utente: null, inModifica: false, pannello: null }); s.dici('Sei uscito') }}>Esci</button>
      </div>
    )
  }
  const invia = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setLavoro(true)
    try {
      const u = await chiama<Utente>(modo, 'POST', d)
      s.set({ utente: u, inModifica: puoModificare(u), pannello: puoModificare(u) ? null : 'accesso' })
      s.dici(modo === 'registrati' ? 'Registrazione fatta' : 'Bentornato, ' + u.nome)
    } catch (x) { setErr((x as Error).message) } finally { setLavoro(false) }
  }
  return (
    <form className="campi" onSubmit={invia}>
      <p className="nota">La mappa è aperta a tutti. L'accesso serve a chi progetta e aggiorna i punti di interesse.</p>
      {modo === 'registrati' && <label>Nome e cognome<input value={d.nome} autoComplete="name" onChange={e => setD({ ...d, nome: e.target.value })} required /></label>}
      <label>Email<input type="email" value={d.email} autoComplete="email" onChange={e => setD({ ...d, email: e.target.value })} required /></label>
      <label>Password<input type="password" value={d.password} autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'} minLength={modo === 'registrati' ? 8 : undefined} onChange={e => setD({ ...d, password: e.target.value })} required />{modo === 'registrati' && <small>Almeno 8 caratteri</small>}</label>
      {err && <p className="errore-campo" role="alert">{err}</p>}
      <button className="primary" disabled={lavoro}>{modo === 'accedi' ? 'Accedi' : 'Registrati'}</button>
      <button type="button" className="quiet" onClick={() => { setModo(modo === 'accedi' ? 'registrati' : 'accedi'); setErr(null) }}>{modo === 'accedi' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}</button>
      {modo === 'registrati' && <p className="nota">Dopo la registrazione l'amministratore abilita il tuo account alla modifica.</p>}
    </form>
  )
}

type Riga = { email: string; nome: string; ruolo: string; creato: string }
/** Elenco utenti per l'amministratore: abilita, togli i permessi, elimina. */
export function Utenti() {
  const s = useS()
  const [r, setR] = useState<Riga[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const leggi = () => chiama<Riga[]>('utenti').then(setR, e => setErr((e as Error).message))
  useEffect(() => { leggi() }, [])
  const ruolo = async (email: string, ruolo: string) => { try { await chiama('utenti/' + encodeURIComponent(email), 'PUT', { ruolo }); leggi() } catch (e) { s.dici((e as Error).message) } }
  const [togliendo, setTogliendo] = useState<string | null>(null)
  if (err) return <p className="errore-campo">{err}</p>
  if (!r) return <p className="nota">Carico…</p>
  return (
    <div className="campi">
      <p className="nota">«Editor» può progettare e aggiornare i punti di interesse. «Amministratore» anche gestire gli utenti e i colori di base.</p>
      <ul className="elenco-utenti">{r.map(u => (
        <li key={u.email}>
          <span><b>{u.nome}</b><small>{u.email} · dal {new Date(u.creato).toLocaleDateString('it-IT')}</small></span>
          {u.email === s.utente?.email ? <small>tu</small> : <>
            <select value={u.ruolo} onChange={e => ruolo(u.email, e.target.value)} aria-label={'Ruolo di ' + u.nome}>
              <option value="attesa">In attesa</option><option value="editor">Editor</option><option value="admin">Amministratore</option>
            </select>
            {togliendo === u.email
              ? <button className="danger" onClick={async () => { try { await chiama('utenti/' + encodeURIComponent(u.email), 'DELETE'); setTogliendo(null); leggi() } catch (e) { s.dici((e as Error).message) } }}>Conferma</button>
              : <button className="quiet danger" onClick={() => setTogliendo(u.email)} aria-label={'Elimina ' + u.nome}>✕</button>}
          </>}
        </li>
      ))}</ul>
    </div>
  )
}

import { t, linguaAttuale } from '../i18n'
import { useEffect, useState, type FormEvent } from 'react'
import { useS, type Utente } from '../store'
import { Icona } from './Icona'
import type { NomeIcona } from './icone'
import { CATEGORIE, categoria, orariLeggibili } from '../engine/poi'
import { poiDa, ricaricaPoi } from '../scene/poi'
import { cerca } from '../scene/contesto'
import { elencoEventi, inCorso } from '../scene/eventi'
import { centraSu } from '../scene/gps'
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
  // eventi in corso: primo filtro, porta al primo e apre la scheda
  const ora = elencoEventi().filter(e => inCorso(e))
  return (
    <div className="servizi" role="toolbar" aria-label={t('Punti di interesse')}>
      {ora.length > 0 && <button className="chip evento-chip" onClick={() => { const e = ora[0]; centraSu([e.lon, e.lat]); s.set({ selEvento: e.id, selPoi: null, selGoogle: null }) }}><span className="chip-icona"><Icona n="celebration" /></span>{ora.length === 1 ? (s.lingua === 'en' && ora[0].titolo_en) || ora[0].titolo : `${ora.length} ${t('eventi in corso')}`}</button>}
      {lista.map(c => (
        <button key={c.k} className={'chip' + (on.has(c.k) ? ' acceso' : '')} aria-pressed={on.has(c.k)} onClick={() => cambia(c.k)}><span className="chip-icona" style={{ color: c.col }}><Icona n={c.s as NomeIcona} /></span>{t(c.nome)}</button>
      ))}
      <button className="chip quiet" onClick={() => setTutte(!tutte)}>{tutte ? t('Meno') : t('Altri…')}</button>
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
    const da = io && dentroPositano(io.p) ? { p: io.p, nome: 'La mia posizione' } : s.casa ?? s.percorso.da
    s.set({ strumento: { k: 'percorso' }, percorso: { da, a: { p: p.p, nome: p.n ?? c.nome }, scegli: da ? null : 'da' }, selPoi: null, pannello: null })
  }
  const x = p.x ?? {}
  return (
    <section className="scheda-poi" aria-label={p.n ?? c.nome}>
      <div className="pannello-testa">
        <h2><span className="icona-tonda" style={{ background: c.col }}><Icona n={c.s as NomeIcona} /></span>{p.n ?? t(c.nome)}</h2>
        <button className="tondo quiet" onClick={() => s.set({ selPoi: null })} aria-label={t('Chiudi')}><Icona n="close" /></button>
      </div>
      <p className="nota">{t(c.nome)}{p.nascosto ? ' · ' + t('nascosto ai visitatori') : ''}</p>
      {p.note && <p>{p.note}</p>}
      {x.opening_hours && <p>{t('Orari')}: {linguaAttuale() === 'it' ? orariLeggibili(x.opening_hours) : x.opening_hours}</p>}
      {x.fee && <p>{x.fee === 'yes' ? t('A pagamento') : x.fee === 'no' ? t('Gratuito') : x.fee}</p>}
      {x.wheelchair === 'yes' && <p>{t('Accessibile in sedia a rotelle')}</p>}
      {x.phone && <p><a href={'tel:' + x.phone.replace(/\s/g, '')}>{x.phone}</a></p>}
      <div className="riga-bottoni">
        <button className="primary" onClick={portami}><Icona n="directions" />{t('Portami qui')}</button>
        <button className="quiet" onClick={() => s.set({ vista360: { modo: 'punto', p: p.p, titolo: p.n ?? t(c.nome) } })}><Icona n="streetview" />Street View</button>
        <button className="quiet" onClick={() => condividi(p.n ?? c.nome, linkPunto({ id: p.id, p: p.p, nome: p.n }, true), s.dici)}><Icona n="share" />{t('Condividi')}</button>
        {puoModificare(s.utente) && s.inModifica && <button onClick={() => s.set({ pannello: 'poi' })}>{t('Modifica')}</button>}
      </div>
      <p className="nota">{p.fonte === 'osm' ? t('Dati © OpenStreetMap') : t('Aggiunto dal Comune')}</p>
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
        <select value={d.c} onChange={e => setD({ ...d, c: e.target.value })}>{CATEGORIE.map(c => <option key={c.k} value={c.k}>{c.nome}</option>)}</select>
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
        <p>{t('Hai fatto l\'accesso come')} <b>{u.nome}</b> ({u.email}).</p>
        <RigaCasa />
        {u.ruolo === 'attesa' && <p className="nota">{t('Il tuo account aspetta di essere abilitato dall\'amministratore. Intanto puoi usare la mappa come tutti.')}</p>}
        {puoModificare(u) && <label className="riga"><span>Modalità modifica<small>Progetti, disegno, edifici, punti di interesse</small></span><input type="checkbox" checked={s.inModifica} onChange={e => s.set({ inModifica: e.target.checked })} /></label>}
        {u.ruolo === 'admin' && <button onClick={() => s.set({ pannello: 'utenti' })}>Utenti e permessi</button>}
        <button className="quiet" onClick={async () => { try { await chiama('esci', 'POST') } catch { /* già fuori */ } s.set({ utente: null, inModifica: false, pannello: null }); s.dici(t('Sei uscito')) }}>{t('Esci')}</button>
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
      <RigaCasa />
      <p className="nota">{t('La mappa è aperta a tutti. L\'accesso serve a chi progetta e aggiorna i punti di interesse.')}</p>
      {modo === 'registrati' && <label>{t('Nome e cognome')}<input value={d.nome} autoComplete="name" onChange={e => setD({ ...d, nome: e.target.value })} required /></label>}
      <label>{t('Email')}<input type="email" value={d.email} autoComplete="email" onChange={e => setD({ ...d, email: e.target.value })} required /></label>
      <label>{t('Password')}<input type="password" value={d.password} autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'} minLength={modo === 'registrati' ? 8 : undefined} onChange={e => setD({ ...d, password: e.target.value })} required />{modo === 'registrati' && <small>{t('Almeno 8 caratteri')}</small>}</label>
      {err && <p className="errore-campo" role="alert">{err}</p>}
      <button className="primary" disabled={lavoro}>{modo === 'accedi' ? 'Accedi' : 'Registrati'}</button>
      <button type="button" className="quiet" onClick={() => { setModo(modo === 'accedi' ? 'registrati' : 'accedi'); setErr(null) }}>{modo === 'accedi' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}</button>
      {modo === 'registrati' && <p className="nota">{t('Dopo la registrazione l\'amministratore abilita il tuo account alla modifica.')}</p>}
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

/** Benvenuto per chi apre il sito: il punto «Casa» (dove alloggia), da posizione, mappa o ricerca. Diventa la partenza dei percorsi. */
export function SchedaCasa() {
  const s = useS()
  const [q, setQ] = useState('')
  const ris = q ? cerca(q) : []
  const fissa = (t: { p: [number, number]; nome?: string }) => s.set({ casa: { p: t.p, nome: t.nome || 'Casa' }, casaChiesta: true, scegliCasa: false })
  const posizione = () => {
    if (!navigator.geolocation) { s.dici(t('Questo dispositivo non dà la posizione')); return }
    navigator.geolocation.getCurrentPosition(
      g => { const p: [number, number] = [g.coords.longitude, g.coords.latitude]; if (!dentroPositano(p)) { s.dici(t('Sei fuori Positano: tocca la mappa o cerca un indirizzo')); return } fissa({ p, nome: 'Casa' }) },
      e => s.dici(e.code === e.PERMISSION_DENIED ? 'Posizione non permessa: tocca la mappa o cerca un indirizzo' : 'Posizione non disponibile adesso'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  if (s.scegliCasa) return (
    <div className="guida-strumento vetro"><b>{t('Casa')}</b><span>{t('Tocca la mappa dove alloggi')}</span><button className="quiet" onClick={() => s.set({ scegliCasa: false })}>{t('Annulla')}</button></div>
  )
  return (
    <section className="scheda-poi scheda-casa" aria-label={t('Il tuo punto Casa')}>
      <div className="pannello-testa">
        <h2><span className="icona-tonda" style={{ background: '#0b6bcb' }}><Icona n="home" /></span>{t('Dove alloggi?')}</h2>
        <button className="tondo quiet" onClick={() => s.set({ casaChiesta: true })} aria-label={t('Più tardi')}><Icona n="close" /></button>
      </div>
      <p className="nota">{t('Scegli il tuo punto Casa: i percorsi partiranno da lì e lo ritrovi con un tocco.')}</p>
      <div className="riga-bottoni">
        <button className="primary" onClick={posizione}><Icona n="my_location" />{t('Sono qui')}</button>
        <button onClick={() => s.set({ scegliCasa: true })}><Icona n="location_on" />{t('Tocca la mappa')}</button>
      </div>
      <div className="cerca" style={{ marginTop: 10 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Cerca hotel, via o luogo')} aria-label={t('Cerca il tuo alloggio')} />
        {ris.length > 0 && <ul className="risultati vetro">{ris.map(x => <li key={x.nome + x.tipo}><button onClick={() => fissa({ p: x.p, nome: x.nome })}><Icona n="location_on" /><span>{x.nome}</span><small>{x.tipo}</small></button></li>)}</ul>}
      </div>
    </section>
  )
}

/** Il punto Casa nel pannello dell'account: si cambia o si toglie. */
function RigaCasa() {
  const s = useS()
  return (
    <div className="riga-casa">
      <Icona n="home" /><span>{s.casa ? <>Casa: <b>{s.casa.nome && s.casa.nome !== 'Casa' ? s.casa.nome : 'punto scelto'}</b></> : 'Nessun punto Casa'}</span>
      <button type="button" className="quiet" onClick={() => s.set({ casaChiesta: false, casa: null, pannello: null })}>{s.casa ? 'Cambia' : 'Scegli'}</button>
    </div>
  )
}

/** Scheda di un luogo di Google trovato con la ricerca: nome, tipo, indirizzo, «Portami qui», «Apri in Google Maps». Niente si salva. */
export function SchedaGoogle() {
  const s = useS()
  const g = s.selGoogle
  if (!g) return null
  const portami = () => {
    const io = ultimaPosizione()
    const da = io && dentroPositano(io.p) ? { p: io.p, nome: 'La mia posizione' } : s.casa ?? s.percorso.da
    s.set({ strumento: { k: 'percorso' }, percorso: { da, a: { p: g.p, nome: g.nome }, scegli: da ? null : 'da' }, selGoogle: null, pannello: null })
  }
  return (
    <section className="scheda-poi" aria-label={g.nome}>
      <div className="pannello-testa">
        <h2><span className="icona-tonda" style={{ background: '#c5221f' }}><Icona n="location_on" /></span>{g.nome}</h2>
        <button className="tondo quiet" onClick={() => s.set({ selGoogle: null })} aria-label={t('Chiudi')}><Icona n="close" /></button>
      </div>
      {g.tipo && <p className="nota">{g.tipo}</p>}
      {g.indirizzo && <p>{g.indirizzo}</p>}
      <div className="riga-bottoni">
        <button className="primary" onClick={portami}><Icona n="directions" />{t('Portami qui')}</button>
        {g.url && <a className="bottone" href={g.url} target="_blank" rel="noopener"><Icona n="open_in_new" />{t('Orari e recensioni')}</a>}
        <button className="quiet" onClick={() => s.set({ vista360: { modo: 'punto', p: g.p, titolo: g.nome } })}><Icona n="streetview" />Street View</button>
        <button className="quiet" onClick={() => condividi(g.nome, linkPunto({ p: g.p, nome: g.nome }, false), s.dici)}><Icona n="share" />{t('Condividi')}</button>
      </div>
      <p className="nota attribuzione-google">{t('Dati di Google')}</p>
    </section>
  )
}

/** Condivide un punto: menu di condivisione del telefono, altrimenti copia il link. */
export async function condividi(titolo: string, url: string, dici: (t: string) => void) {
  try { if (navigator.share) { await navigator.share({ title: titolo, url }); return } } catch { return }
  try { await navigator.clipboard.writeText(url); dici(t('Link copiato')) } catch { dici(t('Copia non riuscita')) }
}
export const linkPunto = (x: { id?: string; p: [number, number]; nome?: string }, nostro: boolean) => {
  const u = new URL(location.origin + '/')
  if (nostro && x.id) u.searchParams.set('poi', x.id)
  else u.searchParams.set('punto', `${x.p[0].toFixed(6)},${x.p[1].toFixed(6)}${x.nome ? ',' + x.nome : ''}`)
  return u.toString()
}

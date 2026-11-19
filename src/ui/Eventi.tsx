import { portamiA } from './tappe'
import { useEffect, useState } from 'react'
import { useS } from '../store'
import { t, linguaAttuale } from '../i18n'
import { Icona } from './Icona'
import { chiama, condividi, linkPunto } from './Pubblico'
import { caricaEventi, elencoEventi, eventoDa, inCorso, type Evento } from '../scene/eventi'

const quando = (e: Evento) => {
  const l = linguaAttuale() === 'en' ? 'en-GB' : 'it-IT'
  const a = new Date(e.inizio), b = new Date(e.fine)
  const g = (d: Date) => d.toLocaleDateString(l, { weekday: 'short', day: 'numeric', month: 'short' })
  const o = (d: Date) => d.toLocaleTimeString(l, { hour: '2-digit', minute: '2-digit' })
  return g(a) === g(b) ? `${g(a)} · ${o(a)}–${o(b)}` : `${g(a)} ${o(a)} – ${g(b)} ${o(b)}`
}

/** Scheda di un evento per chi visita. */
export function SchedaEvento() {
  const s = useS()
  const e = s.selEvento ? eventoDa(s.selEvento) : undefined
  if (!e) return null
  const en = s.lingua === 'en'
  const titolo = (en && e.titolo_en) || e.titolo, descr = (en && e.descr_en) || e.descr
  const portami = () => portamiA({ p: [e.lon, e.lat], nome: titolo })
  return (
    <section className="scheda-poi" aria-label={titolo}>
      <div className="pannello-testa">
        <h2><span className="icona-tonda" style={{ background: '#e91e63' }}><Icona n="celebration" /></span>{titolo}</h2>
        <button className="tondo quiet" onClick={() => s.set({ selEvento: null })} aria-label={t('Chiudi')}><Icona n="close" /></button>
      </div>
      <p className="nota">{inCorso(e) ? t('In corso') + ' · ' : ''}{quando(e)}</p>
      {descr && <p>{descr}</p>}
      <div className="riga-bottoni">
        <button className="primary" onClick={portami}><Icona n="directions" />{t('Portami qui')}</button>
        {e.link && <a className="bottone" href={e.link} target="_blank" rel="noopener"><Icona n="open_in_new" />{t('Programma')}</a>}
        <button className="quiet" onClick={() => s.set({ vista360: { modo: 'punto', p: [e.lon, e.lat], titolo: titolo } })}><Icona n="streetview" />Street View</button>
        <button className="quiet" onClick={() => condividi(titolo, linkPunto({ p: [e.lon, e.lat], nome: titolo }, false), s.dici)}><Icona n="share" />{t('Condividi')}</button>
      </div>
    </section>
  )
}

const locale = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
/** Pannello per chi modifica: crea o cambia un evento (il punto si tocca sulla mappa) e vede quelli in programma. */
export function ModificaEvento() {
  const s = useS()
  const e = s.selEvento ? eventoDa(s.selEvento) : undefined
  const p = s.nuovoEvento ?? (e ? [e.lon, e.lat] as [number, number] : null)
  const vuoto = () => { const a = new Date(); a.setMinutes(0, 0, 0); a.setHours(a.getHours() + 1); const b = new Date(+a + 3 * 3600e3); return { titolo: '', titolo_en: '', descr: '', descr_en: '', inizio: locale(a.toISOString()), fine: locale(b.toISOString()), link: '' } }
  const [d, setD] = useState(vuoto)
  const [lavoro, setLavoro] = useState(false)
  useEffect(() => { setD(e ? { titolo: e.titolo, titolo_en: e.titolo_en ?? '', descr: e.descr ?? '', descr_en: e.descr_en ?? '', inizio: locale(e.inizio), fine: locale(e.fine), link: e.link ?? '' } : vuoto()) }, [s.selEvento])
  const salva = async () => {
    if (!p) return
    setLavoro(true)
    const id = e?.id ?? 'ev' + Math.random().toString(36).slice(2, 10)
    try {
      await chiama('eventi/' + id, 'PUT', { ...d, lon: p[0], lat: p[1], inizio: new Date(d.inizio).toISOString(), fine: new Date(d.fine).toISOString() })
      await caricaEventi(); s.set({ selEvento: id, nuovoEvento: null, googleGiro: s.googleGiro + 1 }); s.dici('Evento salvato: compare mentre è in corso')
    } catch (x) { s.dici((x as Error).message) } finally { setLavoro(false) }
  }
  const togli = async () => {
    if (!e) return
    setLavoro(true)
    try { await chiama('eventi/' + e.id, 'DELETE'); await caricaEventi(); s.set({ selEvento: null, googleGiro: s.googleGiro + 1 }); s.dici('Evento eliminato') }
    catch (x) { s.dici((x as Error).message) } finally { setLavoro(false) }
  }
  const prossimi = elencoEventi()
  return (
    <div className="campi">
      {!p ? <p className="nota">Tocca la mappa dove si svolge l'evento, o un evento per cambiarlo.</p> : <>
        <label>Titolo<input value={d.titolo} maxLength={100} placeholder="Es. Festa dell'Assunta" onChange={x => setD({ ...d, titolo: x.target.value })} /></label>
        <label>Titolo in inglese<input value={d.titolo_en} maxLength={100} onChange={x => setD({ ...d, titolo_en: x.target.value })} /></label>
        <div className="sposta">
          <label>Inizio<input type="datetime-local" value={d.inizio} onChange={x => setD({ ...d, inizio: x.target.value })} /></label>
          <label>Fine<input type="datetime-local" value={d.fine} onChange={x => setD({ ...d, fine: x.target.value })} /></label>
        </div>
        <label>Descrizione<textarea rows={3} maxLength={600} value={d.descr} onChange={x => setD({ ...d, descr: x.target.value })} /></label>
        <label>Descrizione in inglese<textarea rows={3} maxLength={600} value={d.descr_en} onChange={x => setD({ ...d, descr_en: x.target.value })} /></label>
        <label>Link al programma (facoltativo)<input value={d.link} placeholder="https://…" onChange={x => setD({ ...d, link: x.target.value })} /></label>
        <div className="riga-bottoni">
          <button className="primary" disabled={lavoro || !d.titolo.trim()} onClick={salva}>{e ? 'Salva' : 'Aggiungi'}</button>
          {e && <button className="danger" disabled={lavoro} onClick={togli}>Elimina</button>}
        </div>
      </>}
      {prossimi.length > 0 && <><h3>In programma</h3><ul className="elenco">{prossimi.map(x => (
        <li key={x.id}><button className={x.id === s.selEvento ? 'acceso' : ''} onClick={() => s.set({ selEvento: x.id, nuovoEvento: null })}>{x.titolo} <small>· {quando(x)}{inCorso(x) ? ' · in corso' : ''}</small></button></li>
      ))}</ul></>}
    </div>
  )
}

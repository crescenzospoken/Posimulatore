import { useRicerca } from './ricerca'
import { t as tr, linguaAttuale } from '../i18n'
import { useEffect, useRef, useState } from 'react'
import { lettera } from './tappe'
import QRCode from 'qrcode'
import { Icona } from './Icona'
import type { NomeIcona } from './icone'
import { elencoPoi } from '../scene/poi'
import { useS } from '../store'
import { confrontoMezzi, minutiTesto, tappaInLink, type Percorso, type Tappa } from '../engine/percorso'

const m = (x: number) => Math.round(x).toLocaleString(linguaAttuale() === 'en' ? 'en-GB' : 'it-IT')
const nomeDi = (t: Tappa | null) => t?.nome || (t ? `Punto ${t.p[1].toFixed(5)}, ${t.p[0].toFixed(5)}` : '')

export function linkPercorso(tappe: Tappa[]) {
  const u = new URL(location.origin + '/')
  if (tappe.length === 2) { u.searchParams.set('da', tappaInLink(tappe[0])); u.searchParams.set('a', tappaInLink(tappe[1])) }
  else if (tappe.length) u.searchParams.set('t', tappe.map(tappaInLink).join('|'))
  return u.toString()
}

/** Scheda del percorso a piedi da A a B. Dal link (ospite) mostra solo il percorso. */
const NOME_CRITERIO: Record<string, string> = { veloce: 'Più veloce', scale: 'Meno scale', salita: 'Meno salita' }
const ICONA_MEZZO: Record<string, NomeIcona> = { piedi: 'directions_walk', bus: 'directions_bus', auto: 'directions_car' }
const NOME_MEZZO: Record<string, string> = { piedi: 'A piedi', bus: 'Bus', auto: 'Auto' }
const fermate = () => elencoPoi().filter(p => p.c === 'fermate' && !p.nascosto).map(p => p.p)

export function SchedaPercorso({ calc, opzioni, scelta, scegli, esci }: { calc: Percorso | null; opzioni: Percorso[]; scelta: number; scegli: (i: number) => void; esci: () => void }) {
  const s = useS()
  const inizio = s.tappe[0] ?? null, fine = s.tappe.length > 1 ? s.tappe[s.tappe.length - 1] : null
  const [qr, setQr] = useState<string | null>(null)
  const [chiuso, setChiuso] = useState(false)
  const link = linkPercorso(s.tappe)
  useEffect(() => { setQr(null) }, [link])
  const faiQr = async () => {
    const c = document.createElement('canvas'), L = 1200
    c.width = L; c.height = L + 300
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    const q = document.createElement('canvas')
    await QRCode.toCanvas(q, link, { width: L - 160, margin: 0, errorCorrectionLevel: 'M' })
    g.drawImage(q, 80, 200)
    g.fillStyle = '#10243a'; g.textAlign = 'center'
    g.font = '600 64px system-ui, sans-serif'; g.fillText(fine?.nome ? `${tr('Come arrivare a')} ${fine.nome}` : tr('Come arrivare'), L / 2, 110, L - 80)
    g.font = '400 40px system-ui, sans-serif'; g.fillStyle = '#4a5b6c'
    if (calc) g.fillText(`${tr('A piedi')} ${minutiTesto(calc.minuti)} · ${m(calc.metri)} m${inizio?.nome ? ' · ' + inizio.nome : ''}`, L / 2, 170, L - 80)
    g.fillText(tr('Inquadra il codice: si apre la mappa 3D con il percorso'), L / 2, L + 210, L - 80)
    setQr(c.toDataURL('image/png'))
  }
  const copia = async () => { try { await navigator.clipboard.writeText(link); s.dici(tr('Link copiato')) } catch { s.dici(tr('Copia non riuscita: tieni premuto sul link')) } }
  // con meno di due tappe la scheda non serve: le tappe si scelgono in alto
  if (s.tappe.length < 2) return null
  if (chiuso) return <button className="scheda-percorso riapri" onClick={() => setChiuso(false)}>{calc ? `${minutiTesto(calc.minuti)} ${tr('a piedi')}` : tr('Percorso')}</button>
  return (
    <section className="scheda-percorso" aria-label={tr('Percorso a piedi')}>
      <div className="pannello-testa">
        <h2>{fine?.nome ?? tr('Percorso a piedi')}</h2>
        <button className="tondo quiet" onClick={() => (s.ospite ? setChiuso(true) : esci())} aria-label={tr(s.ospite ? 'Riduci' : 'Chiudi')}><Icona n="close" /></button>
      </div>
      {s.tappe.length >= 2 && (calc ? (
        <div className="esito">
          {opzioni.length > 1 && (
            <div className="alternative" role="tablist" aria-label={tr('Percorsi alternativi')}>
              {opzioni.map((o, i) => (
                <button key={i} role="tab" aria-selected={i === scelta} className={i === scelta ? 'acceso' : ''} onClick={() => scegli(i)}>
                  <b>{minutiTesto(o.minuti)}</b><small>{tr(NOME_CRITERIO[o.criterio ?? 'veloce'])}{o.gradini > 20 ? ` · ${m(Math.round(o.gradini / 10) * 10)} ${tr('gradini')}` : ' · ' + tr('senza scale')}</small>
                </button>
              ))}
            </div>
          )}
          <button className="quiet" onClick={() => s.set({ vista360: { modo: 'percorso', pts: calc.pts.map(p => [p[0], p[1]] as [number, number]), titolo: s.tappe[s.tappe.length - 1]?.nome } })}><Icona n="streetview" />{tr('Guarda il percorso')}</button>
          <div className="cifre">
            <span><Icona n="schedule" /><b>{minutiTesto(calc.minuti)}</b><small>{tr('ritorno')} {minutiTesto(calc.ritorno)}</small></span>
            <span><Icona n="route" /><b>{m(calc.metri)} m</b><small>{tr('a piedi')}</small></span>
            <span><Icona n="stairs" /><b>{calc.gradini > 20 ? '~' + m(Math.round(calc.gradini / 10) * 10) : '0'}</b><small>{tr('gradini')}</small></span>
            <span><Icona n="trending_up" /><b>{m(calc.salita)} m</b><small>{tr('salita')} · {m(calc.discesa)} m {tr('discesa')}</small></span>
          </div>
          {(() => { const mz = s.tappe.length === 2 ? confrontoMezzi(calc, fermate(), s.tappe[0].p, s.tappe[s.tappe.length - 1].p) : []; return mz.length > 1 && (
            <>
              <h3>{tr('Come conviene')}</h3>
              <ul className="mezzi">{mz.map((x, i) => <li key={x.k} className={i === 0 ? 'migliore' : ''}><Icona n={ICONA_MEZZO[x.k]} /><span><b>{tr(NOME_MEZZO[x.k])} · {minutiTesto(x.minuti)}</b><small>{x.k === 'piedi' ? `${m(calc.metri)} m, ${calc.gradini > 20 ? tr('circa') + ' ' + m(Math.round(calc.gradini / 10) * 10) + ' ' + tr('gradini') : tr('quasi senza scale')}` : tr(x.nota)}</small></span>{i === 0 && <em>{tr('consigliato')}</em>}</li>)}</ul>
            </>
          ) })()}
          {calc.tratti.length > 0 && (
            <>
              <h3>{tr('Indicazioni')}</h3>
              <ol className="indicazioni">{calc.tratti.filter(t => t.metri >= 15).map((t, i) => (
                <li key={i}><Icona n={t.tipo === 'scale' ? 'stairs' : t.tipo === 'sentiero' ? 'directions_walk' : 'route'} />
                  <span><b>{t.nome || tr(t.tipo === 'scale' ? 'Scale' : t.tipo === 'vicolo' ? 'Vicolo' : t.tipo === 'sentiero' ? 'Sentiero' : 'Strada')}</b>
                  <small>{m(t.metri)} m{t.gradini > 15 ? ` · ~${m(Math.round(t.gradini / 10) * 10)} ${tr('gradini')}` : ''}{t.su > 4 ? ` · ${tr('sale')} ${m(t.su)} m` : ''}{t.giu > 4 ? ` · ${tr('scende')} ${m(t.giu)} m` : ''}</small></span></li>
              ))}</ol>
            </>
          )}
          <p className="nota">{tr('Stime nostre: passo tranquillo con salite e scale (regola DIN 33466 sulle quote LiDAR), gradini stimati in 16 cm l\'uno. Bus e auto sono indicativi. Col censimento delle scale diventeranno misure vere.')}</p>
        </div>
      ) : <p className="nota">{tr('Nessun percorso trovato: scegli punti vicino a una via o a una scala.')}</p>)}
      {!s.ospite && s.tappe.length >= 2 && (
        <div className="condividi">
          <h3>{tr('Link e QR')}</h3>
          <p className="nota">{tr('Chi lo apre vede solo questo percorso. Dai un nome alla partenza e all\'arrivo: compare sul cartello.')}</p>
          <div className="riga-bottoni"><button onClick={copia}>{tr('Copia link')}</button><button className="primary" onClick={faiQr}>{tr('Crea QR da stampare')}</button></div>
          {qr && <><img className="qr" src={qr} alt={`QR del percorso verso ${nomeDi(fine)}`} /><a className="bottone" href={qr} download={`percorso-${(fine?.nome || 'arrivo').replace(/\W+/g, '-').toLowerCase()}.png`}>{tr('Scarica l\'immagine')}</a></>}
        </div>
      )}
    </section>
  )
}

/** Le tappe del percorso, in alto al posto della ricerca: si aggiungono (ricerca, mappa, posizione, Casa), si tolgono e si spostano trascinandole. */
export function BarraTappe({ esci }: { esci: () => void }) {
  const s = useS()
  const tappe = s.tappe
  const [q, setQ] = useState('')
  const [modifica, setModifica] = useState(!s.ospite)
  // con il percorso pronto la barra si riduce a una riga, così sul telefono resta spazio per la mappa
  const [aperta, setAperta] = useState(tappe.length < 2)
  // appena ci sono partenza e arrivo la barra si chiude da sola e si vedono mappa e risultati
  const primaN = useRef(tappe.length)
  useEffect(() => {
    if (tappe.length < 2) setAperta(true)
    else if (primaN.current < 2) { setAperta(false); s.set({ aggiungiDaMappa: false }) }
    primaN.current = tappe.length
  }, [tappe.length])
  // sul telefono, mentre si cambiano le tappe, la scheda dei risultati si toglie di mezzo (classi sul body, vedi styles.css)
  const inModificaTappe = modifica && (aperta || tappe.length < 2)
  useEffect(() => {
    document.body.classList.toggle('tappe-aperte', inModificaTappe)
    document.body.classList.toggle('scegli-mappa', inModificaTappe && s.aggiungiDaMappa)
    return () => { document.body.classList.remove('tappe-aperte', 'scegli-mappa') }
  }, [inModificaTappe, s.aggiungiDaMappa])
  const [trascina, setTrascina] = useState<{ da: number; a: number } | null>(null)
  const righe = useRef<(HTMLLIElement | null)[]>([])
  const { nostri, google } = useRicerca(q)
  const metti = (x: Tappa[]) => s.set({ tappe: x })
  // due volte di fila lo stesso posto non serve
  const aggiungi = (x: Tappa) => { const u = tappe.at(-1); if (!u || u.p[0] !== x.p[0] || u.p[1] !== x.p[1]) metti([...tappe, x]); setQ('') }
  const posizione = () => {
    if (!navigator.geolocation) { s.dici(tr('Questo telefono non dà la posizione')); return }
    navigator.geolocation.getCurrentPosition(
      g => { const p: [number, number] = [g.coords.longitude, g.coords.latitude]; if (Math.abs(p[0] - 14.49) > 0.05 || Math.abs(p[1] - 40.625) > 0.04) { s.dici(tr('Sei fuori Positano: scegli la partenza sulla mappa')); return } metti([{ p, nome: tr('La mia posizione') }, ...tappe]) },
      () => s.dici(tr('Posizione non disponibile: scegli la partenza sulla mappa')), { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  // trascinamento: si prende la maniglia, la riga si sposta dove si lascia
  const inizia = (e: React.PointerEvent, i: number) => {
    e.preventDefault(); (e.target as HTMLElement).setPointerCapture(e.pointerId)
    setTrascina({ da: i, a: i })
  }
  const muovi = (e: React.PointerEvent) => {
    if (!trascina) return
    const y = e.clientY
    let a = righe.current.findIndex(r => r && y < r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2)
    if (a < 0) a = tappe.length - 1
    if (a !== trascina.a) setTrascina({ ...trascina, a })
  }
  const lascia = () => {
    if (!trascina) return
    const x = [...tappe], [v] = x.splice(trascina.da, 1); x.splice(trascina.a, 0, v); metti(x); setTrascina(null)
  }
  const ordine = trascina ? (() => { const x = tappe.map((_, i) => i), [v] = x.splice(trascina.da, 1); x.splice(trascina.a, 0, v); return x })() : tappe.map((_, i) => i)
  if (!aperta && tappe.length >= 2) return (
    <button className="barra-tappe vetro riassunto" onClick={() => { setAperta(true); setModifica(true) }} aria-label={tr('Cambia le tappe')}>
      <span className="lettera a">A</span><span className="nome">{nomeDi(tappe[0])}</span>
      <span className="freccia">→</span>
      <span className="lettera b">{lettera(tappe.length - 1)}</span><span className="nome">{nomeDi(tappe[tappe.length - 1])}</span>
      {tappe.length > 2 && <small>{tappe.length} {tr('tappe')}</small>}
      <Icona n="edit" />
    </button>
  )
  return (
    <div className="barra-tappe vetro">
      <ol className="tappe" onPointerMove={muovi} onPointerUp={lascia} onPointerCancel={lascia}>
        {ordine.map((k, pos) => { const x = tappe[k]; return (
          <li key={k + ':' + x.p.join()} ref={el => { righe.current[pos] = el }} className={trascina?.da === k ? 'presa' : ''}>
            <span className={'lettera' + (pos === 0 ? ' a' : pos === tappe.length - 1 ? ' b' : '')}>{lettera(pos)}</span>
            <span className="nome">{nomeDi(x)}</span>
            {modifica && tappe.length > 1 && <span className="maniglia" onPointerDown={e => inizia(e, k)} aria-label={tr('Trascina per spostare')} data-tip={tr('Trascina per spostare')}><Icona n="drag_indicator" /></span>}
            {modifica && <button className="tondo quiet" onClick={() => metti(tappe.filter((_, j) => j !== k))} aria-label={tr('Togli la tappa')}><Icona n="close" /></button>}
          </li>
        ) })}
      </ol>
      {modifica ? <>
        <div className="cerca riga-aggiungi">
          <span className={'lettera piccola'}>{lettera(tappe.length)}</span>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus={tappe.length > 0 && tappe.length < 2} placeholder={tr(tappe.length === 0 ? 'Da dove parti?' : tappe.length === 1 ? 'Dove vuoi andare?' : 'Aggiungi una tappa')} aria-label={tr('Aggiungi una tappa')} />
        </div>
        {(nostri.length > 0 || google.length > 0) && <ul className="risultati vetro">
          {nostri.map(x => <li key={x.nome + x.tipo + (x.poi ?? '')}><button onClick={() => aggiungi({ p: x.p, nome: x.nome })}><Icona n={x.poi ? 'location_on' : x.tipo === 'strada' ? 'route' : 'map'} /><span>{x.nome}</span><small>{tr(x.tipo)}</small></button></li>)}
          {google.length > 0 && <li className="titoletto">{tr('Da Google Maps')}</li>}
          {google.map(g => <li key={'g' + g.id}><button onClick={() => aggiungi({ p: g.p, nome: g.nome })}><Icona n="location_on" /><span>{g.nome}</span><small>{g.tipo ?? g.indirizzo}</small></button></li>)}
          {google.length > 0 && <li className="attribuzione-google">{tr('Risultati di Google')}</li>}
        </ul>}
        <div className="riga-bottoni">
          <button className={'quiet' + (s.aggiungiDaMappa ? ' acceso' : '')} aria-pressed={s.aggiungiDaMappa} onClick={() => s.set({ aggiungiDaMappa: !s.aggiungiDaMappa })}><Icona n="location_on" />{tr('Sulla mappa')}</button>
          {!tappe.some(x => x.nome === tr('La mia posizione')) && <button className="quiet" onClick={posizione} data-tip={tr('Parti da dove sei adesso')}><Icona n="my_location" />{tr('Da qui')}</button>}
          {s.casa && <button className="quiet" onClick={() => aggiungi(s.casa!)}><Icona n="home" />{tr('Casa')}</button>}
          {tappe.length === 2 && <button className="quiet" onClick={() => metti([tappe[1], tappe[0]])} data-tip={tr('Scambia partenza e arrivo')}><Icona n="swap_vert" />{tr('Inverti')}</button>}
          {tappe.length >= 2 && <button className="quiet" onClick={() => setAperta(false)}><Icona n="expand_less" />{tr('Fatto')}</button>}
          <button className="quiet chiudi" onClick={esci}><Icona n="close" />{tr('Chiudi')}</button>
        </div>
        {s.aggiungiDaMappa && <p className="nota">{tr('Tocca la mappa per aggiungere una tappa.')}</p>}
      </> : <button className="quiet" onClick={() => setModifica(true)}>{tr('Cambia le tappe')}</button>}
    </div>
  )
}

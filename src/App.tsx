import { useEffect, useMemo, useRef, useState } from 'react'
import { Cartesian3 } from 'cesium'
import { useS, type Utente } from './store'
import { impostaQualita, impostaNitidezza, quandoGoogle, quandoGoogleKo, googleAcceso, creaViewer, vistaTotale, impostaGoogle, impostaOrto, impostaSole, vai, vistaCorrente, foto, VAI, viewer } from './scene/viewer'
import { caricaEdifici, disegnaEdifici, disegnaCupole, mostraCupole } from './scene/edifici'
import { caricaContesto, mostraContesto, cerca, reteVie } from './scene/contesto'
import { pos } from './scene/viewer'
import { disegnaPercorso, inquadraPercorso } from './scene/percorso'
import { alternative, cammino, tappaDaLink } from './engine/percorso'
import { SchedaPercorso } from './ui/Percorso'
import { Servizi, SchedaPoi, SchedaCasa, chiama, puoModificare } from './ui/Pubblico'
import { avviaSovrapposti, impostaVoci } from './scene/sovrapposti'
import { caricaPoi, disegnaPoi, rifaiPoi, elencoPoi } from './scene/poi'
import { avviaGps, centraSu, dentroPositano, gpsAcceso, fermaGps, ultimaPosizione } from './scene/gps'
import { categoria } from './engine/poi'
import { avviaOggetti, disegnaOggetti, calcoli, quoteCambiate } from './scene/oggetti'
import { avviaInterazione, disegnaMisure, quotaBozza, type Punto } from './scene/interazione'
import { avviaCammina, fermaCammina, tasti } from './scene/cammina'
import { quota } from './scene/oggetti'
import { GRUPPI } from './ui/strumenti'
import { Icona } from './ui/Icona'
import { Pannello } from './ui/Pannello'
import { Suggerimenti } from './ui/Suggerimenti'
import type { Obj } from './engine/model'
import { trasla } from './engine/modifica'

const st0 = (k: string) => k === 'percorso'
/** Cerca fra punti di interesse (per nome o categoria), vie e luoghi. */
function cercaTutto(q: string) {
  const t = q.trim().toLowerCase()
  if (t.length < 2) return []
  const poi = elencoPoi().filter(p => !p.nascosto && ((p.n ?? '').toLowerCase().includes(t) || categoria(p.c).nome.toLowerCase().includes(t)))
    .slice(0, 6).map(p => ({ nome: p.n ?? categoria(p.c).nome, tipo: categoria(p.c).nome, p: p.p, z: undefined as number | undefined, poi: p.id }))
  return [...poi, ...cerca(q).map(r => ({ ...r, poi: undefined as string | undefined }))].slice(0, 12)
}
export default function App() {
  const el = useRef<HTMLDivElement>(null)
  const [pronto, setPronto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  // la posizione sotto il cursore va scritta direttamente nella barra: passare da React ridisegnerebbe tutta l'interfaccia a ogni movimento
  const barra = useRef<HTMLSpanElement>(null)
  const setCur = (cur: Punto | null) => { const b = barra.current; if (b) b.textContent = cur ? `${cur.p[1].toFixed(5)}, ${cur.p[0].toFixed(5)} · ${cur.z.toFixed(1).replace('.', ',')} m s.l.m.` : 'Positano' }
  const [aperto, setAperto] = useState<string | null>(null)
  const [gps, setGps] = useState(false)
  /** Rimette la vista: sul percorso se ce n'è uno, sulla tua posizione se il GPS è acceso, altrimenti tutta Positano. */
  const rimettiVista = () => {
    const st = useS.getState(), io = ultimaPosizione()
    if (st.strumento.k === 'percorso' && calcRef.current) inquadraPercorso(calcRef.current)
    else if (gpsAcceso() && io && dentroPositano(io.p)) centraSu(io.p)
    else vistaTotale()
  }
  const dove = () => {
    if (gpsAcceso()) { fermaGps(); setGps(false); return }
    let primo = true
    setGps(true)
    avviaGps(p => {
      if (!primo) return
      primo = false
      if (dentroPositano(p.p)) centraSu(p.p); else useS.getState().dici('Sei fuori Positano: il pallino blu compare quando arrivi')
    }, t => { setGps(false); useS.getState().dici(t) })
  }
  const [q, setQ] = useState('')
  const [cercaAperta, setCercaAperta] = useState(false)
  const s = useS()
  const op = s.opzione()

  useEffect(() => {
    let stop: (() => void) | undefined
    ;(async () => {
      try {
        try { const c = await (await fetch('/config')).json(); if (c.ionToken || c.googleKey) useS.setState(st => ({ ionTokenSito: c.ionToken ?? '', googleKey: c.googleKey ?? '', livelli: { ...st.livelli, google: st.livelli.googleScelto ?? true } })) } catch { /* sviluppo senza Worker */ }
        await creaViewer(el.current!)
        avviaSovrapposti(el.current!)
        impostaOrto(useS.getState().livelli.orto)
        // chi sono, colori di base per tutti: dal server (senza server si va avanti da visitatore)
        chiama<Utente | null>('io').then(u => useS.setState(st => ({ utente: u, inModifica: st.inModifica && puoModificare(u) })), () => {})
        chiama<{ coloriVie?: Record<string, string> }>('impostazioni').then(i => useS.setState({ coloriBase: i.coloriVie ?? {} }), () => {})
        await Promise.all([caricaContesto(), avviaOggetti(), caricaPoi()])
        // gli edifici OSM (1 MB) servono solo se accesi o per controllare cosa c'è sotto una piazza: si caricano dopo
        setTimeout(() => caricaEdifici().then(() => useS.setState(st => ({ googleGiro: st.googleGiro + 1 }))), 4000)
        disegnaCupole(viewer)
        let tG: ReturnType<typeof setTimeout> | undefined
        // Google finisce di caricare dopo ogni movimento: ricalcolare tutti gli oggetti ogni volta bloccava la pagina.
        // Si ricalcola solo quando la vista si è spostata davvero (oltre 80 m) e al massimo ogni 3 secondi.
        let ultimaPos: Cartesian3 | null = null, ultimaVolta = 0
        quandoGoogle(() => { clearTimeout(tG); tG = setTimeout(() => {
          const ora = viewer.camera.positionWC, t = performance.now()
          if (ultimaPos && Cartesian3.distance(ora, ultimaPos) < 80) return
          if (t - ultimaVolta < 3000) return
          ultimaPos = Cartesian3.clone(ora); ultimaVolta = t
          quoteCambiate(); rifaiPoi(); useS.setState(st => ({ googleGiro: st.googleGiro + 1 }))
        }, 1200) })
        quandoGoogleKo(() => useS.getState().dici('Google 3D non risponde: per ora vedi il satellite'))
        stop = avviaInterazione(setCur, finisci)
        // link o QR con il percorso: ?da=lon,lat,Nome&a=lon,lat,Nome
        const u = new URLSearchParams(location.search), da = tappaDaLink(u.get('da')), a = tappaDaLink(u.get('a'))
        if (a || da) useS.setState(st => ({ percorso: { da: da ?? st.percorso.da, a, scegli: da && a ? null : da ? 'a' : 'da' }, strumento: { k: 'percorso' }, ospite: Boolean(a), pannello: null }))
        // all'apertura la vista di tutta Positano; chi progetta riparte dalla vista salvata nel progetto
        const st0x = useS.getState(), v = st0x.inModifica && puoModificare(st0x.utente) && st0x.progetto().vista
        if (!a) { if (v) vai(v, 0); else vistaTotale(0) }
        setPronto(true)
        ;(window as unknown as { __pronto: boolean }).__pronto = true
      } catch (e) {
        console.error(e)
        setErrore(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => stop?.()
  }, [])

  // modifica = account abilitato e modalità accesa; altrimenti la mappa è quella pubblica
  const mod = s.inModifica && puoModificare(s.utente)
  // scena <- stato
  useEffect(() => { if (pronto) disegnaOggetti(op.oggetti, s.sel, s.vSel, s.livelli.progetto && mod) }, [pronto, op, s.sel, s.vSel, s.googleGiro, s.livelli.progetto, mod])
  useEffect(() => { if (pronto) disegnaPoi(new Set(s.ospite ? [] : s.poiCat), s.selPoi, mod) }, [pronto, s.poiCat, s.selPoi, mod, s.googleGiro, s.ospite])
  useEffect(() => { if (pronto && !mod && s.strumento.k !== 'naviga' && s.strumento.k !== 'percorso') s.set({ strumento: { k: 'naviga' }, bozza: [] }) }, [pronto, mod])
  useEffect(() => { if (pronto) disegnaEdifici(mod && s.livelli.edifici && !s.livelli.google, op.edifici, s.selEdificio, (s.sel && calcoli.get(s.sel)?.interferenze) || [], s.livelli.stile !== 'facciate') }, [pronto, op, s.sel, s.selEdificio, s.livelli.edifici, s.livelli.google, s.livelli.stile])
  useEffect(() => { if (pronto) { impostaOrto(s.livelli.orto); mostraContesto(s.livelli.strade, s.livelli.nomi, s.livelli.confine && !s.ospite, s.livelli.google, { ...s.coloriBase, ...s.livelli.coloriVie }); mostraCupole(mod && !s.livelli.google && s.livelli.edifici); impostaSole(s.livelli); impostaNitidezza(s.livelli.nitido); impostaQualita(s.livelli.qualita) } }, [pronto, s.livelli, s.ospite, s.coloriBase, mod])
  useEffect(() => { if (pronto) disegnaMisure(s.misure) }, [pronto, s.misure])
  // percorso a piedi
  const inPercorso = st0(s.strumento.k)
  const { da, a } = s.percorso
  const calcRef = useRef<ReturnType<typeof cammino>>(null)
  // il più veloce più le alternative (meno scale, meno salita); se ne sceglie una dalla scheda
  const [scelta, setScelta] = useState(0)
  const opzioni = useMemo(() => (pronto && inPercorso && da && a ? alternative(reteVie(), da.p, a.p) : []), [pronto, inPercorso, da?.p[0], da?.p[1], a?.p[0], a?.p[1]])
  useEffect(() => setScelta(0), [opzioni])
  const calc = opzioni[Math.min(scelta, opzioni.length - 1)] ?? null
  useEffect(() => { if (pronto) disegnaPercorso(inPercorso ? calc : null, inPercorso ? da : null, inPercorso ? a : null) }, [pronto, inPercorso, calc, da?.nome, a?.nome, s.livelli.google, s.googleGiro])
  useEffect(() => { calcRef.current = calc; if (calc) inquadraPercorso(calc) }, [calc])
  // il punto Casa sulla mappa (toccandolo: percorso da Casa)
  useEffect(() => {
    if (!pronto) return
    const c = s.casa
    impostaVoci('casa', c && !s.ospite ? [{ id: 'casa', tipo: 'tappa', pos: pos(c.p[0], c.p[1], quota(c.p[0], c.p[1]) + 3), testo: c.nome && c.nome !== 'Casa' ? 'Casa · ' + c.nome : 'Casa', icona: 'home', col: '#0b6bcb', scelto: true, maxDist: 1e9,
      clic: () => useS.setState(st => ({ strumento: { k: 'percorso' }, percorso: { ...st.percorso, da: c, scegli: st.percorso.a ? null : 'a' }, selPoi: null, pannello: null })) }] : [])
  }, [pronto, s.casa?.p[0], s.casa?.p[1], s.casa?.nome, s.ospite, s.googleGiro])
  useEffect(() => { document.title = s.ospite && a?.nome ? `Come arrivare a ${a.nome} · Posimulatore` : 'Posimulatore' }, [s.ospite, a?.nome])
  useEffect(() => {
    if (!pronto) return
    impostaGoogle(s.livelli.google, s.ionToken || s.ionTokenSito, s.googleKey).then(err => { if (err) { s.dici(err); s.setLivelli({ google: false }) } else disegnaOggetti(op.oggetti, s.sel) })
  }, [pronto, s.livelli.google, s.ionToken, s.ionTokenSito, s.googleKey])
  useEffect(() => { if (pronto) { if (s.strumento.k === 'cammina') avviaCammina(); else fermaCammina() } }, [pronto, s.strumento.k])

  // tastiera
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      const st = useS.getState()
      if (e.key === 'Escape') { if (st.strumento.k !== 'naviga') st.set({ strumento: { k: 'naviga' }, bozza: [] }); else st.set({ sel: null, selEdificio: null, info: null }); setAperto(null) }
      else if (e.key === 'Enter' && st.strumento.k === 'disegna') finisci()
      else if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel) st.togli(st.sel)
      else if (e.key.startsWith('Arrow') && st.sel && st.strumento.k === 'naviga') {
        // frecce: spostano l'oggetto scelto (o il punto scelto) di un passo; con Maiusc di dieci passi
        e.preventDefault()
        const k = (st.passo || 0.1) * (e.shiftKey ? 10 : 1)
        const de = e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0, dn = e.key === 'ArrowUp' ? k : e.key === 'ArrowDown' ? -k : 0
        st.aggiorna(st.sel, o => {
          if (st.vSel !== null && o.pts[st.vSel]) { const tutti = trasla([o.pts[st.vSel]], de, dn); o.pts[st.vSel] = tutti[0] }
          else o.pts = trasla(o.pts, de, dn)
        })
      }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) st.ripeti(); else st.annulla() }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); st.ripeti() }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  const risultati = q ? cercaTutto(q) : []
  const st = s.strumento
  return (
    <div className={'app' + (s.ospite ? ' ospite' : '') + (mod ? ' in-modifica' : ' pubblico')}>
      <div ref={el} className="scena" />
      {!pronto && !errore && <div className="caricamento">Preparo Positano in 3D…</div>}
      {errore && <div className="caricamento errore">Il 3D non parte su questo dispositivo: {errore}</div>}

      <header className={'cima' + (cercaAperta ? ' cerca-aperta' : '')}>
        <div className="ricerca vetro">
          <Icona n="search" className="lente" />
          <input value={q} onChange={e => setQ(e.target.value)} onFocus={() => setCercaAperta(true)} onBlur={() => setTimeout(() => setCercaAperta(false), 150)} placeholder="Cerca a Positano" aria-label="Cerca vie, luoghi e servizi" />
          {q && <button className="tondo quiet" onClick={() => setQ('')} aria-label="Cancella la ricerca"><Icona n="close" /></button>}
          <button className={'avatar' + (s.utente ? ' con-utente' : '')} onClick={() => s.set({ pannello: s.pannello === 'accesso' ? null : 'accesso' })} aria-label={s.utente ? 'Il tuo account' : 'Accedi'} data-tip={s.utente ? s.utente.nome : 'Accedi per progettare e aggiornare la mappa'}>
            {s.utente ? s.utente.nome.trim()[0]?.toUpperCase() : <Icona n="person" />}
          </button>
          {(risultati.length > 0 || (cercaAperta && !q)) && <ul className="risultati vetro">
            {risultati.length > 0 ? risultati.map(r => (
              <li key={r.nome + r.tipo + (r.poi ?? '')}><button onMouseDown={e => e.preventDefault()} onClick={() => { const z = r.z ?? quota(r.p[0], r.p[1]); vai({ lon: r.p[0], lat: r.p[1] - 0.0012, h: z + 110, heading: 0, pitch: -40 }); setQ(''); setCercaAperta(false); if (r.poi) { const c = elencoPoi().find(x => x.id === r.poi)!.c; s.set({ selPoi: r.poi, poiCat: s.poiCat.includes(c) ? s.poiCat : [...s.poiCat, c] }) } }}><Icona n={r.poi ? 'location_on' : r.tipo === 'strada' ? 'route' : 'map'} /><span>{r.nome}</span><small>{r.tipo}</small></button></li>
            )) : <>
              {s.casa && <li><button onMouseDown={e => e.preventDefault()} onClick={() => { centraSu(s.casa!.p); setCercaAperta(false); (document.activeElement as HTMLElement)?.blur() }}><Icona n="home" /><span>Casa{s.casa.nome && s.casa.nome !== 'Casa' ? ' · ' + s.casa.nome : ''}</span></button></li>}
              <li className="titoletto">Vai a</li>
              {VAI.map(v => <li key={v.nome}><button onMouseDown={e => e.preventDefault()} onClick={() => { vai(v); setCercaAperta(false); (document.activeElement as HTMLElement)?.blur() }}><Icona n="near_me" /><span>{v.nome}</span></button></li>)}
            </>}
          </ul>}
        </div>
        {mod && (
          <div className="barra-modifica vetro">
            <button className="quiet progetto-nome" onClick={() => s.set({ pannello: 'progetto' })} data-tip="Progetti e opzioni">{s.progetto().nome} · {op.nome}</button>
            <button className="tondo quiet" disabled={!s.passato.length} onClick={s.annulla} data-tip="Annulla (Ctrl+Z)" aria-label="Annulla"><Icona n="undo" /></button>
            <button className="tondo quiet" disabled={!s.futuro.length} onClick={s.ripeti} data-tip="Ripeti (Ctrl+Y)" aria-label="Ripeti"><Icona n="redo" /></button>
            <button className="tondo quiet solo-desktop" onClick={() => { s.salvaVista(vistaCorrente()); s.dici('Vista salvata nel progetto') }} data-tip="Salva questa vista come partenza del progetto" aria-label="Salva vista"><Icona n="push_pin" /></button>
            <button className="tondo quiet solo-desktop" onClick={() => foto(s.progetto().nome)} data-tip="Scarica la vista come immagine ad alta risoluzione" aria-label="Foto"><Icona n="photo_camera" /></button>
            <button className={'quiet' + (s.livelli.progetto ? '' : ' acceso')} onClick={() => s.setLivelli({ progetto: !s.livelli.progetto })} aria-pressed={!s.livelli.progetto} data-tip={s.livelli.progetto ? 'Nascondi il progetto e guarda Positano com\'è oggi' : 'Mostra di nuovo il progetto'}>{s.livelli.progetto ? 'Com\'è oggi' : 'Progetto'}</button>
          </div>
        )}
        {!s.ospite && <Servizi />}
      </header>

      {/* pulsanti tondi in basso a destra, come sulle mappe del telefono */}
      {!s.ospite && (
        <div className="fab">
          <button className={'fab-piccolo vetro' + (s.pannello === 'aiuto' ? ' acceso' : '')} onClick={() => s.set({ pannello: s.pannello === 'aiuto' ? null : 'aiuto' })} aria-label="Guida" data-tip="Guida e fonti dei dati"><Icona n="help" /></button>
          <button className={'fab-piccolo vetro' + (s.pannello === 'livelli' ? ' acceso' : '')} onClick={() => s.set({ pannello: s.pannello === 'livelli' ? null : 'livelli' })} aria-label="Livelli" data-tip="Mappa, Google 3D, colori delle vie, qualità"><Icona n="layers" /></button>
          <button className="fab-piccolo vetro" onClick={rimettiVista} aria-label="Rimetti la vista" data-tip="Rimetti la vista: sul percorso, sulla tua posizione o su tutta Positano"><Icona n="zoom_out_map" /></button>
          <button className={'fab-piccolo vetro' + (gps ? ' acceso' : '')} aria-pressed={gps} onClick={dove} aria-label="Dove sono" data-tip="Mostra dove sei (GPS)"><Icona n="my_location" /></button>
          <button className={'fab-grande' + (st.k === 'percorso' ? ' acceso' : '')} onClick={() => s.set({ strumento: st.k === 'percorso' ? { k: 'naviga' } : { k: 'percorso' }, percorso: { ...s.percorso, da: s.percorso.da ?? s.casa, scegli: (s.percorso.da ?? s.casa) ? (s.percorso.a ? null : 'a') : 'da' }, selPoi: null, pannello: null })} aria-label="Percorso a piedi" data-tip="Da un punto a un altro a piedi, con salite e scale"><Icona n="directions" /><span>Percorso</span></button>
        </div>
      )}

      {mod && <nav className="strumenti" aria-label="Strumenti">
        <button className={st.k === 'naviga' ? 'acceso' : ''} onClick={() => { s.set({ strumento: { k: 'naviga' }, bozza: [] }); setAperto(null) }} data-tip="Muovi la vista, tocca per scegliere e trascina per spostare"><Icona n="pan_tool" />Naviga</button>
        {GRUPPI.map(g => (
          <div key={g.id} className="gruppo">
            <button className={aperto === g.id || (st.k !== 'naviga' && st.k !== 'cammina' && g.voci.some(v => JSON.stringify(v.s) === JSON.stringify(st))) ? 'acceso' : ''} onClick={() => setAperto(aperto === g.id ? null : g.id)}><Icona n={g.icona} />{g.nome}</button>
            {aperto === g.id && <div className="menu">{g.voci.map(v => (
              <button key={v.nome} onClick={() => { s.set({ strumento: v.s, bozza: [], sel: null, selEdificio: null }); setAperto(null) }}>{v.nome}</button>
            ))}{g.id === 'misura' && s.misure.length > 0 && <button className="danger" onClick={() => { s.set({ misure: [] }); setAperto(null) }}>Cancella le misure</button>}</div>}
          </div>
        ))}
        <button className={s.pannello === 'catalogo' ? 'acceso' : ''} onClick={() => { s.set({ pannello: s.pannello === 'catalogo' ? null : 'catalogo' }); setAperto(null) }} data-tip="Auto, bus, gazebo, palchi, tende, arredi"><Icona n="category" />Catalogo</button>
        <button className={st.k === 'cammina' ? 'acceso' : ''} onClick={() => { s.set({ strumento: st.k === 'cammina' ? { k: 'naviga' } : { k: 'cammina' }, bozza: [] }); setAperto(null) }} data-tip="Cammina ad altezza d'uomo dal punto al centro dello schermo"><Icona n="directions_walk" />Cammina</button>
        <button className={st.k === 'poi' ? 'acceso' : ''} onClick={() => { s.set({ strumento: st.k === 'poi' ? { k: 'naviga' } : { k: 'poi' }, sel: null, selPoi: null, pannello: st.k === 'poi' ? null : 'poi', spostaPoi: false }); setAperto(null) }} data-tip="Aggiungi o correggi bagni, fermate, parcheggi e altri punti: li vedono tutti"><Icona n="add_location_alt" />Punti</button>
      </nav>}

      {(st.k === 'disegna' || st.k === 'misura') && (
        <div className="guida-strumento">
          <b>{st.k === 'disegna' ? st.nome : 'Misura'}</b>
          <span>{st.k === 'disegna' ? st.aiuto : st.modo === 'quota' ? 'Clicca un punto' : st.modo === 'altezza' ? 'Clicca due punti' : 'Clicca i punti; ogni nuova misura parte dopo «Nuova»'}</span>
          {st.k === 'disegna' && <button className="primary" disabled={s.bozza.length < st.min} onClick={finisci}>Fine ({s.bozza.length})</button>}
          {st.k === 'misura' && <button onClick={() => s.set({ misure: [...s.misure, { id: Math.random().toString(36).slice(2), modo: st.modo, pts: [] }] })}>Nuova</button>}
          <button className="quiet" onClick={() => s.set({ strumento: { k: 'naviga' }, bozza: [] })}>Esci</button>
        </div>
      )}

      {st.k === 'cammina' && <Pad />}
      {st.k === 'percorso' && <SchedaPercorso calc={calc} opzioni={opzioni} scelta={scelta} scegli={setScelta} esci={() => s.set({ strumento: { k: 'naviga' }, percorso: { ...s.percorso, scegli: null } })} />}

      {s.selPoi && s.pannello !== 'poi' && st.k !== 'percorso' && <SchedaPoi />}
      {pronto && !mod && !s.ospite && (s.scegliCasa || (!s.casaChiesta && !s.selPoi && st.k === 'naviga' && !s.pannello)) && <SchedaCasa />}
      {s.pannello && <Pannello chiudi={() => s.set({ pannello: null, sel: null, selEdificio: null, info: null })} />}

      <footer className="stato">
        <span ref={barra}>Positano</span>
      </footer>
      {s.avviso && <div className="avviso" role="status">{s.avviso}</div>}
      <Suggerimenti />
    </div>
  )
}

function finisci() {
  const s = useS.getState()
  const t = s.strumento
  if (t.k !== 'disegna') return
  const b = s.bozza
  if (b.length < t.min) { s.dici(`Servono almeno ${t.min} punti`); return }
  let z = quotaBozza()
  // su Google 3D il terreno a 10 m non coincide con la superficie: gli oggetti in piedi prendono la quota cliccata
  if (z === undefined && googleAcceso() && ['modello', 'testo', 'volume', 'piazza'].includes(t.tipo)) z = s.ultimaQuota ?? undefined
  if (t.tipo === 'piazza' && z === undefined) z = Math.round(Math.max(quota(b[0][0], b[0][1]), quota(b[1][0], b[1][1])) * 10) / 10
  const o: Omit<Obj, 'id'> = { tipo: t.tipo, nome: t.nome, pts: b, par: { ...t.par }, ...(z !== undefined ? { z: Math.round(z * 100) / 100 } : {}) }
  s.aggiungi(o)
  s.set({ strumento: { k: 'naviga' }, bozza: [] })
  viewer.scene.requestRender()
}

function Pad() {
  const b = (k: keyof typeof tasti, t: string, cls: string) => (
    <button className={'pad-' + cls} onPointerDown={e => { e.preventDefault(); tasti[k] = 1 }} onPointerUp={() => (tasti[k] = 0)} onPointerLeave={() => (tasti[k] = 0)} aria-label={t}>{t}</button>
  )
  return (
    <div className="pad">
      <div className="pad-tasti">{b('avanti', '▲', 'su')}{b('sinistra', '◀', 'sx')}{b('destra', '▶', 'dx')}{b('indietro', '▼', 'giu')}</div>
      <div className="pad-nota">Frecce o W A S D per camminare, Maiusc per correre, trascina per guardare</div>
    </div>
  )
}

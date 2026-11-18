import { useEffect, useMemo, useRef, useState } from 'react'
import { Cartesian3 } from 'cesium'
import { useS, type Utente } from './store'
import { impostaQualita, impostaNitidezza, quandoGoogle, quandoGoogleKo, googleAcceso, creaViewer, impostaGoogle, impostaOrto, impostaSole, vai, vistaCorrente, foto, VAI, viewer } from './scene/viewer'
import { caricaEdifici, disegnaEdifici, disegnaCupole, mostraCupole } from './scene/edifici'
import { caricaContesto, mostraContesto, cerca, reteVie } from './scene/contesto'
import { disegnaPercorso, inquadraPercorso } from './scene/percorso'
import { cammino, tappaDaLink } from './engine/percorso'
import { SchedaPercorso } from './ui/Percorso'
import { Servizi, SchedaPoi, chiama, puoModificare } from './ui/Pubblico'
import { avviaSovrapposti } from './scene/sovrapposti'
import { caricaPoi, disegnaPoi, rifaiPoi, elencoPoi } from './scene/poi'
import { avviaGps, centraSu, dentroPositano, gpsAcceso, fermaGps } from './scene/gps'
import { categoria } from './engine/poi'
import { avviaOggetti, disegnaOggetti, calcoli, quoteCambiate } from './scene/oggetti'
import { avviaInterazione, disegnaMisure, quotaBozza, type Punto } from './scene/interazione'
import { avviaCammina, fermaCammina, tasti } from './scene/cammina'
import { quota } from './scene/oggetti'
import { GRUPPI } from './ui/strumenti'
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
  const s = useS()
  const op = s.opzione()

  useEffect(() => {
    let stop: (() => void) | undefined
    ;(async () => {
      try {
        try { const c = await (await fetch('/config')).json(); if (c.ionToken) useS.setState(st => ({ ionTokenSito: c.ionToken, livelli: { ...st.livelli, google: st.livelli.googleScelto ?? true } })) } catch { /* sviluppo senza Worker */ }
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
        const v = useS.getState().progetto().vista ?? VAI[1]
        if (!a) vai(v, 0)
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
  useEffect(() => { if (pronto) disegnaPoi(new Set(s.poiCat), s.selPoi, mod) }, [pronto, s.poiCat, s.selPoi, mod, s.googleGiro])
  useEffect(() => { if (pronto && !mod && s.strumento.k !== 'naviga' && s.strumento.k !== 'percorso') s.set({ strumento: { k: 'naviga' }, bozza: [] }) }, [pronto, mod])
  useEffect(() => { if (pronto) disegnaEdifici(mod && s.livelli.edifici && !s.livelli.google, op.edifici, s.selEdificio, (s.sel && calcoli.get(s.sel)?.interferenze) || [], s.livelli.stile !== 'facciate') }, [pronto, op, s.sel, s.selEdificio, s.livelli.edifici, s.livelli.google, s.livelli.stile])
  useEffect(() => { if (pronto) { impostaOrto(s.livelli.orto); mostraContesto(s.livelli.strade, s.livelli.nomi, s.livelli.confine && !s.ospite, s.livelli.google, { ...s.coloriBase, ...s.livelli.coloriVie }); mostraCupole(mod && !s.livelli.google && s.livelli.edifici); impostaSole(s.livelli); impostaNitidezza(s.livelli.nitido); impostaQualita(s.livelli.qualita) } }, [pronto, s.livelli, s.ospite, s.coloriBase, mod])
  useEffect(() => { if (pronto) disegnaMisure(s.misure) }, [pronto, s.misure])
  // percorso a piedi
  const inPercorso = st0(s.strumento.k)
  const { da, a } = s.percorso
  const calc = useMemo(() => (pronto && inPercorso && da && a ? cammino(reteVie(), da.p, a.p) : null), [pronto, inPercorso, da?.p[0], da?.p[1], a?.p[0], a?.p[1]])
  useEffect(() => { if (pronto) disegnaPercorso(inPercorso ? calc : null, inPercorso ? da : null, inPercorso ? a : null) }, [pronto, inPercorso, calc, da?.nome, a?.nome, s.livelli.google, s.googleGiro])
  useEffect(() => { if (calc) inquadraPercorso(calc) }, [calc])
  useEffect(() => { document.title = s.ospite && a?.nome ? `Come arrivare a ${a.nome} · Posimulatore` : 'Posimulatore' }, [s.ospite, a?.nome])
  useEffect(() => {
    if (!pronto) return
    impostaGoogle(s.livelli.google, s.ionToken || s.ionTokenSito).then(err => { if (err) { s.dici(err); s.setLivelli({ google: false }) } else disegnaOggetti(op.oggetti, s.sel) })
  }, [pronto, s.livelli.google, s.ionToken, s.ionTokenSito])
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

      <header className="barra">
        <div className="marchio">Posimulatore</div>
        {mod && <button className="quiet progetto-nome" onClick={() => s.set({ pannello: 'progetto' })} data-tip="Progetti e opzioni">{s.progetto().nome} · {op.nome}</button>}
        <div className="cerca">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca via o luogo" aria-label="Cerca via o luogo" />
          {risultati.length > 0 && <ul className="risultati">{risultati.map(r => (
            <li key={r.nome + r.tipo + (r.poi ?? '')}><button onClick={() => { const z = r.z ?? quota(r.p[0], r.p[1]); vai({ lon: r.p[0], lat: r.p[1] - 0.0012, h: z + 110, heading: 0, pitch: -40 }); setQ(''); if (r.poi) { const c = elencoPoi().find(x => x.id === r.poi)!.c; s.set({ selPoi: r.poi, poiCat: s.poiCat.includes(c) ? s.poiCat : [...s.poiCat, c] }) } }}>{r.nome} <small>{r.tipo}</small></button></li>
          ))}</ul>}
        </div>
        <div className="azioni">
          {mod && <>
          <button className="quiet" disabled={!s.passato.length} onClick={s.annulla} data-tip="Annulla (Ctrl+Z)" aria-label="Annulla">↶</button>
          <button className="quiet" disabled={!s.futuro.length} onClick={s.ripeti} data-tip="Ripeti (Ctrl+Y)" aria-label="Ripeti">↷</button>
          </>}
          <select className="quiet" value="" onChange={e => { const v = VAI[Number(e.target.value)]; if (v) vai(v) }} aria-label="Vai a" data-tip="Vai a un punto di Positano">
            <option value="">Vai a…</option>
            {VAI.map((v, i) => <option key={v.nome} value={i}>{v.nome}</option>)}
          </select>
          {mod && <>
          <button className="quiet solo-desktop" onClick={() => { s.salvaVista(vistaCorrente()); s.dici('Vista salvata nel progetto') }} data-tip="Salva questa vista come partenza del progetto" aria-label="Salva vista">⌖</button>
          <button className={'quiet' + (s.livelli.progetto ? '' : ' acceso')} onClick={() => s.setLivelli({ progetto: !s.livelli.progetto })} aria-pressed={!s.livelli.progetto} data-tip={s.livelli.progetto ? 'Nascondi il progetto e guarda Positano com\'è oggi' : 'Mostra di nuovo il progetto'}>{s.livelli.progetto ? 'Com\'è oggi' : 'Progetto'}</button>
          </>}
          <button className={'quiet' + (gps ? ' acceso' : '')} aria-pressed={gps} onClick={dove} data-tip="Mostra dove sei (GPS)" aria-label="Dove sono">📍</button>
          {!mod && <button className={'quiet' + (st.k === 'percorso' ? ' acceso' : '')} onClick={() => s.set({ strumento: st.k === 'percorso' ? { k: 'naviga' } : { k: 'percorso' }, percorso: { ...s.percorso, scegli: s.percorso.da ? (s.percorso.a ? null : 'a') : 'da' }, selPoi: null, pannello: null })} data-tip="Da un punto a un altro a piedi, con salite e scale">🧭 <span className="solo-desktop">Percorso</span></button>}
          <button className="quiet solo-desktop" onClick={() => foto(s.progetto().nome)} data-tip="Scarica la vista come immagine ad alta risoluzione" aria-label="Foto">📷</button>
          <button className={'quiet' + (s.pannello === 'livelli' ? ' acceso' : '')} onClick={() => s.set({ pannello: s.pannello === 'livelli' ? null : 'livelli' })} data-tip="Mappe, edifici, Google 3D, sole e ombre">Livelli</button>
          <button className={'quiet' + (s.pannello === 'aiuto' ? ' acceso' : '')} onClick={() => s.set({ pannello: s.pannello === 'aiuto' ? null : 'aiuto' })} aria-label="Guida" data-tip="Guida e fonti dei dati">?</button>
          <button className={'quiet utente' + (s.pannello === 'accesso' ? ' acceso' : '')} onClick={() => s.set({ pannello: s.pannello === 'accesso' ? null : 'accesso' })} data-tip={s.utente ? 'Il tuo account' : 'Accedi per progettare e aggiornare la mappa'}>{s.utente ? s.utente.nome.split(' ')[0] : 'Accedi'}</button>
        </div>
      </header>

      {!s.ospite && <Servizi />}
      {mod && <nav className="strumenti" aria-label="Strumenti">
        <button className={st.k === 'naviga' ? 'acceso' : ''} onClick={() => { s.set({ strumento: { k: 'naviga' }, bozza: [] }); setAperto(null) }} data-tip="Muovi la vista, tocca per scegliere e trascina per spostare"><span>🖐️</span>Naviga</button>
        {GRUPPI.map(g => (
          <div key={g.id} className="gruppo">
            <button className={aperto === g.id || (st.k !== 'naviga' && st.k !== 'cammina' && g.voci.some(v => JSON.stringify(v.s) === JSON.stringify(st))) ? 'acceso' : ''} onClick={() => setAperto(aperto === g.id ? null : g.id)}><span>{g.icona}</span>{g.nome}</button>
            {aperto === g.id && <div className="menu">{g.voci.map(v => (
              <button key={v.nome} onClick={() => { s.set({ strumento: v.s, bozza: [], sel: null, selEdificio: null }); setAperto(null) }}>{v.nome}</button>
            ))}{g.id === 'misura' && s.misure.length > 0 && <button className="danger" onClick={() => { s.set({ misure: [] }); setAperto(null) }}>Cancella le misure</button>}</div>}
          </div>
        ))}
        <button className={s.pannello === 'catalogo' ? 'acceso' : ''} onClick={() => { s.set({ pannello: s.pannello === 'catalogo' ? null : 'catalogo' }); setAperto(null) }} data-tip="Auto, bus, gazebo, palchi, tende, arredi"><span>📦</span>Catalogo</button>
        <button className={st.k === 'percorso' ? 'acceso' : ''} onClick={() => { s.set({ strumento: st.k === 'percorso' ? { k: 'naviga' } : { k: 'percorso' }, percorso: { ...s.percorso, scegli: s.percorso.da ? (s.percorso.a ? null : 'a') : 'da' }, bozza: [], sel: null, pannello: null }); setAperto(null) }} data-tip="Da un punto a un altro a piedi, con salite e scale; link e QR da condividere"><span>🧭</span>Percorso</button>
        <button className={st.k === 'cammina' ? 'acceso' : ''} onClick={() => { s.set({ strumento: st.k === 'cammina' ? { k: 'naviga' } : { k: 'cammina' }, bozza: [] }); setAperto(null) }} data-tip="Cammina ad altezza d'uomo dal punto al centro dello schermo"><span>🚶</span>Cammina</button>
        <button className={st.k === 'poi' ? 'acceso' : ''} onClick={() => { s.set({ strumento: st.k === 'poi' ? { k: 'naviga' } : { k: 'poi' }, sel: null, selPoi: null, pannello: st.k === 'poi' ? null : 'poi', spostaPoi: false }); setAperto(null) }} data-tip="Aggiungi o correggi bagni, fermate, parcheggi e altri punti: li vedono tutti"><span>📌</span>Punti</button>
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
      {st.k === 'percorso' && <SchedaPercorso calc={calc} esci={() => s.set({ strumento: { k: 'naviga' }, percorso: { ...s.percorso, scegli: null } })} />}

      {s.selPoi && s.pannello !== 'poi' && st.k !== 'percorso' && <SchedaPoi />}
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

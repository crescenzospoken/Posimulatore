import { useRef, useState } from 'react'
import { useS } from '../store'
import type { Obj, Progetto } from '../engine/model'
import { CATALOGO } from '../engine/catalogo'
import { calcoli, USI } from '../scene/oggetti'
import { edificio, coloreDi } from '../scene/edifici'
import { quota } from '../scene/terreno'
import { inquadra } from '../scene/viewer'
import { modelloStrumento } from './strumenti'
import { risultato } from '../scene/interazione'
import { fmtM, fmtM2 } from '../engine/geo'
import { NORME } from '../engine/norme'

type Campo = { k: string; nome: string; t: 'num' | 'sel' | 'col' | 'bool' | 'txt'; opz?: [string, string][]; passo?: number; min?: number; max?: number; aiuto?: string }
const COLORI: [string, string][] = [['bianco', 'Bianco'], ['giallo', 'Giallo'], ['blu', 'Blu']]
const CAMPI: Record<Obj['tipo'], Campo[]> = {
  linea: [{ k: 'stile', nome: 'Tipo', t: 'sel', opz: [['continua', 'Continua'], ['tratteggiata', 'Tratteggiata'], ['doppia', 'Doppia']] }, { k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI },
    { k: 'larghezza', nome: 'Larghezza (m)', t: 'num', passo: 0.01, aiuto: `Urbana 12 cm, extraurbana 15 cm (${NORME.strisciaUrbana.fonte}, da verificare)` }, { k: 'tratto', nome: 'Tratto (m)', t: 'num', passo: 0.5 }, { k: 'vuoto', nome: 'Intervallo (m)', t: 'num', passo: 0.5 }],
  arresto: [{ k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI }],
  zebra: [{ k: 'profondita', nome: 'Larghezza attraversamento (m)', t: 'num', passo: 0.5, aiuto: `Minimo 2,5 m sulle strade locali (${NORME.zebraMinLocale.fonte}, da verificare)` }, { k: 'vuoto', nome: 'Intervallo fra le strisce (m)', t: 'num', passo: 0.1 }],
  stalli: [{ k: 'disposizione', nome: 'Disposizione', t: 'sel', opz: [['linea', 'In linea'], ['pettine', 'A pettine (90°)'], ['spina', 'A spina (45°)']] },
    { k: 'tipoStallo', nome: 'Per', t: 'sel', opz: [['auto', 'Auto'], ['disabili', 'Disabili'], ['moto', 'Moto'], ['carico', 'Carico e scarico']] },
    { k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI }, { k: 'lato', nome: 'Lato', t: 'sel', opz: [['1', 'A sinistra della linea'], ['-1', 'A destra della linea']] }],
  freccia: [{ k: 'rot', nome: 'Verso (gradi da nord)', t: 'num', passo: 15 }, { k: 'lunghezza', nome: 'Lunghezza (m)', t: 'num', passo: 0.5 }],
  area: [{ k: 'uso', nome: 'Uso', t: 'sel', opz: Object.entries(USI).map(([k, v]) => [k, v.nome]) }, { k: 'colore', nome: 'Colore', t: 'col' }],
  volume: [{ k: 'altezza', nome: 'Altezza (m)', t: 'num', passo: 0.5 }, { k: 'colore', nome: 'Colore', t: 'col' }, { k: 'opacita', nome: 'Opacità', t: 'num', passo: 0.1, min: 0.1, max: 1 }, { k: 'scava', nome: 'Scava il terreno', t: 'bool' }],
  barriera: [{ k: 'tipo', nome: 'Tipo', t: 'sel', opz: [['transenna', 'Transenne'], ['newjersey', 'New jersey'], ['ringhiera', 'Ringhiera'], ['vetro', 'Vetro'], ['muro', 'Muro']] }, { k: 'altezza', nome: 'Altezza muro (m)', t: 'num', passo: 0.1 }],
  modello: [{ k: 'm', nome: 'Modello', t: 'sel', opz: CATALOGO.map(m => [m.id, m.nome]) }, { k: 'rot', nome: 'Rotazione (gradi)', t: 'num', passo: 15 }, { k: 'scala', nome: 'Scala', t: 'num', passo: 0.1, min: 0.1 }, { k: 'alto', nome: 'Altezza (solo torri)', t: 'num', passo: 0.5 }],
  testo: [{ k: 'testo', nome: 'Testo', t: 'txt' }, { k: 'alto', nome: 'Altezza sul suolo (m)', t: 'num', passo: 0.5 }],
  piazza: [
    { k: 'livelli', nome: 'Piani di parcheggio sotto', t: 'num', passo: 1, min: 0, max: 4 },
    { k: 'hLiv', nome: 'Interpiano (m)', t: 'num', passo: 0.1, aiuto: `Altezza libera minima ${NORME.autorimessaH.valore} m (${NORME.autorimessaH.fonte}, da verificare)` },
    { k: 'spessore', nome: 'Spessore solaio (m)', t: 'num', passo: 0.05 },
    { k: 'campata', nome: 'Passo dei pilastri (m)', t: 'num', passo: 0.5 },
    { k: 'attacco', nome: 'Lato attaccato alla strada', t: 'num', passo: 1, min: 0, aiuto: 'Numero del lato: 0 è il primo disegnato' },
    { k: 'corsia', nome: 'Corsia di manovra (m)', t: 'num', passo: 0.5 },
    { k: 'stalloL', nome: 'Larghezza stallo (m)', t: 'num', passo: 0.1 },
    { k: 'stalloP', nome: 'Profondità stallo (m)', t: 'num', passo: 0.1 },
    { k: 'rampaPend', nome: 'Pendenza rampa (0,16 = 16%)', t: 'num', passo: 0.01, max: 0.3, aiuto: `Massimo 20% (${NORME.rampaMax.fonte}, da verificare)` },
    { k: 'rampaPos', nome: 'Posizione rampa lungo il lato (0-1)', t: 'num', passo: 0.05, min: 0, max: 1 },
    { k: 'parapetto', nome: 'Parapetto sui lati liberi', t: 'bool' },
    { k: 'scava', nome: 'Scava il terreno sotto', t: 'bool' },
    { k: 'pavimento', nome: 'Colore pavimento', t: 'col' },
  ],
}
const DEF: Record<string, number | string | boolean> = { livelli: 1, hLiv: 3.2, spessore: 0.5, campata: 7.5, attacco: 0, corsia: 6, stalloL: 2.5, stalloP: 5, rampaPend: 0.16, rampaPos: 0, parapetto: true, scava: true, pavimento: '#d8c9ae', altezza: 6, colore: '#e9d8bd', opacita: 1, rot: 0, scala: 1, alto: 0, tratto: 3, vuoto: 3, larghezza: 0.12, lato: 1 }

export function Pannello({ chiudi }: { chiudi: () => void }) {
  const s = useS()
  const titolo = { oggetto: s.sel ? 'Oggetto' : s.selEdificio ? 'Edificio' : 'Punto', livelli: 'Livelli', progetto: 'Progetti', catalogo: 'Catalogo', aiuto: 'Guida' }[s.pannello!]
  return (
    <aside className="pannello" aria-label={titolo}>
      <div className="pannello-testa"><h2>{titolo}</h2><button className="quiet" onClick={chiudi} aria-label="Chiudi">✕</button></div>
      <div className="pannello-corpo">
        {s.pannello === 'oggetto' && (s.sel ? <Oggetto /> : s.selEdificio ? <EdificioP /> : <PuntoP />)}
        {s.pannello === 'livelli' && <Livelli />}
        {s.pannello === 'progetto' && <ProgettoP />}
        {s.pannello === 'catalogo' && <Catalogo />}
        {s.pannello === 'aiuto' && <Aiuto />}
      </div>
    </aside>
  )
}

function Oggetto() {
  const s = useS()
  const o = s.opzione().oggetti.find(x => x.id === s.sel)
  if (!o) return <p>Niente di scelto.</p>
  const set = (k: string, v: number | string | boolean) => s.aggiorna(o.id, x => { x.par[k] = v })
  const P = o.tipo === 'piazza' ? calcoli.get(o.id) : undefined
  return (
    <div className="campi">
      <label>Nome<input value={o.nome} onChange={e => s.aggiorna(o.id, x => { x.nome = e.target.value })} /></label>
      {P && (
        <div className="risultati-piazza">
          <h3>Numeri</h3>
          <dl>
            <dt>Superficie della piazza</dt><dd>{fmtM2(P.area)}</dd>
            <dt>Posti auto</dt><dd>{P.stalliTot} ({P.livelli.length > 1 ? P.livelli[1].stalli.length : 0} per piano)</dd>
            <dt>Sbalzo dal lato strada</dt><dd>{fmtM(P.sporgenza)}</dd>
            <dt>Altezza massima sul terreno</dt><dd>{fmtM(P.altezzaSulTerreno)}</dd>
            <dt>Terreno sotto</dt><dd>{P.terrenoMin.toFixed(1).replace('.', ',')} – {P.terrenoMax.toFixed(1).replace('.', ',')} m s.l.m.</dd>
            {P.rampa && <><dt>Rampa per piano</dt><dd>{fmtM(P.rampaL)}</dd></>}
            <dt>Pilastri</dt><dd>{P.pilastri.length}</dd>
            {P.scavo > 1 && <><dt>Scavo stimato</dt><dd>{Math.round(P.scavo).toLocaleString('it-IT')} m³</dd></>}
          </dl>
          <h3>Controlli</h3>
          {P.interferenze.length > 0 && <p className="nota">Gli edifici sotto la piazza sono in rosso. Toccandoli puoi correggerne l'altezza o toglierli in questa opzione.</p>}
          <ul className="controlli">{P.controlli.map((c, i) => <li key={i} className={c.esito}><span>{c.esito === 'ok' ? '✓' : c.esito === 'errore' ? '✕' : '!'}</span>{c.testo}{c.fonte && <small>{c.fonte}, da verificare</small>}</li>)}</ul>
        </div>
      )}
      {P && <h3>Parametri</h3>}
      <label className="riga">
        <span>Appoggio</span>
        <select value={o.z === undefined ? 't' : 'q'} onChange={e => s.aggiorna(o.id, x => { if (e.target.value === 't') delete x.z; else x.z = Math.round(quota(x.pts[0][0], x.pts[0][1]) * 10) / 10 })}>
          <option value="t">Sul terreno</option><option value="q">A una quota</option>
        </select>
      </label>
      {o.z !== undefined && <label>Quota (m s.l.m.)<input type="number" step={0.1} value={o.z} onChange={e => s.aggiorna(o.id, x => { x.z = Number(e.target.value) })} /></label>}
      {CAMPI[o.tipo].map(c => {
        const v = o.par[c.k] ?? DEF[c.k]
        if (c.k === 'altezza' && o.tipo === 'barriera' && o.par.tipo !== 'muro') return null
        return (
          <label key={c.k} className={c.t === 'bool' ? 'riga' : ''}>
            <span>{c.nome}</span>
            {c.t === 'num' && <input type="number" step={c.passo ?? 0.1} min={c.min} max={c.max} value={Number(v)} onChange={e => set(c.k, Number(e.target.value))} />}
            {c.t === 'txt' && <input value={String(v ?? '')} onChange={e => set(c.k, e.target.value)} />}
            {c.t === 'col' && <input type="color" value={String(v ?? (o.tipo === 'area' ? USI[String(o.par.uso)]?.col : '#e9d8bd'))} onChange={e => set(c.k, e.target.value)} />}
            {c.t === 'bool' && <input type="checkbox" checked={v !== false} onChange={e => set(c.k, e.target.checked)} />}
            {c.t === 'sel' && <select value={String(v)} onChange={e => set(c.k, c.k === 'lato' ? Number(e.target.value) : e.target.value)}>{c.opz!.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}
            {c.aiuto && <small>{c.aiuto}</small>}
          </label>
        )
      })}
      {o.tipo === 'piazza' && <button onClick={() => set('attacco', (Number(o.par.attacco ?? 0) + 1) % o.pts.length)}>Attacca il lato successivo alla strada</button>}
      <div className="bottoni">
        <button onClick={() => inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1]))}>Inquadra</button>
        <button onClick={() => s.duplica(o.id)}>Duplica</button>
        <button className="danger" onClick={() => s.togli(o.id)}>Elimina</button>
      </div>
      <p className="nota">Trascina l'oggetto o i suoi punti azzurri per spostarli.</p>
    </div>
  )
}

function EdificioP() {
  const s = useS()
  const e = s.selEdificio ? edificio(s.selEdificio) : undefined
  if (!e) return null
  const m = s.opzione().edifici[e.id] ?? {}
  const set = (v: { h?: number; via?: boolean; col?: string } | null) => s.modifica(op => { if (v) op.edifici[e.id] = { ...op.edifici[e.id], ...v }; else delete op.edifici[e.id] })
  const osm = e.id.startsWith('w') ? `https://www.openstreetmap.org/way/${e.id.slice(1)}` : `https://www.openstreetmap.org/relation/${e.id.slice(1).split('.')[0]}`
  return (
    <div className="campi">
      {e.n && <p><b>{e.n}</b></p>}
      <p>Ingombro da OpenStreetMap. {e.stima ? 'Altezza stimata dalla superficie, non misurata.' : 'Altezza dai dati OSM.'}</p>
      <label>Altezza dal lato a monte (m)<input type="number" step={0.5} value={m.h ?? e.h} onChange={ev => set({ h: Number(ev.target.value) })} /><small>Circa 3 m a piano. Le finestre si contano dal tetto.</small></label>
      <label className="riga"><span>Colore della facciata</span><input type="color" value={m.col ?? coloreDi(e.id)} onChange={ev => set({ col: ev.target.value })} /></label>
      <p className="nota">Per copiare colore e piani dal vero, guarda l'edificio qui:</p>
      <div className="bottoni">
        <a className="bottone" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.r[0][1]},${e.r[0][0]}`}>Street View</a>
        <a className="bottone" target="_blank" rel="noreferrer" href={`https://earth.google.com/web/@${e.r[0][1]},${e.r[0][0]},${Math.round(e.g + 47)}a,120d,35y,0h,65t,0r`}>Google Earth</a>
      </div>
      <p className="nota">Terreno attorno: {e.b + 1 < e.g ? `da ${(e.b + 1).toFixed(1).replace('.', ',')} a ${e.g.toFixed(1).replace('.', ',')}` : e.g.toFixed(1).replace('.', ',')} m s.l.m.</p>
      <div className="bottoni">
        {!m.via && <button className="danger" onClick={() => { set({ via: true }); s.set({ selEdificio: null }) }} data-tip="Lo toglie solo in questa opzione del progetto">Demolisci in questa opzione</button>}
        {(m.h !== undefined || m.via || m.col) && <button onClick={() => set(null)}>Ripristina</button>}
        <a className="bottone" href={osm} target="_blank" rel="noreferrer">Apri in OpenStreetMap</a>
      </div>
    </div>
  )
}

function PuntoP() {
  const s = useS()
  const i = s.info
  if (!i) return <p>Tocca un punto della mappa o un oggetto.</p>
  const [lon, lat] = i.p
  return (
    <div className="campi">
      <dl>
        <dt>Coordinate</dt><dd>{lat.toFixed(6)}, {lon.toFixed(6)}</dd>
        <dt>Quota</dt><dd>{i.z.toFixed(1).replace('.', ',')} m s.l.m.</dd>
        <dt>Terreno (modello a 10 m)</dt><dd>{quota(lon, lat).toFixed(1).replace('.', ',')} m s.l.m.</dd>
      </dl>
      <p className="nota">Per guardare com'è oggi:</p>
      <div className="bottoni">
        <a className="bottone" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`}>Street View</a>
        <a className="bottone" target="_blank" rel="noreferrer" href={`https://earth.google.com/web/@${lat},${lon},${Math.round(i.z + 47)}a,180d,35y,0h,60t,0r`}>Google Earth</a>
        <a className="bottone" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`}>OpenStreetMap</a>
        <button onClick={() => navigator.clipboard?.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`)}>Copia coordinate</button>
      </div>
      <Misure />
    </div>
  )
}
function Misure() {
  const s = useS()
  const m = s.misure.filter(x => x.pts.length)
  if (!m.length) return null
  return <><h3>Misure</h3><ul className="misure">{m.map(x => <li key={x.id}>{risultato(x) || '…'}</li>)}</ul></>
}

function Livelli() {
  const s = useS()
  const l = s.livelli
  const t = (k: keyof typeof l, nome: string, aiuto?: string) => (
    <label className="riga"><span>{nome}{aiuto && <small>{aiuto}</small>}</span><input type="checkbox" checked={Boolean(l[k])} onChange={e => s.setLivelli({ [k]: e.target.checked })} /></label>
  )
  return (
    <div className="campi">
      <label>Immagine del suolo
        <select value={l.orto} onChange={e => s.setLivelli({ orto: e.target.value as typeof l.orto })}>
          <option value="esri">Satellite (Esri World Imagery)</option>
          <option value="pcn2012">Ortofoto 2012 (Geoportale Nazionale, a volte non risponde)</option>
          <option value="osm">Mappa OpenStreetMap</option>
        </select>
      </label>
      {t('edifici', 'Edifici (OpenStreetMap)', 'Volumi semplici, altezze stimate')}
      {l.edifici && (
        <label>Aspetto degli edifici
          <select value={l.stile} onChange={e => s.setLivelli({ stile: e.target.value as typeof l.stile })}>
            <option value="plastico">Plastico (volumi puliti)</option>
            <option value="facciate">Facciate disegnate (finestre e balconi)</option>
          </select>
        </label>
      )}
      {t('strade', 'Strade e scale (OpenStreetMap)')}
      {t('nomi', 'Nomi dei luoghi')}
      {t('confine', 'Confine comunale')}
      {t('google', 'Google 3D fotorealistico', 'La base più fedele: i progetti si disegnano sopra. Solo da guardare, mai copiato')}
      {!s.ionTokenSito && (l.google || !s.ionToken) && (
        <label>Codice Cesium ion
          <input type="password" value={s.ionToken} placeholder="Incolla il codice di accesso" onChange={e => s.set({ ionToken: e.target.value.trim() })} />
          <small>Account gratuito su ion.cesium.com, sezione Access Tokens. Resta solo in questo browser.</small>
        </label>
      )}
      {t('ombre', 'Sole e ombre')}
      {l.ombre && (
        <>
          <label>Giorno<input type="date" value={l.giorno} onChange={e => s.setLivelli({ giorno: e.target.value })} /></label>
          <label>Ora: {Math.floor(l.ora)}:{String(Math.round((l.ora % 1) * 60)).padStart(2, '0')}
            <input type="range" min={5} max={21} step={0.25} value={l.ora} onChange={e => s.setLivelli({ ora: Number(e.target.value) })} />
          </label>
        </>
      )}
    </div>
  )
}

function ProgettoP() {
  const s = useS()
  const p = s.progetto()
  const file = useRef<HTMLInputElement>(null)
  const [conferma, setConferma] = useState(false)
  const esporta = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }))
    a.download = `${p.nome}.posimulatore.json`
    a.click()
  }
  const importa = async (f: File) => {
    try { const j = JSON.parse(await f.text()) as Progetto; if (!j.opzioni) throw new Error(); s.importa(j); s.dici('Progetto importato') } catch { s.dici('File non valido') }
  }
  return (
    <div className="campi">
      <label>Nome del progetto<input value={p.nome} onChange={e => s.rinominaProgetto(e.target.value)} /></label>
      <h3>Opzioni</h3>
      <div className="schede">{p.opzioni.map(o => <button key={o.id} className={o.id === p.attiva ? 'acceso' : ''} onClick={() => s.apriOpzione(o.id)}>{o.nome} <small>{o.oggetti.length}</small></button>)}</div>
      <div className="bottoni">
        <button onClick={() => s.nuovaOpzione(true)} data-tip="Copia l'opzione aperta per provare una variante">+ Opzione (copia)</button>
        <button onClick={() => s.nuovaOpzione(false)}>+ Opzione vuota</button>
      </div>
      <h3>Oggetti</h3>
      <ul className="elenco">{s.opzione().oggetti.map(o => (
        <li key={o.id}><button className={o.id === s.sel ? 'acceso' : ''} onClick={() => { s.set({ sel: o.id, pannello: 'oggetto' }); inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1])) }}>{o.nome}</button></li>
      ))}{!s.opzione().oggetti.length && <li className="nota">Ancora niente: scegli uno strumento a sinistra.</li>}</ul>
      <h3>Tutti i progetti</h3>
      <ul className="elenco">{s.progetti.map(x => <li key={x.id}><button className={x.id === p.id ? 'acceso' : ''} onClick={() => s.apriProgetto(x.id)}>{x.nome}</button></li>)}</ul>
      <div className="bottoni">
        <button className="primary" onClick={() => s.nuovoProgetto('Progetto ' + (s.progetti.length + 1))}>+ Progetto</button>
        <button onClick={esporta}>Esporta</button>
        <button onClick={() => file.current?.click()}>Importa</button>
        {!conferma ? <button className="danger" onClick={() => setConferma(true)}>Elimina</button>
          : <><button className="danger" onClick={() => { s.eliminaProgetto(p.id); setConferma(false) }}>Sì, elimina «{p.nome}»</button><button onClick={() => setConferma(false)}>No</button></>}
      </div>
      <input ref={file} type="file" accept=".json,application/json" hidden onChange={e => e.target.files?.[0] && importa(e.target.files[0])} />
      <p className="nota">I progetti restano in questo browser. Esporta per conservarli o passarli a un altro dispositivo.</p>
    </div>
  )
}

function Catalogo() {
  const s = useS()
  const gruppi = [...new Set(CATALOGO.map(m => m.gruppo))]
  return (
    <div className="campi">
      {gruppi.map(g => (
        <div key={g}>
          <h3>{g}</h3>
          <div className="griglia">{CATALOGO.filter(m => m.gruppo === g).map(m => (
            <button key={m.id} onClick={() => s.set({ strumento: modelloStrumento(m.id, m.nome), bozza: [], pannello: null })} data-tip={m.nota ?? `${m.dim[0]} x ${m.dim[1]} m, alto ${m.dim[2]} m`}>
              {m.nome}<small>{m.dim[0]}×{m.dim[1]} m</small>
            </button>
          ))}</div>
        </div>
      ))}
    </div>
  )
}

function Aiuto() {
  return (
    <div className="campi testo">
      <h3>Come si usa</h3>
      <ul>
        <li><b>Muoversi</b>: trascina per spostare, rotella o due dita per avvicinarti, tasto destro (o Ctrl) e trascina per inclinare. «Vai a» porta nei punti principali.</li>
        <li><b>Disegnare</b>: scegli uno strumento a sinistra e clicca sulla mappa. Doppio clic, Invio o «Fine» chiudono. Esc annulla.</li>
        <li><b>Modificare</b>: tocca un oggetto, cambia i valori nel pannello, trascina l'oggetto o i punti azzurri. Canc lo elimina, Ctrl+Z annulla.</li>
        <li><b>Edifici</b>: tocca un edificio per correggerne l'altezza o toglierlo in un'opzione.</li>
        <li><b>Opzioni</b>: in «Progetti» copi l'opzione aperta per confrontare varianti.</li>
        <li><b>Cammina</b>: vedi la scena ad altezza d'uomo, anche sopra le piazze disegnate.</li>
        <li>Un punto qualsiasi apre Street View e Google Earth lì, per confrontare con lo stato di fatto.</li>
      </ul>
      <h3>Da dove vengono i dati</h3>
      <ul>
        <li>Terreno: TINITALY 1.1, INGV, 10 m (CC BY 4.0). Attorno: Copernicus DEM GLO-30. Quote s.l.m. con geoide EGM96.</li>
        <li>Edifici, strade, luoghi e confine: © OpenStreetMap contributors (ODbL), scaricati il 9/11/2026.</li>
        <li>Ortofoto 2012: Geoportale Nazionale, Ministero dell'Ambiente.</li>
        <li>Google 3D: Google Maps Platform tramite Cesium ion, solo visualizzazione.</li>
        <li>Misure di norma (stalli, rampe, altezze): indicate con la fonte e «da verificare».</li>
      </ul>
      <p className="nota">Il terreno a 10 m arrotonda muri, scale e tornanti: le quote sono indicative, non sostituiscono un rilievo.</p>
    </div>
  )
}

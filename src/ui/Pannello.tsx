import { t as tr } from '../i18n'
import { useRef, useState } from 'react'
import { useS, STILE_VIE } from '../store'
import type { Obj, Progetto } from '../engine/model'
import { CATALOGO } from '../engine/catalogo'
import { calcoli, USI } from '../scene/oggetti'
import { edificio, coloreDi } from '../scene/edifici'
import { GRUPPI_VIE } from '../scene/contesto'
import { Icona } from './Icona'
import { Allinea } from './Allinea'
import type { NomeIcona } from './icone'
import { Accesso, Utenti, ModificaPoi, chiama, puoModificare } from './Pubblico'
import { CorreggiVia } from './CorreggiVia'
import { ModificaEvento } from './Eventi'
import { quota } from '../scene/oggetti'
import { inquadra, quotaGoogle, googleAcceso } from '../scene/viewer'
import { Frame, add, mul } from '../engine/geo'
import { modelloStrumento } from './strumenti'
import { risultato } from '../scene/interazione'
import { fmtM, fmtM2 } from '../engine/geo'
import { NORME } from '../engine/norme'
import { Geometria } from './Geometria'

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
    { k: 'rampa', nome: 'Rampa interna dal piano strada', t: 'bool', aiuto: 'Spenta: si entra a raso dalla strada più bassa' },
    { k: 'rampaPend', nome: 'Pendenza rampa (0,16 = 16%)', t: 'num', passo: 0.01, max: 0.3, aiuto: `Massimo 20% (${NORME.rampaMax.fonte}, da verificare)` },
    { k: 'rampaPos', nome: 'Posizione rampa lungo il lato (0-1)', t: 'num', passo: 0.05, min: 0, max: 1 },
    { k: 'parapetto', nome: 'Parapetto sui lati liberi', t: 'bool' },
    { k: 'scava', nome: 'Togli dalla vista l\'esistente dentro il perimetro', t: 'bool', aiuto: 'Spento: edifici e strada sotto restano visibili. Acceso: mostra il progetto al posto dell\'esistente' },
    { k: 'pavimento', nome: 'Pavimento', t: 'sel', opz: [['#e6dccb', 'Pietra chiara'], ['#cfc8bb', 'Pietra grigia'], ['#d8c3a0', 'Travertino'], ['cotto', 'Cotto']] },
  ],
}
const DEF: Record<string, number | string | boolean> = { livelli: 1, hLiv: 3.2, spessore: 0.5, campata: 7.5, attacco: 0, corsia: 6, stalloL: 2.5, stalloP: 5, rampaPend: 0.16, rampaPos: 0, parapetto: true, scava: false, rampa: true, pavimento: '#e6dccb', altezza: 6, colore: '#e9d8bd', opacita: 1, rot: 0, scala: 1, alto: 0, tratto: 3, vuoto: 3, larghezza: 0.12, lato: 1 }

export function Pannello({ chiudi }: { chiudi: () => void }) {
  const s = useS()
  const titolo = tr({ oggetto: s.sel ? 'Oggetto' : s.selEdificio ? 'Edificio' : 'Punto', livelli: 'Livelli', progetto: 'Progetti', catalogo: 'Catalogo', aiuto: 'Guida', percorso: 'Percorso', accesso: s.utente ? 'Account' : 'Accedi', utenti: 'Utenti e permessi', poi: 'Punto di interesse', via: 'Correggi le vie', evento: 'Evento', allinea: 'Allinea le vie al 3D' }[s.pannello!] ?? '')
  return (
    <aside className="pannello" aria-label={titolo}>
      <div className="pannello-testa"><h2>{titolo}</h2><button className="tondo quiet" onClick={chiudi} aria-label={tr('Chiudi')}><Icona n="close" /></button></div>
      <div className="pannello-corpo">
        {s.pannello === 'oggetto' && (s.sel ? <Oggetto /> : s.selEdificio ? <EdificioP /> : <PuntoP />)}
        {s.pannello === 'livelli' && <Livelli />}
        {s.pannello === 'progetto' && <ProgettoP />}
        {s.pannello === 'catalogo' && <Catalogo />}
        {s.pannello === 'aiuto' && <Aiuto />}
        {s.pannello === 'accesso' && <Accesso />}
        {s.pannello === 'utenti' && <Utenti />}
        {s.pannello === 'poi' && <ModificaPoi />}
        {s.pannello === 'via' && <CorreggiVia />}
        {s.pannello === 'allinea' && <Allinea />}
        {s.pannello === 'evento' && <ModificaEvento />}
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
          {P.interferenze.length > 0 && !googleAcceso() && <p className="nota">Gli edifici sotto la piazza sono in rosso. Toccandoli puoi correggerne l'altezza o toglierli in questa opzione.</p>}
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
            {c.t === 'bool' && <input type="checkbox" checked={v === true} onChange={e => set(c.k, e.target.checked)} />}
            {c.t === 'sel' && <select value={String(v)} onChange={e => set(c.k, c.k === 'lato' ? Number(e.target.value) : e.target.value)}>{c.opz!.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>}
            {c.aiuto && <small>{c.aiuto}</small>}
          </label>
        )
      })}
      {o.tipo === 'piazza' && <button onClick={() => set('attacco', (Number(o.par.attacco ?? 0) + 1) % o.pts.length)}>Attacca il lato successivo alla strada</button>}
      {o.tipo === 'piazza' && P && googleAcceso() && <button onClick={() => {
        // quota della strada: 2 m fuori dal lato d'attacco, sulla superficie di Google
        const f = new Frame(o.pts[0][0], o.pts[0][1])
        const xy = o.pts.map(q => f.toXY(q))
        const n = xy.length, i = ((Number(o.par.attacco ?? 0) % n) + n) % n
        const m = mul(add(xy[i], xy[(i + 1) % n]), 0.5)
        const q = f.toLL(add(m, mul(P.v, -2.5)))
        const z = quotaGoogle(q[0], q[1])
        if (z === undefined) s.dici('Google 3D non ancora caricato lì: avvicinati e riprova')
        else { s.aggiorna(o.id, x => { x.z = Math.round(z * 10) / 10 }); s.dici(`Piazza alla quota della strada: ${z.toFixed(1).replace('.', ',')} m s.l.m.`) }
      }} data-tip="Porta il piano della piazza alla quota della strada letta sul 3D di Google">Piano alla quota della strada</button>}
      <label className="riga"><span>Nascondi dalla vista<small>Resta nel progetto, non si disegna</small></span><input type="checkbox" checked={o.nascosto === true} onChange={e => s.aggiorna(o.id, x => { if (e.target.checked) x.nascosto = true; else delete x.nascosto })} /></label>
      <Geometria o={o} />
      <div className="bottoni">
        <button onClick={() => inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1]))}>Inquadra</button>
        <button onClick={() => s.duplica(o.id)}>Duplica</button>
        <button className="danger" onClick={() => s.togli(o.id)}>Elimina</button>
      </div>
      <p className="nota">Puoi anche trascinare l'oggetto o i suoi punti numerati.</p>
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
        <dt>Suolo in quel punto</dt><dd>{quota(lon, lat).toFixed(1).replace('.', ',')} m s.l.m.</dd>
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
  const mod = s.inModifica && puoModificare(s.utente)
  const l = s.livelli
  const casella = (k: keyof typeof l, nome: string, aiuto?: string) => (
    <label className="riga"><span>{tr(nome)}{aiuto && <small>{tr(aiuto)}</small>}</span><input type="checkbox" checked={Boolean(l[k])} onChange={e => s.setLivelli({ [k]: e.target.checked })} /></label>
  )
  return (
    <div className="campi">
      {/* due modi: la foto 3D di Google, o una mappa semplice sul terreno in 3D dove le vie colorate si leggono meglio */}
      <div className="segmenti" role="radiogroup" aria-label={tr('Tipo di mappa')}>
        <button role="radio" aria-checked={l.google} className={l.google ? 'acceso' : ''} onClick={() => s.setLivelli({ google: true, orto: 'esri' })}><Icona n="photo_camera" />{tr('Foto 3D')}</button>
        <button role="radio" aria-checked={!l.google && l.orto === 'mappa'} className={!l.google && l.orto === 'mappa' ? 'acceso' : ''} onClick={() => s.setLivelli({ google: false, orto: 'mappa', strade: true })}><Icona n="map" />{tr('Mappa')}</button>
      </div>
      {l.google && (
        <label>{tr('Attenua il 3D')}: {Math.round((l.attenua ?? 0) * 100)}%
          <input type="range" min={0} max={0.9} step={0.05} value={l.attenua ?? 0} onChange={e => s.setLivelli({ attenua: Number(e.target.value) })} />
          <small>{tr('Schiarisce le foto del 3D: vie, percorsi e punti risaltano di più')}</small>
        </label>
      )}
      {!l.google && (
        <label>{tr('Immagine del suolo')}
          <select value={l.orto} onChange={e => s.setLivelli({ orto: e.target.value as typeof l.orto })}>
            <option value="mappa">{tr('Mappa semplice')}</option>
            <option value="esri">{tr('Satellite')}</option>
            <option value="osm">{tr('Mappa OpenStreetMap')}</option>
            {mod && <option value="pcn2012">Ortofoto 2012 (Geoportale Nazionale, a volte non risponde)</option>}
          </select>
        </label>
      )}
      {mod && casella('edifici', 'Edifici (OpenStreetMap)', 'Volumi semplici, altezze stimate')}
      {mod && l.edifici && (
        <label>Aspetto degli edifici
          <select value={l.stile} onChange={e => s.setLivelli({ stile: e.target.value as typeof l.stile })}>
            <option value="plastico">Plastico (volumi puliti)</option>
            <option value="facciate">Facciate disegnate (finestre e balconi)</option>
          </select>
        </label>
      )}
      {casella('strade', 'Vie, scale e sentieri', 'Tocca un colore per cambiarlo')}
      {l.strade && (
        <div className="colori-vie">
          {GRUPPI_VIE.map(g => (
            <label key={g.k} className="colore"><input type="color" value={l.coloriVie?.[g.k] ?? s.coloriBase[g.k] ?? g.col} onChange={e => s.setLivelli({ coloriVie: { ...l.coloriVie, [g.k]: e.target.value } })} />{tr(g.nome)}</label>
          ))}
          <div className="segmenti largo" role="radiogroup" aria-label={tr('Come si disegnano le vie')}>
            <button role="radio" aria-checked={!l.vieDipinte} className={!l.vieDipinte ? 'acceso' : ''} onClick={() => s.setLivelli({ vieDipinte: false })} data-tip={tr('Linee nette alla quota della strada: pulite, ma possono staccarsi dal 3D')}>{tr('Linee')}</button>
            <button role="radio" aria-checked={!!l.vieDipinte} className={l.vieDipinte ? 'acceso' : ''} onClick={() => s.setLivelli({ vieDipinte: true })} data-tip={tr('Dipinte sulla superficie del 3D: sempre attaccate, ma salgono su tetti e muri')}>{tr('Dipinte sul 3D')}</button>
          </div>
          {(() => { const st = { ...STILE_VIE, ...s.stileBase, ...l.stileVie }, metti = (k: keyof typeof st, v: number) => s.setLivelli({ stileVie: { ...l.stileVie, [k]: v } }); return <>
            <label className="largo">{tr('Spessore')}: {Math.round(st.spessore * 100)}%<input type="range" min={0.4} max={2.5} step={0.1} value={st.spessore} onChange={e => metti('spessore', Number(e.target.value))} /></label>
            <label className="largo">{tr('Opacità')}: {Math.round(st.alfa * 100)}%<input type="range" min={0.15} max={1} step={0.05} value={st.alfa} onChange={e => metti('alfa', Number(e.target.value))} /></label>
            {l.google && <label className="largo">{tr('Dove il 3D le copre')}: {Math.round(st.filigrana * 100)}%<input type="range" min={0} max={1} step={0.05} value={st.filigrana} onChange={e => metti('filigrana', Number(e.target.value))} /></label>}
          </> })()}
          {(Object.keys(l.coloriVie ?? {}).length > 0 || Object.keys(l.stileVie ?? {}).length > 0) && <button className="quiet" onClick={() => s.setLivelli({ coloriVie: {}, stileVie: {} })}>{tr('Torna ai colori di base')}</button>}
          {s.utente?.ruolo === 'admin' && <button onClick={async () => {
            const v = Object.fromEntries(GRUPPI_VIE.map(g => [g.k, l.coloriVie?.[g.k] ?? s.coloriBase[g.k] ?? g.col]))
            const stv = { ...STILE_VIE, ...s.stileBase, ...l.stileVie }
            try { await chiama('impostazioni/coloriVie', 'PUT', { v }); await chiama('impostazioni/stileVie', 'PUT', { v: stv }); s.set({ coloriBase: v, stileBase: stv }); s.setLivelli({ coloriVie: {}, stileVie: {} }); s.dici('Colori, spessore e opacità salvati per tutti') } catch (e) { s.dici((e as Error).message) }
          }} data-tip="Diventano i colori che vede chiunque apra il sito">Usa questo aspetto per tutti</button>}
        </div>
      )}
      {casella('nomi', 'Nomi dei luoghi')}
      {casella('confine', 'Confine comunale')}
      {mod && !s.ionTokenSito && !s.googleKey && (l.google || !s.ionToken) && (
        <label>Codice Cesium ion
          <input type="password" value={s.ionToken} placeholder="Incolla il codice di accesso" onChange={e => s.set({ ionToken: e.target.value.trim() })} />
          <small>Account gratuito su ion.cesium.com, sezione Access Tokens. Resta solo in questo browser.</small>
        </label>
      )}
      <label>{tr('Qualità e velocità')}
        <select value={l.qualita} onChange={e => s.setLivelli({ qualita: e.target.value as typeof l.qualita })}>
          <option value="leggera">{tr('Leggera: veloce, adatta al telefono')}</option>
          <option value="normale">{tr('Normale')}</option>
          <option value="alta">{tr('Alta: più dettaglio, serve un telefono o computer potente')}</option>
        </select>
      </label>
      {mod && casella('progetto', 'Oggetti di progetto', 'Spento: si vede Positano com\'è oggi')}
      {casella('nitido', 'Immagine più nitida', 'Più dettaglio e colore sulle foto aeree')}
      {mod && casella('ombre', 'Sole e ombre', 'Gli oggetti di progetto fanno ombra sul paese. Rallenta molto')}
      {mod && l.ombre && (
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
        <li key={o.id} className="riga-oggetto"><button className={(o.id === s.sel ? 'acceso' : '') + (o.nascosto ? ' spento' : '')} onClick={() => { s.set({ sel: o.id, pannello: 'oggetto' }); inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1])) }}>{o.nome}</button>
          <button className="quiet occhio" aria-pressed={!o.nascosto} aria-label={o.nascosto ? `Mostra ${o.nome}` : `Nascondi ${o.nome}`} data-tip={o.nascosto ? 'Mostra' : 'Nascondi dalla vista'} onClick={() => s.aggiorna(o.id, x => { if (x.nascosto) delete x.nascosto; else x.nascosto = true })}>{o.nascosto ? 'Mostra' : 'Nascondi'}</button></li>
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
  const s = useS()
  const mod = s.inModifica && puoModificare(s.utente)
  // una riga per pulsante, con la stessa icona che si vede sulla mappa
  const voci: [NomeIcona, string][] = [
    ['pan_tool', 'Un dito sposta, due dita ingrandiscono, ruotano e inclinano'],
    ['search', 'Cerca vie, luoghi, negozi e servizi'],
    ['directions', 'Percorso a piedi con tempo, scale e salita'],
    ['home', 'Casa: salva dove alloggi e torna lì'],
    ['my_location', 'La tua posizione col GPS'],
    ['zoom_out_map', 'Rimetti la vista se ti perdi'],
    ['layers', 'Foto 3D o mappa semplice, colori delle vie'],
    ['streetview', 'Street View: foto a 360° di Google'],
    ['share', 'Condividi un punto o un percorso'],
  ]
  return (
    <div className="campi guida">
      <ul className="guida-voci">{voci.map(([n, x]) => <li key={n}><Icona n={n} /><span>{tr(x)}</span></li>)}</ul>
      {mod && <details><summary>Per chi modifica</summary>
        <ul>
          <li>Disegnare: scegli uno strumento e tocca la mappa; doppio clic, Invio o «Fine» chiudono, Esc annulla.</li>
          <li>Modificare: tocca un oggetto e cambia i valori; Canc lo elimina, Ctrl+Z annulla.</li>
          <li>Vie: correggi il tracciato sul satellite, anche più punti insieme. Eventi: si vedono solo mentre sono in corso.</li>
          <li>QR: dal percorso, «Crea QR da stampare».</li>
        </ul>
      </details>}
      <details><summary>{tr('Fonti dei dati')}</summary>
        <p className="nota">Google Map Tiles ({tr('solo da guardare')}) · TINITALY 1.1 INGV (CC BY 4.0) · LiDAR 2 m PST-A · © OpenStreetMap (ODbL) · Esri</p>
      </details>
      <p className="nota">{tr('Tempi e quote sono indicativi: in paese ci sono molte scale, calcola qualche minuto in più.')}</p>
      <p className="nota"><a href={'/privacy' + (s.lingua === 'en' ? '#en' : '')} target="_blank" rel="noopener">{tr('Privacy')}</a> · <a href={'/termini' + (s.lingua === 'en' ? '#en' : '')} target="_blank" rel="noopener">{tr('Termini d\'uso')}</a></p>
    </div>
  )
}

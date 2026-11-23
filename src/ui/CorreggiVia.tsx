import { useEffect, useState } from 'react'
import { useS } from '../store'
import { anteprimaVia, correzioneVia, elencoVie, ricaricaCorrezioni, viaOriginale, GRUPPI_VIE } from '../scene/contesto'
import { apriCorrezione, chiudiCorrezione, sceltaMultipla, avviaRiquadro, fineRiquadro, trascinoMorbido } from '../scene/correggiVia'
import { chiama } from './Pubblico'
import { inquadra } from '../scene/viewer'
import { quota } from '../scene/terreno'
import { Icona } from './Icona'
import type { LL } from '../engine/geo'

const TIPI: Record<string, string> = { primary: 'Statale', tertiary: 'Strada', unclassified: 'Strada', residential: 'Strada', service: 'Accesso', living_street: 'Accesso', pedestrian: 'Via pedonale', footway: 'Vicolo', steps: 'Scale', path: 'Sentiero', track: 'Mulattiera' }

/** Pannello per correggere una via a mano: punti trascinabili sul satellite, quota delle arcate, «controllata». */
export function CorreggiVia() {
  const s = useS()
  const id = s.selVia
  const orig = id ? viaOriginale(id) : undefined
  const corr = id ? correzioneVia(id) : undefined
  const b = s.viaBozza ?? (orig ? { c: corr?.c ?? orig.c, dz: corr?.dz ?? 0, controllata: corr ? !!corr.controllata : false } : null)
  // chi sposta i punti la sta controllando: «controllata» si accende da sola alla prima modifica
  const [lavoro, setLavoro] = useState(false)
  const imposta = (x: Partial<NonNullable<typeof b>>) => b && s.set({ viaBozza: { ...b, ...x } })
  // maniglie sui punti; mentre si trascina la via si ridisegna subito
  useEffect(() => {
    if (!id || !b) { chiudiCorrezione(); return }
    apriCorrezione(b.c, s.viaSel, (c, fine) => { anteprimaVia(id, c, b.dz); if (fine) useS.setState(st => ({ viaBozza: { ...(st.viaBozza ?? b), c, controllata: true } })) }, sel => useS.setState({ viaSel: sel }))
  }, [id, b?.c, b?.dz, s.viaSel.join()])
  const [multi, setMulti] = useState(false)
  const [riq, setRiq] = useState(false)
  useEffect(() => { sceltaMultipla(multi) }, [multi])
  const [morbido, setMorbido] = useState(30)
  useEffect(() => { trascinoMorbido(morbido) }, [morbido])
  useEffect(() => () => { sceltaMultipla(false); fineRiquadro() }, [])
  useEffect(() => () => chiudiCorrezione(), [])
  // scelta una via, la si inquadra dall'alto (la foto si legge meglio in pianta)
  useEffect(() => { if (id && b) inquadra(b.c, quota(b.c[0][0], b.c[0][1]), 0, -80) }, [id])
  const fatte = elencoVie().filter(v => v.controllata).length, tutte = elencoVie().length
  if (!id || !orig || !b) return (
    <div className="campi">
      <p>Tocca una via sulla mappa per correggerla. Durante la correzione la mappa è il satellite Esri: Google 3D non si può ricalcare.</p>
      <p className="nota">Vie controllate: <b>{fatte}</b> su {tutte}.</p>
      <p className="nota">Le correzioni le vedono tutti e migliorano anche i percorsi. Le quote vengono dal LiDAR del punto più vicino; sulle strade su arcate aggiungi i metri in più.</p>
    </div>
  )
  const sel = s.viaSel.filter(i => i < b.c.length)
  const cambiaPunti = (c: LL[], nuovaSel: number[]) => { s.set({ viaBozza: { ...b, c, controllata: true }, viaSel: nuovaSel }); anteprimaVia(id, c, b.dz) }
  // aggiunge un punto a metà del lato dopo l'ultimo scelto (o alla fine)
  const aggiungi = () => {
    const i = sel.length ? Math.min(sel[sel.length - 1], b.c.length - 2) : b.c.length - 2, a = b.c[i], c = b.c[i + 1]
    cambiaPunti([...b.c.slice(0, i + 1), [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], ...b.c.slice(i + 1)], [i + 1])
  }
  const togli = () => { if (!sel.length || b.c.length - sel.length < 2) return; cambiaPunti(b.c.filter((_, i) => !sel.includes(i)), []) }
  // tutti i punti fra il primo e l'ultimo scelto
  const intervallo = () => { if (sel.length < 2) return; const x: number[] = []; for (let i = sel[0]; i <= sel[sel.length - 1]; i++) x.push(i); s.set({ viaSel: x }) }
  // mette i punti scelti in fila sulla retta fra il primo e l'ultimo, distribuiti come prima (per i tratti dritti)
  const raddrizza = () => {
    if (sel.length < 3) return
    const i0 = sel[0], i1 = sel[sel.length - 1], A = b.c[i0], B = b.c[i1]
    const lung: number[] = [0]
    for (let i = i0 + 1; i <= i1; i++) lung.push(lung[lung.length - 1] + Math.hypot((b.c[i][0] - b.c[i - 1][0]) * 84560, (b.c[i][1] - b.c[i - 1][1]) * 111030))
    const tot = lung[lung.length - 1] || 1
    cambiaPunti(b.c.map((p, i) => (i > i0 && i < i1 && sel.includes(i) ? [A[0] + (B[0] - A[0]) * lung[i - i0] / tot, A[1] + (B[1] - A[1]) * lung[i - i0] / tot] as LL : p)), sel)
  }
  // ammorbidisce le curve dei punti scelti (media con i vicini), per le curve fatte a scalini
  const liscia = () => {
    if (!sel.length) return
    cambiaPunti(b.c.map((p, i) => (sel.includes(i) && i > 0 && i < b.c.length - 1 ? [(b.c[i - 1][0] + 2 * p[0] + b.c[i + 1][0]) / 4, (b.c[i - 1][1] + 2 * p[1] + b.c[i + 1][1]) / 4] as LL : p)), sel)
  }
  const salva = async () => {
    setLavoro(true)
    try { await chiama('vie/' + id, 'PUT', { c: b.c, dz: b.dz, controllata: b.controllata }); await ricaricaCorrezioni(); s.set({ viaBozza: null }); s.dici('Via salvata: la vedono tutti') }
    catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  const comEra = async () => {
    setLavoro(true)
    try { await chiama('vie/' + id, 'DELETE'); await ricaricaCorrezioni(); s.set({ viaBozza: null, viaSel: [] }); s.dici('Tornata come su OpenStreetMap') }
    catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  const annulla = () => { anteprimaVia(id, null); s.set({ viaBozza: null, viaSel: [] }) }
  const gruppo = GRUPPI_VIE.find(g => g.tipi.includes(orig.k))
  return (
    <div className="campi">
      <p><b>{orig.n ?? TIPI[orig.k] ?? 'Via senza nome'}</b> <small>· {TIPI[orig.k] ?? orig.k}{gruppo ? '' : ''} · {b.c.length} punti{corr ? ' · corretta' : ''}</small></p>
      <p className="nota">Trascina i punti numerati sulla strada vera della foto. Con «Più punti» tocchi quelli da spostare insieme, o li prendi col riquadro.</p>
      <label className="riga-morbido" data-tip="Trascinando un punto, i vicini lo seguono sempre meno fino a questa distanza: le curve restano archi">Trascina con sé i vicini
        <select value={morbido} onChange={e => setMorbido(Number(e.target.value))}>
          <option value={0}>No, solo il punto</option><option value={15}>fino a 15 m</option><option value={30}>fino a 30 m</option><option value={60}>fino a 60 m</option><option value={120}>fino a 120 m</option>
        </select>
      </label>
      <div className="riga-bottoni">
        <button className={multi ? 'acceso' : ''} aria-pressed={multi} onClick={() => { setMulti(!multi); if (multi) s.set({ viaSel: sel.slice(-1) }) }}><Icona n="add" />Più punti</button>
        <button className={riq ? 'acceso' : ''} aria-pressed={riq} onClick={() => { if (riq) { fineRiquadro(); setRiq(false) } else { setMulti(true); setRiq(true); avviaRiquadro(() => setRiq(false)) } }}>Riquadro</button>
        <button onClick={() => { setMulti(true); s.set({ viaSel: b.c.map((_, i) => i) }) }}>Tutti</button>
        {sel.length > 0 && <button className="quiet" onClick={() => s.set({ viaSel: [] })}>Nessuno</button>}
      </div>
      {riq && <p className="nota">Trascina sulla mappa un rettangolo attorno ai punti.</p>}
      <p className="nota"><b>{sel.length}</b> {sel.length === 1 ? 'punto scelto' : 'punti scelti'}{sel.length ? ': ' + (sel.length > 6 ? `${sel[0] + 1}…${sel[sel.length - 1] + 1}` : sel.map(i => i + 1).join(', ')) : ''}</p>
      <div className="riga-bottoni">
        <button disabled={sel.length < 2} onClick={intervallo} data-tip="Sceglie anche tutti quelli fra il primo e l'ultimo">Intervallo</button>
        <button disabled={sel.length < 3} onClick={raddrizza} data-tip="Mette i punti in fila fra il primo e l'ultimo scelto">Raddrizza</button>
        <button disabled={!sel.length} onClick={liscia} data-tip="Ammorbidisce le curve fatte a scalini">Liscia</button>
        <button onClick={aggiungi}><Icona n="add" />Aggiungi</button>
        <button className="danger" disabled={!sel.length || b.c.length - sel.length < 2} onClick={togli}>Togli {sel.length > 1 ? `i ${sel.length} punti` : 'il punto'}</button>
      </div>
      <label>Metri sopra il terreno (strade su arcate, ponti)
        <input type="number" step={0.5} min={-20} max={30} value={b.dz} onChange={e => { const dz = Number(e.target.value) || 0; imposta({ dz }); anteprimaVia(id, b.c, dz) }} />
      </label>
      <label className="riga"><span>Controllata<small>La forma combacia con la strada vera</small></span><input type="checkbox" checked={b.controllata} onChange={e => imposta({ controllata: e.target.checked })} /></label>
      <div className="riga-bottoni">
        <button className="primary" disabled={lavoro} onClick={salva}>Salva</button>
        {s.viaBozza && <button className="quiet" onClick={annulla}>Annulla le modifiche</button>}
        {corr && <button className="quiet danger" disabled={lavoro} onClick={comEra}>Torna come su OSM</button>}
      </div>
      <p className="nota">Vie controllate: <b>{fatte}</b> su {tutte}.</p>
    </div>
  )
}

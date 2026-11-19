import { useEffect, useState } from 'react'
import { useS } from '../store'
import { anteprimaVia, correzioneVia, elencoVie, ricaricaCorrezioni, viaOriginale, GRUPPI_VIE } from '../scene/contesto'
import { apriCorrezione, chiudiCorrezione } from '../scene/correggiVia'
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
    apriCorrezione(b.c, s.viaVSel, (c, fine) => { anteprimaVia(id, c, b.dz); if (fine) useS.setState(st => ({ viaBozza: { ...(st.viaBozza ?? b), c, controllata: true } })) }, i => useS.setState({ viaVSel: i }))
  }, [id, b?.c, b?.dz, s.viaVSel])
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
  const v = s.viaVSel
  const aggiungi = () => {
    const i = v ?? b.c.length - 2, a = b.c[i], c = b.c[i + 1] ?? b.c[i - 1]
    const nuovi: LL[] = [...b.c.slice(0, i + 1), [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], ...b.c.slice(i + 1)]
    s.set({ viaBozza: { ...b, c: nuovi }, viaVSel: i + 1 }); anteprimaVia(id, nuovi, b.dz)
  }
  const togli = () => {
    if (v === null || b.c.length <= 2) return
    const nuovi = b.c.filter((_, i) => i !== v)
    s.set({ viaBozza: { ...b, c: nuovi }, viaVSel: null }); anteprimaVia(id, nuovi, b.dz)
  }
  const salva = async () => {
    setLavoro(true)
    try { await chiama('vie/' + id, 'PUT', { c: b.c, dz: b.dz, controllata: b.controllata }); await ricaricaCorrezioni(); s.set({ viaBozza: null }); s.dici('Via salvata: la vedono tutti') }
    catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  const comEra = async () => {
    setLavoro(true)
    try { await chiama('vie/' + id, 'DELETE'); await ricaricaCorrezioni(); s.set({ viaBozza: null, viaVSel: null }); s.dici('Tornata come su OpenStreetMap') }
    catch (e) { s.dici((e as Error).message) } finally { setLavoro(false) }
  }
  const annulla = () => { anteprimaVia(id, null); s.set({ viaBozza: null, viaVSel: null }) }
  const gruppo = GRUPPI_VIE.find(g => g.tipi.includes(orig.k))
  return (
    <div className="campi">
      <p><b>{orig.n ?? TIPI[orig.k] ?? 'Via senza nome'}</b> <small>· {TIPI[orig.k] ?? orig.k}{gruppo ? '' : ''} · {b.c.length} punti{corr ? ' · corretta' : ''}</small></p>
      <p className="nota">Trascina i punti numerati sulla strada vera della foto. Tocca un punto per sceglierlo.</p>
      <div className="riga-bottoni">
        <button onClick={aggiungi}><Icona n="add" />Aggiungi punto{v !== null ? ` dopo il ${v + 1}` : ''}</button>
        <button className="danger" disabled={v === null || b.c.length <= 2} onClick={togli}>Togli il punto{v !== null ? ' ' + (v + 1) : ''}</button>
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

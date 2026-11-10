import { useState } from 'react'
import { useS } from '../store'
import type { Obj } from '../engine/model'
import type { LL } from '../engine/geo'
import { azimutLato, inserisci, lati, locali, lunghezzaLato, muoviPunto, r2, ruota, squadra, togliPunto, trasla } from '../engine/modifica'

const CHIUSI = new Set(['area', 'volume', 'piazza'])
const MINIMO: Record<string, number> = { area: 3, volume: 3, piazza: 3, linea: 2, stalli: 2, barriera: 2, zebra: 2, arresto: 2 }
const FISSI = new Set(['zebra', 'arresto']) // sempre due punti
const PASSI: [number, string][] = [[0, 'Libero'], [0.01, '1 cm'], [0.05, '5 cm'], [0.1, '10 cm'], [0.5, '50 cm'], [1, '1 m']]

/** Campo numerico che conferma con Invio o uscendo: mentre scrivi non sposta niente. */
function Num({ v, set, passo, largo }: { v: number; set: (n: number) => void; passo: number; largo?: boolean }) {
  const [t, setT] = useState<string | null>(null)
  const conferma = () => { if (t !== null) { const n = Number(t.replace(',', '.')); if (isFinite(n) && n !== v) set(n); setT(null) } }
  return <input className={largo ? 'num largo' : 'num'} inputMode="decimal" value={t ?? r2(v).toFixed(2).replace('.', ',')} onChange={e => setT(e.target.value)} onBlur={conferma}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); else if (e.key === 'Escape') setT(null); else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); set(r2(v + (e.key === 'ArrowUp' ? 1 : -1) * (passo || 0.01) * (e.shiftKey ? 10 : 1))) } }} />
}

export function Geometria({ o }: { o: Obj }) {
  const s = useS()
  const [de, setDe] = useState(0), [dn, setDn] = useState(0), [gr, setGr] = useState(0)
  const chiuso = CHIUSI.has(o.tipo), n = o.pts.length
  const xy = locali(o.pts), ls = n > 1 ? lati(o.pts, chiuso) : []
  const cambia = (pts: LL[]) => s.aggiorna(o.id, x => { x.pts = pts })
  const min = MINIMO[o.tipo] ?? 1
  return (
    <div className="geometria">
      <h3>Geometria</h3>
      <label className="riga"><span>Passo<small>Vale per trascinamento, frecce e campi</small></span>
        <select value={s.passo} onChange={e => s.set({ passo: Number(e.target.value) })}>{PASSI.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      </label>
      <p className="nota">Punto 1: {o.pts[0][1].toFixed(6)}, {o.pts[0][0].toFixed(6)}. Le misure sono in metri dal punto 1, verso est e verso nord.</p>
      {n > 1 && (
        <table className="punti">
          <thead><tr><th>N.</th><th>Est</th><th>Nord</th><th>Lato</th><th>Dir.</th><th></th></tr></thead>
          <tbody>{o.pts.map((_, i) => (
            <tr key={i} className={s.vSel === i ? 'scelto' : ''} onClick={() => s.set({ vSel: i })}>
              <td>{i + 1}</td>
              <td>{i === 0 ? '0' : <Num v={xy[i][0]} passo={s.passo} set={v => cambia(muoviPunto(o.pts, i, v, xy[i][1]))} />}</td>
              <td>{i === 0 ? '0' : <Num v={xy[i][1]} passo={s.passo} set={v => cambia(muoviPunto(o.pts, i, xy[i][0], v))} />}</td>
              <td>{ls[i] ? <Num v={ls[i].l} passo={s.passo} set={v => cambia(lunghezzaLato(o.pts, i, v))} /> : ''}</td>
              <td>{ls[i] ? <Num v={ls[i].az} passo={1} set={v => cambia(azimutLato(o.pts, i, v))} /> : ''}</td>
              <td className="azioni-punto">
                {!FISSI.has(o.tipo) && ls[i] && <button className="quiet" onClick={e => { e.stopPropagation(); cambia(inserisci(o.pts, i)) }} data-tip="Aggiungi un punto a metà di questo lato" aria-label="Aggiungi punto">＋</button>}
                {chiuso && <button className="quiet" onClick={e => { e.stopPropagation(); cambia(squadra(o.pts, i)) }} data-tip="Metti in squadra: 90° in questo punto" aria-label="In squadra">∟</button>}
                {!FISSI.has(o.tipo) && n > min && <button className="quiet danger" onClick={e => { e.stopPropagation(); cambia(togliPunto(o.pts, i, min)); s.set({ vSel: null }) }} data-tip="Togli questo punto" aria-label="Togli punto">✕</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {n > 1 && <p className="nota">«Lato» è la misura dal punto al successivo, «Dir.» la sua direzione in gradi da nord. Cambiandoli si muove il punto successivo.</p>}
      <div className="sposta">
        <label>Est (m)<Num v={de} passo={s.passo} set={setDe} largo /></label>
        <label>Nord (m)<Num v={dn} passo={s.passo} set={setDn} largo /></label>
        <button onClick={() => { if (de || dn) cambia(trasla(o.pts, de, dn)) }}>Sposta</button>
      </div>
      {n > 1 && <div className="sposta">
        <label>Gradi (orari)<Num v={gr} passo={1} set={setGr} largo /></label>
        <button onClick={() => { if (gr) cambia(ruota(o.pts, gr)) }}>Ruota</button>
        <span className="nota">attorno al centro</span>
      </div>}
      <p className="nota">Con le frecce della tastiera sposti di un passo l'oggetto, o il punto scelto nella tabella. Maiusc: dieci passi.</p>
    </div>
  )
}

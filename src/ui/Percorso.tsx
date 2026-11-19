import { t as tr, linguaAttuale } from '../i18n'
import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { Icona } from './Icona'
import type { NomeIcona } from './icone'
import { elencoPoi } from '../scene/poi'
import { useS } from '../store'
import { cerca } from '../scene/contesto'
import { confrontoMezzi, minutiTesto, tappaInLink, type Percorso, type Tappa } from '../engine/percorso'

const m = (x: number) => Math.round(x).toLocaleString(linguaAttuale() === 'en' ? 'en-GB' : 'it-IT')
const nomeDi = (t: Tappa | null) => t?.nome || (t ? `Punto ${t.p[1].toFixed(5)}, ${t.p[0].toFixed(5)}` : '')

export function linkPercorso(da: Tappa | null, a: Tappa | null) {
  const u = new URL(location.origin + '/')
  if (da) u.searchParams.set('da', tappaInLink(da))
  if (a) u.searchParams.set('a', tappaInLink(a))
  return u.toString()
}

/** Scheda del percorso a piedi da A a B. Dal link (ospite) mostra solo il percorso. */
const NOME_CRITERIO: Record<string, string> = { veloce: 'Più veloce', scale: 'Meno scale', salita: 'Meno salita' }
const ICONA_MEZZO: Record<string, NomeIcona> = { piedi: 'directions_walk', bus: 'directions_bus', auto: 'directions_car' }
const NOME_MEZZO: Record<string, string> = { piedi: 'A piedi', bus: 'Bus', auto: 'Auto' }
const fermate = () => elencoPoi().filter(p => p.c === 'fermate' && !p.nascosto).map(p => p.p)

export function SchedaPercorso({ calc, opzioni, scelta, scegli, esci }: { calc: Percorso | null; opzioni: Percorso[]; scelta: number; scegli: (i: number) => void; esci: () => void }) {
  const s = useS()
  const r = s.percorso
  const set = (p: Partial<typeof r>) => s.set({ percorso: { ...r, ...p } })
  const [qr, setQr] = useState<string | null>(null)
  const [chiuso, setChiuso] = useState(false)
  // dal QR si vede subito il risultato; partenza e arrivo si cambiano a richiesta
  const [cambia, setCambia] = useState(!s.ospite || !r.da || !r.a)
  const link = linkPercorso(r.da, r.a)
  useEffect(() => { setQr(null) }, [link])

  const posizione = () => {
    if (!navigator.geolocation) { s.dici(tr('Questo telefono non dà la posizione')); return }
    navigator.geolocation.getCurrentPosition(
      g => {
        const p: [number, number] = [g.coords.longitude, g.coords.latitude]
        if (Math.abs(p[0] - 14.49) > 0.05 || Math.abs(p[1] - 40.625) > 0.04) { s.dici(tr('Sei fuori Positano: scegli la partenza sulla mappa')); return }
        set({ da: { p, nome: tr('La mia posizione') }, scegli: null })
      },
      () => s.dici(tr('Posizione non disponibile: scegli la partenza sulla mappa')),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }
  const faiQr = async () => {
    const c = document.createElement('canvas'), L = 1200
    c.width = L; c.height = L + 300
    const g = c.getContext('2d')!
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height)
    const q = document.createElement('canvas')
    await QRCode.toCanvas(q, link, { width: L - 160, margin: 0, errorCorrectionLevel: 'M' })
    g.drawImage(q, 80, 200)
    g.fillStyle = '#10243a'; g.textAlign = 'center'
    g.font = '600 64px system-ui, sans-serif'; g.fillText(r.a?.nome ? `${tr('Come arrivare a')} ${r.a.nome}` : tr('Come arrivare'), L / 2, 110, L - 80)
    g.font = '400 40px system-ui, sans-serif'; g.fillStyle = '#4a5b6c'
    if (calc) g.fillText(`A piedi ${minutiTesto(calc.minuti)} · ${m(calc.metri)} m${r.da?.nome ? ' da ' + r.da.nome : ''}`, L / 2, 170, L - 80)
    g.fillText(tr('Inquadra il codice: si apre la mappa 3D con il percorso'), L / 2, L + 210, L - 80)
    setQr(c.toDataURL('image/png'))
  }
  const copia = async () => { try { await navigator.clipboard.writeText(link); s.dici(tr('Link copiato')) } catch { s.dici(tr('Copia non riuscita: tieni premuto sul link')) } }

  if (chiuso && s.ospite) return <button className="scheda-percorso riapri" onClick={() => setChiuso(false)}>{calc ? `${minutiTesto(calc.minuti)} ${tr('a piedi')}` : tr('Percorso')}</button>
  return (
    <section className="scheda-percorso" aria-label={tr('Percorso a piedi')}>
      <div className="pannello-testa">
        <h2>{s.ospite && r.a?.nome ? r.a.nome : tr('Percorso a piedi')}</h2>
        <button className="tondo quiet" onClick={() => (s.ospite ? setChiuso(true) : esci())} aria-label={tr(s.ospite ? 'Riduci' : 'Chiudi')}><Icona n="close" /></button>
      </div>
      {!cambia && (
        <div className="tratta">
          <p><span className="lettera">A</span>{nomeDi(r.da)}</p>
          <p><span className="lettera b">B</span>{nomeDi(r.a)}</p>
          <button className="quiet" onClick={() => setCambia(true)}>{tr('Cambia partenza o arrivo')}</button>
        </div>
      )}
      {cambia && <>
      <RigaTappa titolo="Da" t={r.da} scegli={r.scegli === 'da'} onScegli={() => set({ scegli: r.scegli === 'da' ? null : 'da' })} onCambia={t => set({ da: t, scegli: r.a ? null : 'a' })} extra={<><button className="quiet" onClick={posizione} data-tip={tr('Parti da dove sei adesso')}><Icona n="my_location" />{tr('Da qui')}</button>{s.casa && <button className="quiet" onClick={() => set({ da: s.casa, scegli: r.a ? null : 'a' })}><Icona n="home" />{tr('Da Casa')}</button>}</>} ospite={s.ospite} />
      <RigaTappa titolo="A" t={r.a} scegli={r.scegli === 'a'} onScegli={() => set({ scegli: r.scegli === 'a' ? null : 'a' })} onCambia={t => set({ a: t, scegli: r.da ? null : 'da' })} extra={s.casa ? <button className="quiet" onClick={() => set({ a: s.casa, scegli: r.da ? null : 'da' })}><Icona n="home" />{tr('A Casa')}</button> : undefined} ospite={s.ospite} />
      {r.da && r.a && <button className="quiet inverti" onClick={() => set({ da: r.a, a: r.da })} data-tip={tr('Scambia partenza e arrivo')}><Icona n="swap_vert" />{tr('Inverti')}</button>}
      </>}
      {r.scegli && <p className="nota">{tr(r.scegli === 'da' ? 'Tocca la mappa per scegliere la partenza.' : 'Tocca la mappa per scegliere l\'arrivo.')}</p>}
      {r.da && r.a && (calc ? (
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
          <button className="quiet" onClick={() => s.set({ vista360: { modo: 'percorso', pts: calc.pts.map(p => [p[0], p[1]] as [number, number]), titolo: r.a?.nome } })}><Icona n="streetview" />{tr('Guarda il percorso')}</button>
          <div className="cifre">
            <span><Icona n="schedule" /><b>{minutiTesto(calc.minuti)}</b><small>{tr('ritorno')} {minutiTesto(calc.ritorno)}</small></span>
            <span><Icona n="route" /><b>{m(calc.metri)} m</b><small>{tr('a piedi')}</small></span>
            <span><Icona n="stairs" /><b>{calc.gradini > 20 ? '~' + m(Math.round(calc.gradini / 10) * 10) : '0'}</b><small>{tr('gradini')}</small></span>
            <span><Icona n="trending_up" /><b>{m(calc.salita)} m</b><small>{tr('salita')} · {m(calc.discesa)} m {tr('discesa')}</small></span>
          </div>
          {(() => { const mz = r.da && r.a ? confrontoMezzi(calc, fermate(), r.da.p, r.a.p) : []; return mz.length > 1 && (
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
      {!s.ospite && r.a && (
        <div className="condividi">
          <h3>{tr('Link e QR')}</h3>
          <p className="nota">{tr('Chi lo apre vede solo questo percorso. Dai un nome alla partenza e all\'arrivo: compare sul cartello.')}</p>
          <div className="riga-bottoni"><button onClick={copia}>{tr('Copia link')}</button><button className="primary" onClick={faiQr}>{tr('Crea QR da stampare')}</button></div>
          {qr && <><img className="qr" src={qr} alt={`QR del percorso verso ${nomeDi(r.a)}`} /><a className="bottone" href={qr} download={`percorso-${(r.a.nome || 'arrivo').replace(/\W+/g, '-').toLowerCase()}.png`}>{tr('Scarica l\'immagine')}</a></>}
        </div>
      )}
    </section>
  )
}

function RigaTappa({ titolo, t, scegli, onScegli, onCambia, extra, ospite }: { titolo: string; t: Tappa | null; scegli: boolean; onScegli: () => void; onCambia: (t: Tappa) => void; extra?: ReactNode; ospite: boolean }) {
  const [q, setQ] = useState('')
  const ris = q ? cerca(q) : []
  return (
    <div className="tappa">
      <span className="lettera" aria-label={tr(titolo === 'Da' ? 'Partenza' : 'Arrivo')}>{titolo === 'Da' ? 'A' : 'B'}</span>
      <div className="tappa-corpo">
        {t && !ospite && <input value={t.nome ?? ''} placeholder={nomeDi(t)} onChange={e => onCambia({ ...t, nome: e.target.value.slice(0, 60) || undefined })} aria-label={`Nome ${titolo === 'Da' ? 'della partenza' : 'dell\'arrivo'}`} />}
        {t && ospite && <b>{nomeDi(t)}</b>}
        <div className="cerca">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr(t ? 'Cambia: cerca via o luogo' : 'Cerca via o luogo')} aria-label={`Cerca ${titolo === 'Da' ? 'la partenza' : 'l\'arrivo'}`} />
          {ris.length > 0 && <ul className="risultati">{ris.map(x => <li key={x.nome + x.tipo}><button onClick={() => { onCambia({ p: x.p, nome: x.nome }); setQ('') }}>{x.nome} <small>{x.tipo}</small></button></li>)}</ul>}
        </div>
        <div className="riga-bottoni">
          <button className={'quiet' + (scegli ? ' acceso' : '')} onClick={onScegli} aria-pressed={scegli}>{tr('Scegli sulla mappa')}</button>
          {extra}
        </div>
      </div>
    </div>
  )
}

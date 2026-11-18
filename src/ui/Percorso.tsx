import { useEffect, useState, type ReactNode } from 'react'
import QRCode from 'qrcode'
import { useS } from '../store'
import { cerca } from '../scene/contesto'
import { minutiTesto, tappaInLink, type Percorso, type Tappa } from '../engine/percorso'

const m = (x: number) => Math.round(x).toLocaleString('it-IT')
const nomeDi = (t: Tappa | null) => t?.nome || (t ? `Punto ${t.p[1].toFixed(5)}, ${t.p[0].toFixed(5)}` : '')

export function linkPercorso(da: Tappa | null, a: Tappa | null) {
  const u = new URL(location.origin + '/')
  if (da) u.searchParams.set('da', tappaInLink(da))
  if (a) u.searchParams.set('a', tappaInLink(a))
  return u.toString()
}

/** Scheda del percorso a piedi da A a B. Dal link (ospite) mostra solo il percorso. */
export function SchedaPercorso({ calc, esci }: { calc: Percorso | null; esci: () => void }) {
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
    if (!navigator.geolocation) { s.dici('Questo telefono non dà la posizione'); return }
    navigator.geolocation.getCurrentPosition(
      g => {
        const p: [number, number] = [g.coords.longitude, g.coords.latitude]
        if (Math.abs(p[0] - 14.49) > 0.05 || Math.abs(p[1] - 40.625) > 0.04) { s.dici('Sei fuori Positano: scegli la partenza sulla mappa'); return }
        set({ da: { p, nome: 'La mia posizione' }, scegli: null })
      },
      () => s.dici('Posizione non disponibile: scegli la partenza sulla mappa'),
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
    g.font = '600 64px system-ui, sans-serif'; g.fillText(r.a?.nome ? `Come arrivare a ${r.a.nome}` : 'Come arrivare', L / 2, 110, L - 80)
    g.font = '400 40px system-ui, sans-serif'; g.fillStyle = '#4a5b6c'
    if (calc) g.fillText(`A piedi ${minutiTesto(calc.minuti)} · ${m(calc.metri)} m${r.da?.nome ? ' da ' + r.da.nome : ''}`, L / 2, 170, L - 80)
    g.fillText('Inquadra il codice: si apre la mappa 3D con il percorso', L / 2, L + 210, L - 80)
    setQr(c.toDataURL('image/png'))
  }
  const copia = async () => { try { await navigator.clipboard.writeText(link); s.dici('Link copiato') } catch { s.dici('Copia non riuscita: tieni premuto sul link') } }

  if (chiuso && s.ospite) return <button className="scheda-percorso riapri" onClick={() => setChiuso(false)}>{calc ? `${minutiTesto(calc.minuti)} a piedi` : 'Percorso'}</button>
  return (
    <section className="scheda-percorso" aria-label="Percorso a piedi">
      <div className="pannello-testa">
        <h2>{s.ospite && r.a?.nome ? r.a.nome : 'Percorso a piedi'}</h2>
        <button className="quiet" onClick={() => (s.ospite ? setChiuso(true) : esci())} aria-label={s.ospite ? 'Riduci' : 'Chiudi'}>{s.ospite ? '▾' : '✕'}</button>
      </div>
      {!cambia && (
        <div className="tratta">
          <p><span className="lettera">A</span>{nomeDi(r.da)}</p>
          <p><span className="lettera b">B</span>{nomeDi(r.a)}</p>
          <button className="quiet" onClick={() => setCambia(true)}>Cambia partenza o arrivo</button>
        </div>
      )}
      {cambia && <>
      <RigaTappa titolo="Da" t={r.da} scegli={r.scegli === 'da'} onScegli={() => set({ scegli: r.scegli === 'da' ? null : 'da' })} onCambia={t => set({ da: t, scegli: r.a ? null : 'a' })} extra={<button className="quiet" onClick={posizione} data-tip="Parti da dove sei adesso">📍 Da qui</button>} ospite={s.ospite} />
      <RigaTappa titolo="A" t={r.a} scegli={r.scegli === 'a'} onScegli={() => set({ scegli: r.scegli === 'a' ? null : 'a' })} onCambia={t => set({ a: t, scegli: r.da ? null : 'da' })} ospite={s.ospite} />
      {r.da && r.a && <button className="quiet inverti" onClick={() => set({ da: r.a, a: r.da })} data-tip="Scambia partenza e arrivo">⇅ Inverti</button>}
      </>}
      {r.scegli && <p className="nota">Tocca la mappa per scegliere {r.scegli === 'da' ? 'la partenza' : 'l\'arrivo'}.</p>}
      {r.da && r.a && (calc ? (
        <div className="esito">
          <p className="tempo"><b>{minutiTesto(calc.minuti)}</b> a piedi <span>· ritorno {minutiTesto(calc.ritorno)}</span></p>
          <p>{m(calc.metri)} m · in salita {m(calc.salita)} m · in discesa {m(calc.discesa)} m{calc.gradini > 20 ? ` · circa ${m(Math.round(calc.gradini / 10) * 10)} gradini` : ''}</p>
          {calc.nomi.length > 0 && <p className="nota">Passa da {calc.nomi.slice(0, 5).join(', ')}{calc.nomi.length > 5 ? '…' : ''}</p>}
          <p className="nota">Passo tranquillo, con salite e scale (regola DIN 33466 sulle quote LiDAR). Stima da verificare.</p>
        </div>
      ) : <p className="nota">Nessun percorso trovato: scegli punti vicino a una via o a una scala.</p>)}
      {!s.ospite && r.a && (
        <div className="condividi">
          <h3>Link e QR</h3>
          <p className="nota">Chi lo apre vede solo questo percorso. Dai un nome alla partenza e all'arrivo: compare sul cartello.</p>
          <div className="riga-bottoni"><button onClick={copia}>Copia link</button><button className="primary" onClick={faiQr}>Crea QR da stampare</button></div>
          {qr && <><img className="qr" src={qr} alt={`QR del percorso verso ${nomeDi(r.a)}`} /><a className="bottone" href={qr} download={`percorso-${(r.a.nome || 'arrivo').replace(/\W+/g, '-').toLowerCase()}.png`}>Scarica l'immagine</a></>}
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
      <span className="lettera" aria-label={titolo === 'Da' ? 'Partenza' : 'Arrivo'}>{titolo === 'Da' ? 'A' : 'B'}</span>
      <div className="tappa-corpo">
        {t && !ospite && <input value={t.nome ?? ''} placeholder={nomeDi(t)} onChange={e => onCambia({ ...t, nome: e.target.value.slice(0, 60) || undefined })} aria-label={`Nome ${titolo === 'Da' ? 'della partenza' : 'dell\'arrivo'}`} />}
        {t && ospite && <b>{nomeDi(t)}</b>}
        <div className="cerca">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={t ? 'Cambia: cerca via o luogo' : 'Cerca via o luogo'} aria-label={`Cerca ${titolo === 'Da' ? 'la partenza' : 'l\'arrivo'}`} />
          {ris.length > 0 && <ul className="risultati">{ris.map(x => <li key={x.nome + x.tipo}><button onClick={() => { onCambia({ p: x.p, nome: x.nome }); setQ('') }}>{x.nome} <small>{x.tipo}</small></button></li>)}</ul>}
        </div>
        <div className="riga-bottoni">
          <button className={'quiet' + (scegli ? ' acceso' : '')} onClick={onScegli} aria-pressed={scegli}>Scegli sulla mappa</button>
          {extra}
        </div>
      </div>
    </div>
  )
}

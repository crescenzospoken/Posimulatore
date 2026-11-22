// Pannello dello strumento «Allinea» (editor): le vie si trascinano tutte insieme, a piombo sul 3D di Google, finché
// combaciano; ogni trascinamento salva un punto di controllo che vale per quella zona e si raccorda con le altre.
import { useEffect, useState } from 'react'
import { useS } from '../store'
import { Icona } from './Icona'
import { chiama } from './Pubblico'
import { puntiManuali, ricaricaManuali, type Manuale } from '../scene/allinea'
import { ridisegnaVie, anteprimaSpostamento } from '../scene/contesto'
import { trascinaLinee, aPiombo } from '../scene/allineaStrumento'
import { impostaVoci } from '../scene/sovrapposti'
import { pos, quotaGoogle, vai } from '../scene/viewer'
import { quota } from '../scene/terreno'

export function Allinea() {
  const s = useS()
  const [sposta, setSposta] = useState(false)
  const [punti, setPunti] = useState<Manuale[]>(puntiManuali())
  const [sel, setSel] = useState<string | null>(null)
  const aggiorna = async () => { await ricaricaManuali(); ridisegnaVie(); setPunti([...puntiManuali()]) }
  const salva = async (p: { lon: number; lat: number; e: number; n: number }) => {
    const id = Math.random().toString(36).slice(2, 12)
    try { await chiama('allinea/' + id, 'PUT', p); await aggiorna(); setSel(id); s.dici(`Zona allineata: ${Math.hypot(p.e, p.n).toFixed(1)} m`) }
    catch (e) { anteprimaSpostamento(0, 0, p.lon, p.lat); s.dici((e as Error).message) }
  }
  const togli = async (id: string) => { try { await chiama('allinea/' + id, 'DELETE'); setSel(null); await aggiorna() } catch (e) { s.dici((e as Error).message) } }
  useEffect(() => { trascinaLinee(sposta, salva); return () => trascinaLinee(false) }, [sposta])
  // i punti messi a mano, sulla mappa: toccandone uno lo si sceglie per toglierlo
  useEffect(() => {
    impostaVoci('all:', punti.map(p => ({ id: 'all:' + p.id, tipo: 'poi' as const, pos: pos(p.lon, p.lat, (quotaGoogle(p.lon, p.lat) ?? quota(p.lon, p.lat)) + 4), testo: `${Math.hypot(p.e, p.n).toFixed(1)} m`, icona: 'drag_indicator', col: p.id === sel ? '#c5221f' : '#e8710a', scelto: p.id === sel, maxDist: 6000, clic: () => setSel(p.id) })))
    return () => impostaVoci('all:', [])
  }, [punti, sel, s.googleGiro])
  const scelto = punti.find(p => p.id === sel)
  return (
    <div className="campi">
      {!s.livelli.google && <p className="errore-campo">Accendi il 3D di Google nei Livelli: le vie si allineano a quello che si vede lì.</p>}
      <ol className="passi">
        <li>Porta la zona al centro e premi «Vista a piombo».</li>
        <li>Accendi «Sposta le linee» e trascina: si muovono tutte insieme. Lascia quando combaciano.</li>
        <li>Ripeti dove serve: ogni trascinamento vale per quella zona (circa 100 m) e si raccorda con le altre.</li>
      </ol>
      <div className="riga-bottoni">
        <button onClick={() => aPiombo()}><Icona n="zoom_out_map" />Vista a piombo</button>
        <button className={sposta ? 'acceso' : 'primary'} aria-pressed={sposta} onClick={() => setSposta(!sposta)}><Icona n="pan_tool" />{sposta ? 'Fatto: muovi la mappa' : 'Sposta le linee'}</button>
      </div>
      <p className="nota">{sposta ? 'Ora il dito sposta le linee, non la mappa. Per cambiare zona premi «Fatto».' : 'Solo disegno sopra Google: percorsi e tempi non cambiano.'}</p>
      <h3>Punti messi a mano: {punti.length}</h3>
      {scelto ? (
        <div className="riga-bottoni">
          <span>{scelto.e.toFixed(1)} m est, {scelto.n.toFixed(1)} m nord</span>
          <button className="quiet" onClick={() => vai({ lon: scelto.lon, lat: scelto.lat - 0.0012, h: (quotaGoogle(scelto.lon, scelto.lat) ?? quota(scelto.lon, scelto.lat)) + 160, heading: 0, pitch: -50 })}>Vai</button>
          <button className="danger" onClick={() => togli(scelto.id)}>Togli questo punto</button>
        </div>
      ) : punti.length > 0 && <p className="nota">Tocca un punto arancione sulla mappa per toglierlo.</p>}
      {punti.length > 0 && !scelto && <button className="quiet" onClick={() => togli(punti[punti.length - 1].id)}>Togli l'ultimo</button>}
    </div>
  )
}

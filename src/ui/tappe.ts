// Percorso a tappe: aprirlo verso un posto, aggiungere, togliere e spostare tappe.
import { useS } from '../store'
import { ultimaPosizione, dentroPositano, avviaGps, gpsAcceso } from '../scene/gps'
import { t } from '../i18n'
import type { Tappa } from '../engine/percorso'

/** Partenza di base: la posizione se sei a Positano, altrimenti Casa. */
export function partenzaDiBase(): Tappa | null {
  const io = ultimaPosizione()
  if (io && dentroPositano(io.p)) return { p: io.p, nome: t('La mia posizione') }
  return useS.getState().casa
}
/** «Portami qui»: da dove sei adesso (GPS), salvo una partenza già scelta a mano nel percorso aperto.
 * Senza GPS, se lo neghi o sei fuori Positano: da Casa; se non c'è nemmeno Casa, si sceglie la partenza sulla mappa. */
export function portamiA(dest: Tappa) {
  const s = useS.getState(), mia = t('La mia posizione')
  const apri = (da: Tappa | null) => useS.getState().set({ strumento: { k: 'percorso' }, tappe: da ? [da, dest] : [dest], aggiungiDaMappa: !da, selPoi: null, selGoogle: null, selEvento: null, pannello: null })
  const scelta = s.strumento.k === 'percorso' && s.tappe.length >= 2 && s.tappe[0].nome !== mia ? s.tappe[0] : null
  if (scelta) return apri(scelta)
  const io = ultimaPosizione()
  if (gpsAcceso() && io && dentroPositano(io.p)) return apri({ p: io.p, nome: mia })
  if (!navigator.geolocation) return apri(s.casa)
  // si chiede la posizione (la prima volta il telefono domanda il permesso); al massimo 10 s, poi Casa
  let fatto = false
  const una = (da: Tappa | null, avviso?: string) => { if (fatto) return; fatto = true; clearTimeout(attesa); apri(da); if (avviso) useS.getState().dici(avviso) }
  const casa = () => useS.getState().casa
  const attesa = setTimeout(() => una(casa(), t(casa() ? 'Posizione non disponibile: parto da Casa' : 'Posizione non disponibile: scegli la partenza sulla mappa')), 10000)
  s.dici(t('Cerco dove sei…'))
  avviaGps(
    q => dentroPositano(q.p) ? una({ p: q.p, nome: mia }) : una(casa(), t(casa() ? 'Sei fuori Positano: parto da Casa' : 'Sei fuori Positano: scegli la partenza sulla mappa')),
    () => una(casa(), t(casa() ? 'GPS spento o non permesso: parto da Casa' : 'GPS spento o non permesso: scegli la partenza sulla mappa')),
  )
}
/** Aggiunge una tappa in fondo al percorso (e lo apre se non c'era). */
export function aggiungiTappa(x: Tappa) {
  const s = useS.getState()
  s.set({ strumento: { k: 'percorso' }, tappe: [...(s.strumento.k === 'percorso' ? s.tappe : []), x], aggiungiDaMappa: false, selPoi: null, selGoogle: null, selEvento: null, pannello: null })
}
export const lettera = (i: number) => String.fromCharCode(65 + i)

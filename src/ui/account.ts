// Dati del visitatore nell'account (Casa e luoghi salvati): all'accesso si uniscono a quelli del telefono,
// poi ogni cambio si manda al server dopo un attimo. Senza accesso restano solo nel browser.
import { useS, type Preferito } from '../store'
import { chiama } from './Pubblico'

const chiave = (x: Preferito) => x.id ?? x.p.map(n => n.toFixed(5)).join(',')
let ultimo = '', timer: ReturnType<typeof setTimeout> | undefined, pronto = false

export async function caricaMiei() {
  pronto = false
  try {
    const m = await chiama<{ casa?: Preferito | null; preferiti?: Preferito[] }>('miei')
    const st = useS.getState()
    const visti = new Set<string>(), preferiti: Preferito[] = []
    for (const x of [...(m.preferiti ?? []), ...st.preferiti]) { const k = chiave(x); if (!visti.has(k)) { visti.add(k); preferiti.push(x) } }
    st.set({ casa: m.casa ?? st.casa, preferiti })
  } catch { /* senza server */ }
  pronto = true
  manda()
}
function manda() {
  const st = useS.getState()
  if (!pronto || !st.utente) return
  const testo = JSON.stringify({ casa: st.casa, preferiti: st.preferiti })
  if (testo === ultimo) return
  clearTimeout(timer)
  timer = setTimeout(() => { ultimo = testo; chiama('miei', 'PUT', JSON.parse(testo)).catch(() => { ultimo = '' }) }, 800)
}
useS.subscribe((s, p) => { if (s.casa !== p.casa || s.preferiti !== p.preferiti) manda(); if (!s.utente && p.utente) { pronto = false; ultimo = '' } })

export const eSalvato = (x: Preferito) => useS.getState().preferiti.some(y => chiave(y) === chiave(x))
export function salvaOTogli(x: Preferito) {
  const st = useS.getState(), k = chiave(x)
  st.set({ preferiti: st.preferiti.some(y => chiave(y) === k) ? st.preferiti.filter(y => chiave(y) !== k) : [x, ...st.preferiti] })
}

/** Google Identity Services: lo script si carica solo quando serve il pulsante. */
let gis: Promise<void> | undefined
type GIS = { accounts: { id: { initialize: (o: object) => void; renderButton: (el: HTMLElement, o: object) => void; disableAutoSelect: () => void } } }
export const google = () => (window as unknown as { google?: GIS }).google
export function caricaGis() {
  gis ??= new Promise((ok, ko) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = () => ok(); s.onerror = () => { gis = undefined; ko(new Error('Google non risponde')) }; document.head.appendChild(s) })
  return gis
}

import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
createRoot(document.getElementById('root')!).render(<App />)
// gancio per le prove automatiche (solo con ?prova)
if (new URLSearchParams(location.search).has('prova')) {
  import('./store').then(m => ((window as unknown as Record<string, unknown>).__S = m.useS))
  import('./scene/viewer').then(m => ((window as unknown as Record<string, unknown>).__V = m))
}

// Safari ignora user-scalable=no: si fermano a mano i gesti di ingrandimento della pagina (la mappa li gestisce da sé)
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, e => e.preventDefault(), { passive: false })
document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !(e.target as HTMLElement).closest?.('.scena')) e.preventDefault() }, { passive: false })
let ultimoTocco = 0
document.addEventListener('touchend', e => { const t = Date.now(); if (t - ultimoTocco < 300 && !(e.target as HTMLElement).closest?.('input,textarea,select')) e.preventDefault(); ultimoTocco = t }, { passive: false })

// app installabile e offline (solo sul sito vero, non in sviluppo)
if ('serviceWorker' in navigator && location.protocol === 'https:' && !location.hostname.startsWith('claude-')) navigator.serviceWorker.register('/sw.js').catch(() => {})

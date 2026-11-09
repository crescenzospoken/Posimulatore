import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
createRoot(document.getElementById('root')!).render(<App />)
// gancio per le prove automatiche (solo con ?prova)
if (new URLSearchParams(location.search).has('prova')) {
  import('./store').then(m => ((window as unknown as Record<string, unknown>).__S = m.useS))
  import('./scene/viewer').then(m => ((window as unknown as Record<string, unknown>).__V = m))
}

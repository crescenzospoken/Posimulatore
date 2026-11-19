// Gesti delle schede sul telefono: trascinando verso il basso (dalla maniglia, dalla testata o con il contenuto già in cima)
// la scheda segue il dito e, oltre 90 px o con un colpo veloce, si chiude come col suo pulsante ✕.
const SCHEDE = '.pannello, .scheda-percorso, .scheda-poi'
const CHIUDI = '.pannello-testa button[aria-label]'

export function avviaGesti() {
  let el: HTMLElement | null = null, y0 = 0, t0 = 0, dy = 0, attivo = false
  const telefono = () => matchMedia('(max-width: 760px)').matches
  document.addEventListener('touchstart', e => {
    if (!telefono() || e.touches.length !== 1) return
    const tg = e.target as HTMLElement
    const s = tg.closest?.(SCHEDE) as HTMLElement | null
    if (!s || tg.closest('input, textarea, select, .tappe')) return
    // dal corpo si trascina solo se il contenuto è già in cima (altrimenti si scorre)
    const corpo = s.querySelector('.pannello-corpo') as HTMLElement | null
    const inCima = (corpo ? corpo.scrollTop : s.scrollTop) <= 0
    const daTesta = !!tg.closest('.pannello-testa') || e.touches[0].clientY - s.getBoundingClientRect().top < 44
    if (!inCima && !daTesta) return
    el = s; y0 = e.touches[0].clientY; t0 = performance.now(); dy = 0; attivo = false
  }, { passive: true })
  document.addEventListener('touchmove', e => {
    if (!el) return
    dy = e.touches[0].clientY - y0
    if (!attivo && dy > 8) { attivo = true; el.style.transition = 'none' }
    if (!attivo) return
    if (dy < 0) dy = 0
    el.style.transform = `translateY(${dy}px)`
    e.preventDefault()
  }, { passive: false })
  const fine = () => {
    if (!el) return
    const s = el, v = dy / Math.max(1, performance.now() - t0)
    el = null
    if (!attivo) return
    s.style.transition = 'transform 0.18s ease-out'
    if (dy > 90 || v > 0.6) {
      s.style.transform = 'translateY(100%)'
      setTimeout(() => { (s.querySelector(CHIUDI) as HTMLElement | null)?.click(); s.style.transform = ''; s.style.transition = '' }, 170)
    } else { s.style.transform = ''; setTimeout(() => (s.style.transition = ''), 200) }
  }
  document.addEventListener('touchend', fine)
  document.addEventListener('touchcancel', fine)
}

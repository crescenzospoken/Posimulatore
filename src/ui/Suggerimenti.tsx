import { useEffect, useState } from 'react'
/** Spiegazioni dei pulsanti: col mouse dopo un secondo; sul telefono solo tenendo premuto, e spariscono appena si lascia. */
export function Suggerimenti() {
  const [t, setT] = useState<{ x: number; y: number; testo: string } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
      clearTimeout(timer)
      setT(null)
      if (!el) return
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect()
        setT({ x: Math.min(window.innerWidth - 240, Math.max(8, r.left)), y: r.bottom + 6, testo: el.dataset.tip! })
      }, 1000)
    }
    const via = () => { clearTimeout(timer); setT(null) }
    document.addEventListener('pointerover', over)
    let da: [number, number] | null = null
    const giu = (e: PointerEvent) => {
      via()
      if (e.pointerType === 'mouse') return
      const el = (e.target as HTMLElement)?.closest?.('[data-tip]') as HTMLElement | null
      if (!el) return
      da = [e.clientX, e.clientY]
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect()
        setT({ x: Math.min(window.innerWidth - 240, Math.max(8, r.left)), y: Math.max(8, r.top - 44), testo: el.dataset.tip! })
      }, 600)
    }
    const muove = (e: PointerEvent) => { if (da && e.pointerType !== 'mouse' && Math.hypot(e.clientX - da[0], e.clientY - da[1]) > 8) { da = null; via() } }
    const su = (e: PointerEvent) => { if (e.pointerType !== 'mouse') { da = null; via() } }
    document.addEventListener('pointerdown', giu)
    document.addEventListener('pointermove', muove)
    document.addEventListener('pointerup', su)
    document.addEventListener('pointercancel', su)
    document.addEventListener('scroll', via, true)
    return () => document.removeEventListener('pointerover', over)
  }, [])
  return t ? <div className="tip" style={{ left: t.x, top: t.y }}>{t.testo}</div> : null
}

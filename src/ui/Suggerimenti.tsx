import { useEffect, useState } from 'react'
/** Spiegazioni dei pulsanti: compaiono dopo un secondo (sul telefono, pressione lunga), mai subito. */
export function Suggerimenti() {
  const [t, setT] = useState<{ x: number; y: number; testo: string } | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const over = (e: PointerEvent) => {
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
    document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') via() })
    document.addEventListener('scroll', via, true)
    return () => document.removeEventListener('pointerover', over)
  }, [])
  return t ? <div className="tip" style={{ left: t.x, top: t.y }}>{t.testo}</div> : null
}

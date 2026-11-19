import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
/** Spiegazioni dei pulsanti: compaiono dopo un secondo (sul telefono, pressione lunga), mai subito. */
export function Suggerimenti() {
    const [t, setT] = useState(null);
    useEffect(() => {
        let timer;
        const over = (e) => {
            const el = e.target?.closest?.('[data-tip]');
            clearTimeout(timer);
            setT(null);
            if (!el)
                return;
            timer = setTimeout(() => {
                const r = el.getBoundingClientRect();
                setT({ x: Math.min(window.innerWidth - 240, Math.max(8, r.left)), y: r.bottom + 6, testo: el.dataset.tip });
            }, 1000);
        };
        const via = () => { clearTimeout(timer); setT(null); };
        document.addEventListener('pointerover', over);
        document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse')
            via(); });
        document.addEventListener('scroll', via, true);
        return () => document.removeEventListener('pointerover', over);
    }, []);
    return t ? _jsx("div", { className: "tip", style: { left: t.x, top: t.y }, children: t.testo }) : null;
}

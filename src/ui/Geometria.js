import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useS } from '../store';
import { azimutLato, inserisci, lati, locali, lunghezzaLato, muoviPunto, r2, ruota, squadra, togliPunto, trasla } from '../engine/modifica';
const CHIUSI = new Set(['area', 'volume', 'piazza']);
const MINIMO = { area: 3, volume: 3, piazza: 3, linea: 2, stalli: 2, barriera: 2, zebra: 2, arresto: 2 };
const FISSI = new Set(['zebra', 'arresto']); // sempre due punti
const PASSI = [[0, 'Libero'], [0.01, '1 cm'], [0.05, '5 cm'], [0.1, '10 cm'], [0.5, '50 cm'], [1, '1 m']];
/** Campo numerico che conferma con Invio o uscendo: mentre scrivi non sposta niente. */
function Num({ v, set, passo, largo }) {
    const [t, setT] = useState(null);
    const conferma = () => { if (t !== null) {
        const n = Number(t.replace(',', '.'));
        if (isFinite(n) && n !== v)
            set(n);
        setT(null);
    } };
    return _jsx("input", { className: largo ? 'num largo' : 'num', inputMode: "decimal", value: t ?? r2(v).toFixed(2).replace('.', ','), onChange: e => setT(e.target.value), onBlur: conferma, onKeyDown: e => { if (e.key === 'Enter')
            e.target.blur();
        else if (e.key === 'Escape')
            setT(null);
        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            e.stopPropagation();
            set(r2(v + (e.key === 'ArrowUp' ? 1 : -1) * (passo || 0.01) * (e.shiftKey ? 10 : 1)));
        } } });
}
export function Geometria({ o }) {
    const s = useS();
    const [de, setDe] = useState(0), [dn, setDn] = useState(0), [gr, setGr] = useState(0);
    const chiuso = CHIUSI.has(o.tipo), n = o.pts.length;
    const xy = locali(o.pts), ls = n > 1 ? lati(o.pts, chiuso) : [];
    const cambia = (pts) => s.aggiorna(o.id, x => { x.pts = pts; });
    const min = MINIMO[o.tipo] ?? 1;
    return (_jsxs("div", { className: "geometria", children: [_jsx("h3", { children: "Geometria" }), _jsxs("label", { className: "riga", children: [_jsxs("span", { children: ["Passo", _jsx("small", { children: "Vale per trascinamento, frecce e campi" })] }), _jsx("select", { value: s.passo, onChange: e => s.set({ passo: Number(e.target.value) }), children: PASSI.map(([v, t]) => _jsx("option", { value: v, children: t }, v)) })] }), _jsxs("p", { className: "nota", children: ["Punto 1: ", o.pts[0][1].toFixed(6), ", ", o.pts[0][0].toFixed(6), ". Le misure sono in metri dal punto 1, verso est e verso nord."] }), n > 1 && (_jsxs("table", { className: "punti", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "N." }), _jsx("th", { children: "Est" }), _jsx("th", { children: "Nord" }), _jsx("th", { children: "Lato" }), _jsx("th", { children: "Dir." }), _jsx("th", {})] }) }), _jsx("tbody", { children: o.pts.map((_, i) => (_jsxs("tr", { className: s.vSel === i ? 'scelto' : '', onClick: () => s.set({ vSel: i }), children: [_jsx("td", { children: i + 1 }), _jsx("td", { children: i === 0 ? '0' : _jsx(Num, { v: xy[i][0], passo: s.passo, set: v => cambia(muoviPunto(o.pts, i, v, xy[i][1])) }) }), _jsx("td", { children: i === 0 ? '0' : _jsx(Num, { v: xy[i][1], passo: s.passo, set: v => cambia(muoviPunto(o.pts, i, xy[i][0], v)) }) }), _jsx("td", { children: ls[i] ? _jsx(Num, { v: ls[i].l, passo: s.passo, set: v => cambia(lunghezzaLato(o.pts, i, v)) }) : '' }), _jsx("td", { children: ls[i] ? _jsx(Num, { v: ls[i].az, passo: 1, set: v => cambia(azimutLato(o.pts, i, v)) }) : '' }), _jsxs("td", { className: "azioni-punto", children: [!FISSI.has(o.tipo) && ls[i] && _jsx("button", { className: "quiet", onClick: e => { e.stopPropagation(); cambia(inserisci(o.pts, i)); }, "data-tip": "Aggiungi un punto a met\u00E0 di questo lato", "aria-label": "Aggiungi punto", children: "\uFF0B" }), chiuso && _jsx("button", { className: "quiet", onClick: e => { e.stopPropagation(); cambia(squadra(o.pts, i)); }, "data-tip": "Metti in squadra: 90\u00B0 in questo punto", "aria-label": "In squadra", children: "\u221F" }), !FISSI.has(o.tipo) && n > min && _jsx("button", { className: "quiet danger", onClick: e => { e.stopPropagation(); cambia(togliPunto(o.pts, i, min)); s.set({ vSel: null }); }, "data-tip": "Togli questo punto", "aria-label": "Togli punto", children: "\u2715" })] })] }, i))) })] })), n > 1 && _jsx("p", { className: "nota", children: "\u00ABLato\u00BB \u00E8 la misura dal punto al successivo, \u00ABDir.\u00BB la sua direzione in gradi da nord. Cambiandoli si muove il punto successivo." }), _jsxs("div", { className: "sposta", children: [_jsxs("label", { children: ["Est (m)", _jsx(Num, { v: de, passo: s.passo, set: setDe, largo: true })] }), _jsxs("label", { children: ["Nord (m)", _jsx(Num, { v: dn, passo: s.passo, set: setDn, largo: true })] }), _jsx("button", { onClick: () => { if (de || dn)
                            cambia(trasla(o.pts, de, dn)); }, children: "Sposta" })] }), n > 1 && _jsxs("div", { className: "sposta", children: [_jsxs("label", { children: ["Gradi (orari)", _jsx(Num, { v: gr, passo: 1, set: setGr, largo: true })] }), _jsx("button", { onClick: () => { if (gr)
                            cambia(ruota(o.pts, gr)); }, children: "Ruota" }), _jsx("span", { className: "nota", children: "attorno al centro" })] }), _jsx("p", { className: "nota", children: "Con le frecce della tastiera sposti di un passo l'oggetto, o il punto scelto nella tabella. Maiusc: dieci passi." })] }));
}

import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRicerca } from './ricerca';
import { t as tr, linguaAttuale } from '../i18n';
import { useEffect, useRef, useState } from 'react';
import { lettera } from './tappe';
import QRCode from 'qrcode';
import { Icona } from './Icona';
import { elencoPoi } from '../scene/poi';
import { useS } from '../store';
import { confrontoMezzi, minutiTesto, tappaInLink } from '../engine/percorso';
const m = (x) => Math.round(x).toLocaleString(linguaAttuale() === 'en' ? 'en-GB' : 'it-IT');
const nomeDi = (t) => t?.nome || (t ? `Punto ${t.p[1].toFixed(5)}, ${t.p[0].toFixed(5)}` : '');
export function linkPercorso(tappe) {
    const u = new URL(location.origin + '/');
    if (tappe.length === 2) {
        u.searchParams.set('da', tappaInLink(tappe[0]));
        u.searchParams.set('a', tappaInLink(tappe[1]));
    }
    else if (tappe.length)
        u.searchParams.set('t', tappe.map(tappaInLink).join('|'));
    return u.toString();
}
/** Scheda del percorso a piedi da A a B. Dal link (ospite) mostra solo il percorso. */
const NOME_CRITERIO = { veloce: 'Più veloce', scale: 'Meno scale', salita: 'Meno salita' };
const ICONA_MEZZO = { piedi: 'directions_walk', bus: 'directions_bus', auto: 'directions_car' };
const NOME_MEZZO = { piedi: 'A piedi', bus: 'Bus', auto: 'Auto' };
const fermate = () => elencoPoi().filter(p => p.c === 'fermate' && !p.nascosto).map(p => p.p);
export function SchedaPercorso({ calc, opzioni, scelta, scegli, esci }) {
    const s = useS();
    const inizio = s.tappe[0] ?? null, fine = s.tappe.length > 1 ? s.tappe[s.tappe.length - 1] : null;
    const [qr, setQr] = useState(null);
    const [chiuso, setChiuso] = useState(false);
    const link = linkPercorso(s.tappe);
    useEffect(() => { setQr(null); }, [link]);
    const faiQr = async () => {
        const c = document.createElement('canvas'), L = 1200;
        c.width = L;
        c.height = L + 300;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        const q = document.createElement('canvas');
        await QRCode.toCanvas(q, link, { width: L - 160, margin: 0, errorCorrectionLevel: 'M' });
        g.drawImage(q, 80, 200);
        g.fillStyle = '#10243a';
        g.textAlign = 'center';
        g.font = '600 64px system-ui, sans-serif';
        g.fillText(fine?.nome ? `${tr('Come arrivare a')} ${fine.nome}` : tr('Come arrivare'), L / 2, 110, L - 80);
        g.font = '400 40px system-ui, sans-serif';
        g.fillStyle = '#4a5b6c';
        if (calc)
            g.fillText(`${tr('A piedi')} ${minutiTesto(calc.minuti)} · ${m(calc.metri)} m${inizio?.nome ? ' · ' + inizio.nome : ''}`, L / 2, 170, L - 80);
        g.fillText(tr('Inquadra il codice: si apre la mappa 3D con il percorso'), L / 2, L + 210, L - 80);
        setQr(c.toDataURL('image/png'));
    };
    const copia = async () => { try {
        await navigator.clipboard.writeText(link);
        s.dici(tr('Link copiato'));
    }
    catch {
        s.dici(tr('Copia non riuscita: tieni premuto sul link'));
    } };
    // con meno di due tappe la scheda non serve: le tappe si scelgono in alto
    if (s.tappe.length < 2)
        return null;
    if (chiuso)
        return _jsx("button", { className: "scheda-percorso riapri", onClick: () => setChiuso(false), children: calc ? `${minutiTesto(calc.minuti)} ${tr('a piedi')}` : tr('Percorso') });
    return (_jsxs("section", { className: "scheda-percorso", "aria-label": tr('Percorso a piedi'), children: [_jsxs("div", { className: "pannello-testa", children: [_jsx("h2", { children: fine?.nome ?? tr('Percorso a piedi') }), _jsx("button", { className: "tondo quiet", onClick: () => (s.ospite ? setChiuso(true) : esci()), "aria-label": tr(s.ospite ? 'Riduci' : 'Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), s.tappe.length >= 2 && (calc ? (_jsxs("div", { className: "esito", children: [opzioni.length > 1 && (_jsx("div", { className: "alternative", role: "tablist", "aria-label": tr('Percorsi alternativi'), children: opzioni.map((o, i) => (_jsxs("button", { role: "tab", "aria-selected": i === scelta, className: i === scelta ? 'acceso' : '', onClick: () => scegli(i), children: [_jsx("b", { children: minutiTesto(o.minuti) }), _jsxs("small", { children: [tr(NOME_CRITERIO[o.criterio ?? 'veloce']), o.gradini > 20 ? ` · ${m(Math.round(o.gradini / 10) * 10)} ${tr('gradini')}` : ' · ' + tr('senza scale')] })] }, i))) })), _jsxs("button", { className: "quiet", onClick: () => s.set({ vista360: { modo: 'percorso', pts: calc.pts.map(p => [p[0], p[1]]), titolo: s.tappe[s.tappe.length - 1]?.nome } }), children: [_jsx(Icona, { n: "streetview" }), tr('Guarda il percorso')] }), _jsxs("div", { className: "cifre", children: [_jsxs("span", { children: [_jsx(Icona, { n: "schedule" }), _jsx("b", { children: minutiTesto(calc.minuti) }), _jsxs("small", { children: [tr('ritorno'), " ", minutiTesto(calc.ritorno)] })] }), _jsxs("span", { children: [_jsx(Icona, { n: "route" }), _jsxs("b", { children: [m(calc.metri), " m"] }), _jsx("small", { children: tr('a piedi') })] }), _jsxs("span", { children: [_jsx(Icona, { n: "stairs" }), _jsx("b", { children: calc.gradini > 20 ? '~' + m(Math.round(calc.gradini / 10) * 10) : '0' }), _jsx("small", { children: tr('gradini') })] }), _jsxs("span", { children: [_jsx(Icona, { n: "trending_up" }), _jsxs("b", { children: [m(calc.salita), " m"] }), _jsxs("small", { children: [tr('salita'), " \u00B7 ", m(calc.discesa), " m ", tr('discesa')] })] })] }), (() => {
                        const mz = s.tappe.length === 2 ? confrontoMezzi(calc, fermate(), s.tappe[0].p, s.tappe[s.tappe.length - 1].p) : [];
                        return mz.length > 1 && (_jsxs(_Fragment, { children: [_jsx("h3", { children: tr('Come conviene') }), _jsx("ul", { className: "mezzi", children: mz.map((x, i) => _jsxs("li", { className: i === 0 ? 'migliore' : '', children: [_jsx(Icona, { n: ICONA_MEZZO[x.k] }), _jsxs("span", { children: [_jsxs("b", { children: [tr(NOME_MEZZO[x.k]), " \u00B7 ", minutiTesto(x.minuti)] }), _jsx("small", { children: x.k === 'piedi' ? `${m(calc.metri)} m, ${calc.gradini > 20 ? tr('circa') + ' ' + m(Math.round(calc.gradini / 10) * 10) + ' ' + tr('gradini') : tr('quasi senza scale')}` : tr(x.nota) })] }), i === 0 && _jsx("em", { children: tr('consigliato') })] }, x.k)) })] }));
                    })(), calc.tratti.length > 0 && (_jsxs(_Fragment, { children: [_jsx("h3", { children: tr('Indicazioni') }), _jsx("ol", { className: "indicazioni", children: calc.tratti.filter(t => t.metri >= 15).map((t, i) => (_jsxs("li", { children: [_jsx(Icona, { n: t.tipo === 'scale' ? 'stairs' : t.tipo === 'sentiero' ? 'directions_walk' : 'route' }), _jsxs("span", { children: [_jsx("b", { children: t.nome || tr(t.tipo === 'scale' ? 'Scale' : t.tipo === 'vicolo' ? 'Vicolo' : t.tipo === 'sentiero' ? 'Sentiero' : 'Strada') }), _jsxs("small", { children: [m(t.metri), " m", t.gradini > 15 ? ` · ~${m(Math.round(t.gradini / 10) * 10)} ${tr('gradini')}` : '', t.su > 4 ? ` · ${tr('sale')} ${m(t.su)} m` : '', t.giu > 4 ? ` · ${tr('scende')} ${m(t.giu)} m` : ''] })] })] }, i))) })] })), _jsx("p", { className: "nota", children: tr('Stime nostre: passo tranquillo con salite e scale (regola DIN 33466 sulle quote LiDAR), gradini stimati in 16 cm l\'uno. Bus e auto sono indicativi. Col censimento delle scale diventeranno misure vere.') })] })) : _jsx("p", { className: "nota", children: tr('Nessun percorso trovato: scegli punti vicino a una via o a una scala.') })), !s.ospite && s.tappe.length >= 2 && (_jsxs("div", { className: "condividi", children: [_jsx("h3", { children: tr('Link e QR') }), _jsx("p", { className: "nota", children: tr('Chi lo apre vede solo questo percorso. Dai un nome alla partenza e all\'arrivo: compare sul cartello.') }), _jsxs("div", { className: "riga-bottoni", children: [_jsx("button", { onClick: copia, children: tr('Copia link') }), _jsx("button", { className: "primary", onClick: faiQr, children: tr('Crea QR da stampare') })] }), qr && _jsxs(_Fragment, { children: [_jsx("img", { className: "qr", src: qr, alt: `QR del percorso verso ${nomeDi(fine)}` }), _jsx("a", { className: "bottone", href: qr, download: `percorso-${(fine?.nome || 'arrivo').replace(/\W+/g, '-').toLowerCase()}.png`, children: tr('Scarica l\'immagine') })] })] }))] }));
}
/** Le tappe del percorso, in alto al posto della ricerca: si aggiungono (ricerca, mappa, posizione, Casa), si tolgono e si spostano trascinandole. */
export function BarraTappe({ esci }) {
    const s = useS();
    const tappe = s.tappe;
    const [q, setQ] = useState('');
    const [modifica, setModifica] = useState(!s.ospite);
    // con il percorso pronto la barra si riduce a una riga, così sul telefono resta spazio per la mappa
    const [aperta, setAperta] = useState(tappe.length < 2);
    useEffect(() => { if (tappe.length < 2)
        setAperta(true); }, [tappe.length]);
    const [trascina, setTrascina] = useState(null);
    const righe = useRef([]);
    const { nostri, google } = useRicerca(q);
    const metti = (x) => s.set({ tappe: x });
    // due volte di fila lo stesso posto non serve
    const aggiungi = (x) => { const u = tappe.at(-1); if (!u || u.p[0] !== x.p[0] || u.p[1] !== x.p[1])
        metti([...tappe, x]); setQ(''); };
    const posizione = () => {
        if (!navigator.geolocation) {
            s.dici(tr('Questo telefono non dà la posizione'));
            return;
        }
        navigator.geolocation.getCurrentPosition(g => { const p = [g.coords.longitude, g.coords.latitude]; if (Math.abs(p[0] - 14.49) > 0.05 || Math.abs(p[1] - 40.625) > 0.04) {
            s.dici(tr('Sei fuori Positano: scegli la partenza sulla mappa'));
            return;
        } metti([{ p, nome: tr('La mia posizione') }, ...tappe]); }, () => s.dici(tr('Posizione non disponibile: scegli la partenza sulla mappa')), { enableHighAccuracy: true, timeout: 10000 });
    };
    // trascinamento: si prende la maniglia, la riga si sposta dove si lascia
    const inizia = (e, i) => {
        e.preventDefault();
        e.target.setPointerCapture(e.pointerId);
        setTrascina({ da: i, a: i });
    };
    const muovi = (e) => {
        if (!trascina)
            return;
        const y = e.clientY;
        let a = righe.current.findIndex(r => r && y < r.getBoundingClientRect().top + r.getBoundingClientRect().height / 2);
        if (a < 0)
            a = tappe.length - 1;
        if (a !== trascina.a)
            setTrascina({ ...trascina, a });
    };
    const lascia = () => {
        if (!trascina)
            return;
        const x = [...tappe], [v] = x.splice(trascina.da, 1);
        x.splice(trascina.a, 0, v);
        metti(x);
        setTrascina(null);
    };
    const ordine = trascina ? (() => { const x = tappe.map((_, i) => i), [v] = x.splice(trascina.da, 1); x.splice(trascina.a, 0, v); return x; })() : tappe.map((_, i) => i);
    if (!aperta && tappe.length >= 2)
        return (_jsxs("button", { className: "barra-tappe vetro riassunto", onClick: () => { setAperta(true); setModifica(true); }, "aria-label": tr('Cambia le tappe'), children: [_jsx("span", { className: "lettera a", children: "A" }), _jsx("span", { className: "nome", children: nomeDi(tappe[0]) }), _jsx("span", { className: "freccia", children: "\u2192" }), _jsx("span", { className: "lettera b", children: lettera(tappe.length - 1) }), _jsx("span", { className: "nome", children: nomeDi(tappe[tappe.length - 1]) }), tappe.length > 2 && _jsxs("small", { children: [tappe.length, " ", tr('tappe')] }), _jsx(Icona, { n: "edit" })] }));
    return (_jsxs("div", { className: "barra-tappe vetro", children: [_jsx("ol", { className: "tappe", onPointerMove: muovi, onPointerUp: lascia, onPointerCancel: lascia, children: ordine.map((k, pos) => {
                    const x = tappe[k];
                    return (_jsxs("li", { ref: el => { righe.current[pos] = el; }, className: trascina?.da === k ? 'presa' : '', children: [_jsx("span", { className: 'lettera' + (pos === 0 ? ' a' : pos === tappe.length - 1 ? ' b' : ''), children: lettera(pos) }), _jsx("span", { className: "nome", children: nomeDi(x) }), modifica && tappe.length > 1 && _jsx("span", { className: "maniglia", onPointerDown: e => inizia(e, k), "aria-label": tr('Trascina per spostare'), "data-tip": tr('Trascina per spostare'), children: _jsx(Icona, { n: "drag_indicator" }) }), modifica && _jsx("button", { className: "tondo quiet", onClick: () => metti(tappe.filter((_, j) => j !== k)), "aria-label": tr('Togli la tappa'), children: _jsx(Icona, { n: "close" }) })] }, k + ':' + x.p.join()));
                }) }), modifica ? _jsxs(_Fragment, { children: [_jsxs("div", { className: "cerca riga-aggiungi", children: [_jsx("span", { className: 'lettera piccola', children: lettera(tappe.length) }), _jsx("input", { value: q, onChange: e => setQ(e.target.value), autoFocus: tappe.length > 0 && tappe.length < 2, placeholder: tr(tappe.length === 0 ? 'Da dove parti?' : tappe.length === 1 ? 'Dove vuoi andare?' : 'Aggiungi una tappa'), "aria-label": tr('Aggiungi una tappa') })] }), (nostri.length > 0 || google.length > 0) && _jsxs("ul", { className: "risultati vetro", children: [nostri.map(x => _jsx("li", { children: _jsxs("button", { onClick: () => aggiungi({ p: x.p, nome: x.nome }), children: [_jsx(Icona, { n: x.poi ? 'location_on' : x.tipo === 'strada' ? 'route' : 'map' }), _jsx("span", { children: x.nome }), _jsx("small", { children: tr(x.tipo) })] }) }, x.nome + x.tipo + (x.poi ?? ''))), google.length > 0 && _jsx("li", { className: "titoletto", children: tr('Da Google Maps') }), google.map(g => _jsx("li", { children: _jsxs("button", { onClick: () => aggiungi({ p: g.p, nome: g.nome }), children: [_jsx(Icona, { n: "location_on" }), _jsx("span", { children: g.nome }), _jsx("small", { children: g.tipo ?? g.indirizzo })] }) }, 'g' + g.id)), google.length > 0 && _jsx("li", { className: "attribuzione-google", children: tr('Risultati di Google') })] }), _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: 'quiet' + (s.aggiungiDaMappa ? ' acceso' : ''), "aria-pressed": s.aggiungiDaMappa, onClick: () => s.set({ aggiungiDaMappa: !s.aggiungiDaMappa }), children: [_jsx(Icona, { n: "location_on" }), tr('Sulla mappa')] }), !tappe.some(x => x.nome === tr('La mia posizione')) && _jsxs("button", { className: "quiet", onClick: posizione, "data-tip": tr('Parti da dove sei adesso'), children: [_jsx(Icona, { n: "my_location" }), tr('Da qui')] }), s.casa && _jsxs("button", { className: "quiet", onClick: () => aggiungi(s.casa), children: [_jsx(Icona, { n: "home" }), tr('Casa')] }), tappe.length === 2 && _jsxs("button", { className: "quiet", onClick: () => metti([tappe[1], tappe[0]]), "data-tip": tr('Scambia partenza e arrivo'), children: [_jsx(Icona, { n: "swap_vert" }), tr('Inverti')] }), tappe.length >= 2 && _jsxs("button", { className: "quiet", onClick: () => setAperta(false), children: [_jsx(Icona, { n: "expand_less" }), tr('Fatto')] }), _jsxs("button", { className: "quiet chiudi", onClick: esci, children: [_jsx(Icona, { n: "close" }), tr('Chiudi')] })] }), s.aggiungiDaMappa && _jsx("p", { className: "nota", children: tr('Tocca la mappa per aggiungere una tappa.') })] }) : _jsx("button", { className: "quiet", onClick: () => setModifica(true), children: tr('Cambia le tappe') })] }));
}

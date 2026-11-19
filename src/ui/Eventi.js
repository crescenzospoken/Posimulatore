import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { portamiA } from './tappe';
import { useEffect, useState } from 'react';
import { useS } from '../store';
import { t, linguaAttuale } from '../i18n';
import { Icona } from './Icona';
import { chiama, condividi, linkPunto } from './Pubblico';
import { caricaEventi, elencoEventi, eventoDa, inCorso } from '../scene/eventi';
const quando = (e) => {
    const l = linguaAttuale() === 'en' ? 'en-GB' : 'it-IT';
    const a = new Date(e.inizio), b = new Date(e.fine);
    const g = (d) => d.toLocaleDateString(l, { weekday: 'short', day: 'numeric', month: 'short' });
    const o = (d) => d.toLocaleTimeString(l, { hour: '2-digit', minute: '2-digit' });
    return g(a) === g(b) ? `${g(a)} · ${o(a)}–${o(b)}` : `${g(a)} ${o(a)} – ${g(b)} ${o(b)}`;
};
/** Scheda di un evento per chi visita. */
export function SchedaEvento() {
    const s = useS();
    const e = s.selEvento ? eventoDa(s.selEvento) : undefined;
    if (!e)
        return null;
    const en = s.lingua === 'en';
    const titolo = (en && e.titolo_en) || e.titolo, descr = (en && e.descr_en) || e.descr;
    const portami = () => portamiA({ p: [e.lon, e.lat], nome: titolo });
    return (_jsxs("section", { className: "scheda-poi", "aria-label": titolo, children: [_jsxs("div", { className: "pannello-testa", children: [_jsxs("h2", { children: [_jsx("span", { className: "icona-tonda", style: { background: '#e91e63' }, children: _jsx(Icona, { n: "celebration" }) }), titolo] }), _jsx("button", { className: "tondo quiet", onClick: () => s.set({ selEvento: null }), "aria-label": t('Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), _jsxs("p", { className: "nota", children: [inCorso(e) ? t('In corso') + ' · ' : '', quando(e)] }), descr && _jsx("p", { children: descr }), _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: "primary", onClick: portami, children: [_jsx(Icona, { n: "directions" }), t('Portami qui')] }), e.link && _jsxs("a", { className: "bottone", href: e.link, target: "_blank", rel: "noopener", children: [_jsx(Icona, { n: "open_in_new" }), t('Programma')] }), _jsxs("button", { className: "quiet", onClick: () => s.set({ vista360: { modo: 'punto', p: [e.lon, e.lat], titolo: titolo } }), children: [_jsx(Icona, { n: "streetview" }), "Street View"] }), _jsxs("button", { className: "quiet", onClick: () => condividi(titolo, linkPunto({ p: [e.lon, e.lat], nome: titolo }, false), s.dici), children: [_jsx(Icona, { n: "share" }), t('Condividi')] })] })] }));
}
const locale = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
/** Pannello per chi modifica: crea o cambia un evento (il punto si tocca sulla mappa) e vede quelli in programma. */
export function ModificaEvento() {
    const s = useS();
    const e = s.selEvento ? eventoDa(s.selEvento) : undefined;
    const p = s.nuovoEvento ?? (e ? [e.lon, e.lat] : null);
    const vuoto = () => { const a = new Date(); a.setMinutes(0, 0, 0); a.setHours(a.getHours() + 1); const b = new Date(+a + 3 * 3600e3); return { titolo: '', titolo_en: '', descr: '', descr_en: '', inizio: locale(a.toISOString()), fine: locale(b.toISOString()), link: '' }; };
    const [d, setD] = useState(vuoto);
    const [lavoro, setLavoro] = useState(false);
    useEffect(() => { setD(e ? { titolo: e.titolo, titolo_en: e.titolo_en ?? '', descr: e.descr ?? '', descr_en: e.descr_en ?? '', inizio: locale(e.inizio), fine: locale(e.fine), link: e.link ?? '' } : vuoto()); }, [s.selEvento]);
    const salva = async () => {
        if (!p)
            return;
        setLavoro(true);
        const id = e?.id ?? 'ev' + Math.random().toString(36).slice(2, 10);
        try {
            await chiama('eventi/' + id, 'PUT', { ...d, lon: p[0], lat: p[1], inizio: new Date(d.inizio).toISOString(), fine: new Date(d.fine).toISOString() });
            await caricaEventi();
            s.set({ selEvento: id, nuovoEvento: null, googleGiro: s.googleGiro + 1 });
            s.dici('Evento salvato: compare mentre è in corso');
        }
        catch (x) {
            s.dici(x.message);
        }
        finally {
            setLavoro(false);
        }
    };
    const togli = async () => {
        if (!e)
            return;
        setLavoro(true);
        try {
            await chiama('eventi/' + e.id, 'DELETE');
            await caricaEventi();
            s.set({ selEvento: null, googleGiro: s.googleGiro + 1 });
            s.dici('Evento eliminato');
        }
        catch (x) {
            s.dici(x.message);
        }
        finally {
            setLavoro(false);
        }
    };
    const prossimi = elencoEventi();
    return (_jsxs("div", { className: "campi", children: [!p ? _jsx("p", { className: "nota", children: "Tocca la mappa dove si svolge l'evento, o un evento per cambiarlo." }) : _jsxs(_Fragment, { children: [_jsxs("label", { children: ["Titolo", _jsx("input", { value: d.titolo, maxLength: 100, placeholder: "Es. Festa dell'Assunta", onChange: x => setD({ ...d, titolo: x.target.value }) })] }), _jsxs("label", { children: ["Titolo in inglese", _jsx("input", { value: d.titolo_en, maxLength: 100, onChange: x => setD({ ...d, titolo_en: x.target.value }) })] }), _jsxs("div", { className: "sposta", children: [_jsxs("label", { children: ["Inizio", _jsx("input", { type: "datetime-local", value: d.inizio, onChange: x => setD({ ...d, inizio: x.target.value }) })] }), _jsxs("label", { children: ["Fine", _jsx("input", { type: "datetime-local", value: d.fine, onChange: x => setD({ ...d, fine: x.target.value }) })] })] }), _jsxs("label", { children: ["Descrizione", _jsx("textarea", { rows: 3, maxLength: 600, value: d.descr, onChange: x => setD({ ...d, descr: x.target.value }) })] }), _jsxs("label", { children: ["Descrizione in inglese", _jsx("textarea", { rows: 3, maxLength: 600, value: d.descr_en, onChange: x => setD({ ...d, descr_en: x.target.value }) })] }), _jsxs("label", { children: ["Link al programma (facoltativo)", _jsx("input", { value: d.link, placeholder: "https://\u2026", onChange: x => setD({ ...d, link: x.target.value }) })] }), _jsxs("div", { className: "riga-bottoni", children: [_jsx("button", { className: "primary", disabled: lavoro || !d.titolo.trim(), onClick: salva, children: e ? 'Salva' : 'Aggiungi' }), e && _jsx("button", { className: "danger", disabled: lavoro, onClick: togli, children: "Elimina" })] })] }), prossimi.length > 0 && _jsxs(_Fragment, { children: [_jsx("h3", { children: "In programma" }), _jsx("ul", { className: "elenco", children: prossimi.map(x => (_jsx("li", { children: _jsxs("button", { className: x.id === s.selEvento ? 'acceso' : '', onClick: () => s.set({ selEvento: x.id, nuovoEvento: null }), children: [x.titolo, " ", _jsxs("small", { children: ["\u00B7 ", quando(x), inCorso(x) ? ' · in corso' : ''] })] }) }, x.id))) })] })] }));
}

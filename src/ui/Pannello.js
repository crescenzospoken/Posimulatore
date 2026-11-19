import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { t as tr } from '../i18n';
import { useRef, useState } from 'react';
import { useS } from '../store';
import { CATALOGO } from '../engine/catalogo';
import { calcoli, USI } from '../scene/oggetti';
import { edificio, coloreDi } from '../scene/edifici';
import { GRUPPI_VIE } from '../scene/contesto';
import { Icona } from './Icona';
import { Accesso, Utenti, ModificaPoi, chiama, puoModificare } from './Pubblico';
import { CorreggiVia } from './CorreggiVia';
import { ModificaEvento } from './Eventi';
import { quota } from '../scene/oggetti';
import { inquadra, quotaGoogle, googleAcceso } from '../scene/viewer';
import { Frame, add, mul } from '../engine/geo';
import { modelloStrumento } from './strumenti';
import { risultato } from '../scene/interazione';
import { fmtM, fmtM2 } from '../engine/geo';
import { NORME } from '../engine/norme';
import { Geometria } from './Geometria';
const COLORI = [['bianco', 'Bianco'], ['giallo', 'Giallo'], ['blu', 'Blu']];
const CAMPI = {
    linea: [{ k: 'stile', nome: 'Tipo', t: 'sel', opz: [['continua', 'Continua'], ['tratteggiata', 'Tratteggiata'], ['doppia', 'Doppia']] }, { k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI },
        { k: 'larghezza', nome: 'Larghezza (m)', t: 'num', passo: 0.01, aiuto: `Urbana 12 cm, extraurbana 15 cm (${NORME.strisciaUrbana.fonte}, da verificare)` }, { k: 'tratto', nome: 'Tratto (m)', t: 'num', passo: 0.5 }, { k: 'vuoto', nome: 'Intervallo (m)', t: 'num', passo: 0.5 }],
    arresto: [{ k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI }],
    zebra: [{ k: 'profondita', nome: 'Larghezza attraversamento (m)', t: 'num', passo: 0.5, aiuto: `Minimo 2,5 m sulle strade locali (${NORME.zebraMinLocale.fonte}, da verificare)` }, { k: 'vuoto', nome: 'Intervallo fra le strisce (m)', t: 'num', passo: 0.1 }],
    stalli: [{ k: 'disposizione', nome: 'Disposizione', t: 'sel', opz: [['linea', 'In linea'], ['pettine', 'A pettine (90°)'], ['spina', 'A spina (45°)']] },
        { k: 'tipoStallo', nome: 'Per', t: 'sel', opz: [['auto', 'Auto'], ['disabili', 'Disabili'], ['moto', 'Moto'], ['carico', 'Carico e scarico']] },
        { k: 'colore', nome: 'Colore', t: 'sel', opz: COLORI }, { k: 'lato', nome: 'Lato', t: 'sel', opz: [['1', 'A sinistra della linea'], ['-1', 'A destra della linea']] }],
    freccia: [{ k: 'rot', nome: 'Verso (gradi da nord)', t: 'num', passo: 15 }, { k: 'lunghezza', nome: 'Lunghezza (m)', t: 'num', passo: 0.5 }],
    area: [{ k: 'uso', nome: 'Uso', t: 'sel', opz: Object.entries(USI).map(([k, v]) => [k, v.nome]) }, { k: 'colore', nome: 'Colore', t: 'col' }],
    volume: [{ k: 'altezza', nome: 'Altezza (m)', t: 'num', passo: 0.5 }, { k: 'colore', nome: 'Colore', t: 'col' }, { k: 'opacita', nome: 'Opacità', t: 'num', passo: 0.1, min: 0.1, max: 1 }, { k: 'scava', nome: 'Scava il terreno', t: 'bool' }],
    barriera: [{ k: 'tipo', nome: 'Tipo', t: 'sel', opz: [['transenna', 'Transenne'], ['newjersey', 'New jersey'], ['ringhiera', 'Ringhiera'], ['vetro', 'Vetro'], ['muro', 'Muro']] }, { k: 'altezza', nome: 'Altezza muro (m)', t: 'num', passo: 0.1 }],
    modello: [{ k: 'm', nome: 'Modello', t: 'sel', opz: CATALOGO.map(m => [m.id, m.nome]) }, { k: 'rot', nome: 'Rotazione (gradi)', t: 'num', passo: 15 }, { k: 'scala', nome: 'Scala', t: 'num', passo: 0.1, min: 0.1 }, { k: 'alto', nome: 'Altezza (solo torri)', t: 'num', passo: 0.5 }],
    testo: [{ k: 'testo', nome: 'Testo', t: 'txt' }, { k: 'alto', nome: 'Altezza sul suolo (m)', t: 'num', passo: 0.5 }],
    piazza: [
        { k: 'livelli', nome: 'Piani di parcheggio sotto', t: 'num', passo: 1, min: 0, max: 4 },
        { k: 'hLiv', nome: 'Interpiano (m)', t: 'num', passo: 0.1, aiuto: `Altezza libera minima ${NORME.autorimessaH.valore} m (${NORME.autorimessaH.fonte}, da verificare)` },
        { k: 'spessore', nome: 'Spessore solaio (m)', t: 'num', passo: 0.05 },
        { k: 'campata', nome: 'Passo dei pilastri (m)', t: 'num', passo: 0.5 },
        { k: 'attacco', nome: 'Lato attaccato alla strada', t: 'num', passo: 1, min: 0, aiuto: 'Numero del lato: 0 è il primo disegnato' },
        { k: 'corsia', nome: 'Corsia di manovra (m)', t: 'num', passo: 0.5 },
        { k: 'stalloL', nome: 'Larghezza stallo (m)', t: 'num', passo: 0.1 },
        { k: 'stalloP', nome: 'Profondità stallo (m)', t: 'num', passo: 0.1 },
        { k: 'rampa', nome: 'Rampa interna dal piano strada', t: 'bool', aiuto: 'Spenta: si entra a raso dalla strada più bassa' },
        { k: 'rampaPend', nome: 'Pendenza rampa (0,16 = 16%)', t: 'num', passo: 0.01, max: 0.3, aiuto: `Massimo 20% (${NORME.rampaMax.fonte}, da verificare)` },
        { k: 'rampaPos', nome: 'Posizione rampa lungo il lato (0-1)', t: 'num', passo: 0.05, min: 0, max: 1 },
        { k: 'parapetto', nome: 'Parapetto sui lati liberi', t: 'bool' },
        { k: 'scava', nome: 'Togli dalla vista l\'esistente dentro il perimetro', t: 'bool', aiuto: 'Spento: edifici e strada sotto restano visibili. Acceso: mostra il progetto al posto dell\'esistente' },
        { k: 'pavimento', nome: 'Pavimento', t: 'sel', opz: [['#e6dccb', 'Pietra chiara'], ['#cfc8bb', 'Pietra grigia'], ['#d8c3a0', 'Travertino'], ['cotto', 'Cotto']] },
    ],
};
const DEF = { livelli: 1, hLiv: 3.2, spessore: 0.5, campata: 7.5, attacco: 0, corsia: 6, stalloL: 2.5, stalloP: 5, rampaPend: 0.16, rampaPos: 0, parapetto: true, scava: false, rampa: true, pavimento: '#e6dccb', altezza: 6, colore: '#e9d8bd', opacita: 1, rot: 0, scala: 1, alto: 0, tratto: 3, vuoto: 3, larghezza: 0.12, lato: 1 };
export function Pannello({ chiudi }) {
    const s = useS();
    const titolo = tr({ oggetto: s.sel ? 'Oggetto' : s.selEdificio ? 'Edificio' : 'Punto', livelli: 'Livelli', progetto: 'Progetti', catalogo: 'Catalogo', aiuto: 'Guida', percorso: 'Percorso', accesso: s.utente ? 'Account' : 'Accedi', utenti: 'Utenti e permessi', poi: 'Punto di interesse', via: 'Correggi le vie', evento: 'Evento' }[s.pannello] ?? '');
    return (_jsxs("aside", { className: "pannello", "aria-label": titolo, children: [_jsxs("div", { className: "pannello-testa", children: [_jsx("h2", { children: titolo }), _jsx("button", { className: "tondo quiet", onClick: chiudi, "aria-label": tr('Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), _jsxs("div", { className: "pannello-corpo", children: [s.pannello === 'oggetto' && (s.sel ? _jsx(Oggetto, {}) : s.selEdificio ? _jsx(EdificioP, {}) : _jsx(PuntoP, {})), s.pannello === 'livelli' && _jsx(Livelli, {}), s.pannello === 'progetto' && _jsx(ProgettoP, {}), s.pannello === 'catalogo' && _jsx(Catalogo, {}), s.pannello === 'aiuto' && _jsx(Aiuto, {}), s.pannello === 'accesso' && _jsx(Accesso, {}), s.pannello === 'utenti' && _jsx(Utenti, {}), s.pannello === 'poi' && _jsx(ModificaPoi, {}), s.pannello === 'via' && _jsx(CorreggiVia, {}), s.pannello === 'evento' && _jsx(ModificaEvento, {})] })] }));
}
function Oggetto() {
    const s = useS();
    const o = s.opzione().oggetti.find(x => x.id === s.sel);
    if (!o)
        return _jsx("p", { children: "Niente di scelto." });
    const set = (k, v) => s.aggiorna(o.id, x => { x.par[k] = v; });
    const P = o.tipo === 'piazza' ? calcoli.get(o.id) : undefined;
    return (_jsxs("div", { className: "campi", children: [_jsxs("label", { children: ["Nome", _jsx("input", { value: o.nome, onChange: e => s.aggiorna(o.id, x => { x.nome = e.target.value; }) })] }), P && (_jsxs("div", { className: "risultati-piazza", children: [_jsx("h3", { children: "Numeri" }), _jsxs("dl", { children: [_jsx("dt", { children: "Superficie della piazza" }), _jsx("dd", { children: fmtM2(P.area) }), _jsx("dt", { children: "Posti auto" }), _jsxs("dd", { children: [P.stalliTot, " (", P.livelli.length > 1 ? P.livelli[1].stalli.length : 0, " per piano)"] }), _jsx("dt", { children: "Sbalzo dal lato strada" }), _jsx("dd", { children: fmtM(P.sporgenza) }), _jsx("dt", { children: "Altezza massima sul terreno" }), _jsx("dd", { children: fmtM(P.altezzaSulTerreno) }), _jsx("dt", { children: "Terreno sotto" }), _jsxs("dd", { children: [P.terrenoMin.toFixed(1).replace('.', ','), " \u2013 ", P.terrenoMax.toFixed(1).replace('.', ','), " m s.l.m."] }), P.rampa && _jsxs(_Fragment, { children: [_jsx("dt", { children: "Rampa per piano" }), _jsx("dd", { children: fmtM(P.rampaL) })] }), _jsx("dt", { children: "Pilastri" }), _jsx("dd", { children: P.pilastri.length }), P.scavo > 1 && _jsxs(_Fragment, { children: [_jsx("dt", { children: "Scavo stimato" }), _jsxs("dd", { children: [Math.round(P.scavo).toLocaleString('it-IT'), " m\u00B3"] })] })] }), _jsx("h3", { children: "Controlli" }), P.interferenze.length > 0 && !googleAcceso() && _jsx("p", { className: "nota", children: "Gli edifici sotto la piazza sono in rosso. Toccandoli puoi correggerne l'altezza o toglierli in questa opzione." }), _jsx("ul", { className: "controlli", children: P.controlli.map((c, i) => _jsxs("li", { className: c.esito, children: [_jsx("span", { children: c.esito === 'ok' ? '✓' : c.esito === 'errore' ? '✕' : '!' }), c.testo, c.fonte && _jsxs("small", { children: [c.fonte, ", da verificare"] })] }, i)) })] })), P && _jsx("h3", { children: "Parametri" }), _jsxs("label", { className: "riga", children: [_jsx("span", { children: "Appoggio" }), _jsxs("select", { value: o.z === undefined ? 't' : 'q', onChange: e => s.aggiorna(o.id, x => { if (e.target.value === 't')
                            delete x.z;
                        else
                            x.z = Math.round(quota(x.pts[0][0], x.pts[0][1]) * 10) / 10; }), children: [_jsx("option", { value: "t", children: "Sul terreno" }), _jsx("option", { value: "q", children: "A una quota" })] })] }), o.z !== undefined && _jsxs("label", { children: ["Quota (m s.l.m.)", _jsx("input", { type: "number", step: 0.1, value: o.z, onChange: e => s.aggiorna(o.id, x => { x.z = Number(e.target.value); }) })] }), CAMPI[o.tipo].map(c => {
                const v = o.par[c.k] ?? DEF[c.k];
                if (c.k === 'altezza' && o.tipo === 'barriera' && o.par.tipo !== 'muro')
                    return null;
                return (_jsxs("label", { className: c.t === 'bool' ? 'riga' : '', children: [_jsx("span", { children: c.nome }), c.t === 'num' && _jsx("input", { type: "number", step: c.passo ?? 0.1, min: c.min, max: c.max, value: Number(v), onChange: e => set(c.k, Number(e.target.value)) }), c.t === 'txt' && _jsx("input", { value: String(v ?? ''), onChange: e => set(c.k, e.target.value) }), c.t === 'col' && _jsx("input", { type: "color", value: String(v ?? (o.tipo === 'area' ? USI[String(o.par.uso)]?.col : '#e9d8bd')), onChange: e => set(c.k, e.target.value) }), c.t === 'bool' && _jsx("input", { type: "checkbox", checked: v === true, onChange: e => set(c.k, e.target.checked) }), c.t === 'sel' && _jsx("select", { value: String(v), onChange: e => set(c.k, c.k === 'lato' ? Number(e.target.value) : e.target.value), children: c.opz.map(([k, n]) => _jsx("option", { value: k, children: n }, k)) }), c.aiuto && _jsx("small", { children: c.aiuto })] }, c.k));
            }), o.tipo === 'piazza' && _jsx("button", { onClick: () => set('attacco', (Number(o.par.attacco ?? 0) + 1) % o.pts.length), children: "Attacca il lato successivo alla strada" }), o.tipo === 'piazza' && P && googleAcceso() && _jsx("button", { onClick: () => {
                    // quota della strada: 2 m fuori dal lato d'attacco, sulla superficie di Google
                    const f = new Frame(o.pts[0][0], o.pts[0][1]);
                    const xy = o.pts.map(q => f.toXY(q));
                    const n = xy.length, i = ((Number(o.par.attacco ?? 0) % n) + n) % n;
                    const m = mul(add(xy[i], xy[(i + 1) % n]), 0.5);
                    const q = f.toLL(add(m, mul(P.v, -2.5)));
                    const z = quotaGoogle(q[0], q[1]);
                    if (z === undefined)
                        s.dici('Google 3D non ancora caricato lì: avvicinati e riprova');
                    else {
                        s.aggiorna(o.id, x => { x.z = Math.round(z * 10) / 10; });
                        s.dici(`Piazza alla quota della strada: ${z.toFixed(1).replace('.', ',')} m s.l.m.`);
                    }
                }, "data-tip": "Porta il piano della piazza alla quota della strada letta sul 3D di Google", children: "Piano alla quota della strada" }), _jsxs("label", { className: "riga", children: [_jsxs("span", { children: ["Nascondi dalla vista", _jsx("small", { children: "Resta nel progetto, non si disegna" })] }), _jsx("input", { type: "checkbox", checked: o.nascosto === true, onChange: e => s.aggiorna(o.id, x => { if (e.target.checked)
                            x.nascosto = true;
                        else
                            delete x.nascosto; }) })] }), _jsx(Geometria, { o: o }), _jsxs("div", { className: "bottoni", children: [_jsx("button", { onClick: () => inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1])), children: "Inquadra" }), _jsx("button", { onClick: () => s.duplica(o.id), children: "Duplica" }), _jsx("button", { className: "danger", onClick: () => s.togli(o.id), children: "Elimina" })] }), _jsx("p", { className: "nota", children: "Puoi anche trascinare l'oggetto o i suoi punti numerati." })] }));
}
function EdificioP() {
    const s = useS();
    const e = s.selEdificio ? edificio(s.selEdificio) : undefined;
    if (!e)
        return null;
    const m = s.opzione().edifici[e.id] ?? {};
    const set = (v) => s.modifica(op => { if (v)
        op.edifici[e.id] = { ...op.edifici[e.id], ...v };
    else
        delete op.edifici[e.id]; });
    const osm = e.id.startsWith('w') ? `https://www.openstreetmap.org/way/${e.id.slice(1)}` : `https://www.openstreetmap.org/relation/${e.id.slice(1).split('.')[0]}`;
    return (_jsxs("div", { className: "campi", children: [e.n && _jsx("p", { children: _jsx("b", { children: e.n }) }), _jsxs("p", { children: ["Ingombro da OpenStreetMap. ", e.stima ? 'Altezza stimata dalla superficie, non misurata.' : 'Altezza dai dati OSM.'] }), _jsxs("label", { children: ["Altezza dal lato a monte (m)", _jsx("input", { type: "number", step: 0.5, value: m.h ?? e.h, onChange: ev => set({ h: Number(ev.target.value) }) }), _jsx("small", { children: "Circa 3 m a piano. Le finestre si contano dal tetto." })] }), _jsxs("label", { className: "riga", children: [_jsx("span", { children: "Colore della facciata" }), _jsx("input", { type: "color", value: m.col ?? coloreDi(e.id), onChange: ev => set({ col: ev.target.value }) })] }), _jsx("p", { className: "nota", children: "Per copiare colore e piani dal vero, guarda l'edificio qui:" }), _jsxs("div", { className: "bottoni", children: [_jsx("a", { className: "bottone", target: "_blank", rel: "noreferrer", href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.r[0][1]},${e.r[0][0]}`, children: "Street View" }), _jsx("a", { className: "bottone", target: "_blank", rel: "noreferrer", href: `https://earth.google.com/web/@${e.r[0][1]},${e.r[0][0]},${Math.round(e.g + 47)}a,120d,35y,0h,65t,0r`, children: "Google Earth" })] }), _jsxs("p", { className: "nota", children: ["Terreno attorno: ", e.b + 1 < e.g ? `da ${(e.b + 1).toFixed(1).replace('.', ',')} a ${e.g.toFixed(1).replace('.', ',')}` : e.g.toFixed(1).replace('.', ','), " m s.l.m."] }), _jsxs("div", { className: "bottoni", children: [!m.via && _jsx("button", { className: "danger", onClick: () => { set({ via: true }); s.set({ selEdificio: null }); }, "data-tip": "Lo toglie solo in questa opzione del progetto", children: "Demolisci in questa opzione" }), (m.h !== undefined || m.via || m.col) && _jsx("button", { onClick: () => set(null), children: "Ripristina" }), _jsx("a", { className: "bottone", href: osm, target: "_blank", rel: "noreferrer", children: "Apri in OpenStreetMap" })] })] }));
}
function PuntoP() {
    const s = useS();
    const i = s.info;
    if (!i)
        return _jsx("p", { children: "Tocca un punto della mappa o un oggetto." });
    const [lon, lat] = i.p;
    return (_jsxs("div", { className: "campi", children: [_jsxs("dl", { children: [_jsx("dt", { children: "Coordinate" }), _jsxs("dd", { children: [lat.toFixed(6), ", ", lon.toFixed(6)] }), _jsx("dt", { children: "Quota" }), _jsxs("dd", { children: [i.z.toFixed(1).replace('.', ','), " m s.l.m."] }), _jsx("dt", { children: "Suolo in quel punto" }), _jsxs("dd", { children: [quota(lon, lat).toFixed(1).replace('.', ','), " m s.l.m."] })] }), _jsx("p", { className: "nota", children: "Per guardare com'\u00E8 oggi:" }), _jsxs("div", { className: "bottoni", children: [_jsx("a", { className: "bottone", target: "_blank", rel: "noreferrer", href: `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`, children: "Street View" }), _jsx("a", { className: "bottone", target: "_blank", rel: "noreferrer", href: `https://earth.google.com/web/@${lat},${lon},${Math.round(i.z + 47)}a,180d,35y,0h,60t,0r`, children: "Google Earth" }), _jsx("a", { className: "bottone", target: "_blank", rel: "noreferrer", href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=19/${lat}/${lon}`, children: "OpenStreetMap" }), _jsx("button", { onClick: () => navigator.clipboard?.writeText(`${lat.toFixed(6)}, ${lon.toFixed(6)}`), children: "Copia coordinate" })] }), _jsx(Misure, {})] }));
}
function Misure() {
    const s = useS();
    const m = s.misure.filter(x => x.pts.length);
    if (!m.length)
        return null;
    return _jsxs(_Fragment, { children: [_jsx("h3", { children: "Misure" }), _jsx("ul", { className: "misure", children: m.map(x => _jsx("li", { children: risultato(x) || '…' }, x.id)) })] });
}
function Livelli() {
    const s = useS();
    const mod = s.inModifica && puoModificare(s.utente);
    const l = s.livelli;
    const casella = (k, nome, aiuto) => (_jsxs("label", { className: "riga", children: [_jsxs("span", { children: [tr(nome), aiuto && _jsx("small", { children: tr(aiuto) })] }), _jsx("input", { type: "checkbox", checked: Boolean(l[k]), onChange: e => s.setLivelli({ [k]: e.target.checked }) })] }));
    return (_jsxs("div", { className: "campi", children: [_jsxs("div", { className: "segmenti", role: "radiogroup", "aria-label": tr('Tipo di mappa'), children: [_jsxs("button", { role: "radio", "aria-checked": l.google, className: l.google ? 'acceso' : '', onClick: () => s.setLivelli({ google: true, orto: 'esri' }), children: [_jsx(Icona, { n: "photo_camera" }), tr('Foto 3D')] }), _jsxs("button", { role: "radio", "aria-checked": !l.google && l.orto === 'mappa', className: !l.google && l.orto === 'mappa' ? 'acceso' : '', onClick: () => s.setLivelli({ google: false, orto: 'mappa', strade: true }), children: [_jsx(Icona, { n: "map" }), tr('Mappa')] })] }), l.google && (_jsxs("label", { children: [tr('Attenua il 3D'), ": ", Math.round((l.attenua ?? 0) * 100), "%", _jsx("input", { type: "range", min: 0, max: 0.9, step: 0.05, value: l.attenua ?? 0, onChange: e => s.setLivelli({ attenua: Number(e.target.value) }) }), _jsx("small", { children: tr('Schiarisce le foto del 3D: vie, percorsi e punti risaltano di più') })] })), !l.google && (_jsxs("label", { children: [tr('Immagine del suolo'), _jsxs("select", { value: l.orto, onChange: e => s.setLivelli({ orto: e.target.value }), children: [_jsx("option", { value: "mappa", children: tr('Mappa semplice') }), _jsx("option", { value: "esri", children: tr('Satellite') }), _jsx("option", { value: "osm", children: tr('Mappa OpenStreetMap') }), mod && _jsx("option", { value: "pcn2012", children: "Ortofoto 2012 (Geoportale Nazionale, a volte non risponde)" })] })] })), mod && casella('edifici', 'Edifici (OpenStreetMap)', 'Volumi semplici, altezze stimate'), mod && l.edifici && (_jsxs("label", { children: ["Aspetto degli edifici", _jsxs("select", { value: l.stile, onChange: e => s.setLivelli({ stile: e.target.value }), children: [_jsx("option", { value: "plastico", children: "Plastico (volumi puliti)" }), _jsx("option", { value: "facciate", children: "Facciate disegnate (finestre e balconi)" })] })] })), casella('strade', 'Vie, scale e sentieri', 'Tocca un colore per cambiarlo'), l.strade && (_jsxs("div", { className: "colori-vie", children: [GRUPPI_VIE.map(g => (_jsxs("label", { className: "colore", children: [_jsx("input", { type: "color", value: l.coloriVie?.[g.k] ?? s.coloriBase[g.k] ?? g.col, onChange: e => s.setLivelli({ coloriVie: { ...l.coloriVie, [g.k]: e.target.value } }) }), tr(g.nome)] }, g.k))), Object.keys(l.coloriVie ?? {}).length > 0 && _jsx("button", { className: "quiet", onClick: () => s.setLivelli({ coloriVie: {} }), children: tr('Torna ai colori di base') }), s.utente?.ruolo === 'admin' && _jsx("button", { onClick: async () => {
                            const v = Object.fromEntries(GRUPPI_VIE.map(g => [g.k, l.coloriVie?.[g.k] ?? s.coloriBase[g.k] ?? g.col]));
                            try {
                                await chiama('impostazioni/coloriVie', 'PUT', { v });
                                s.set({ coloriBase: v });
                                s.setLivelli({ coloriVie: {} });
                                s.dici('Colori di base salvati per tutti');
                            }
                            catch (e) {
                                s.dici(e.message);
                            }
                        }, "data-tip": "Diventano i colori che vede chiunque apra il sito", children: "Usa questi colori per tutti" })] })), casella('nomi', 'Nomi dei luoghi'), casella('confine', 'Confine comunale'), mod && !s.ionTokenSito && !s.googleKey && (l.google || !s.ionToken) && (_jsxs("label", { children: ["Codice Cesium ion", _jsx("input", { type: "password", value: s.ionToken, placeholder: "Incolla il codice di accesso", onChange: e => s.set({ ionToken: e.target.value.trim() }) }), _jsx("small", { children: "Account gratuito su ion.cesium.com, sezione Access Tokens. Resta solo in questo browser." })] })), _jsxs("label", { children: [tr('Qualità e velocità'), _jsxs("select", { value: l.qualita, onChange: e => s.setLivelli({ qualita: e.target.value }), children: [_jsx("option", { value: "leggera", children: tr('Leggera: veloce, adatta al telefono') }), _jsx("option", { value: "normale", children: tr('Normale') }), _jsx("option", { value: "alta", children: tr('Alta: più dettaglio, serve un telefono o computer potente') })] })] }), mod && casella('progetto', 'Oggetti di progetto', 'Spento: si vede Positano com\'è oggi'), casella('nitido', 'Immagine più nitida', 'Più dettaglio e colore sulle foto aeree'), mod && casella('ombre', 'Sole e ombre', 'Gli oggetti di progetto fanno ombra sul paese. Rallenta molto'), mod && l.ombre && (_jsxs(_Fragment, { children: [_jsxs("label", { children: ["Giorno", _jsx("input", { type: "date", value: l.giorno, onChange: e => s.setLivelli({ giorno: e.target.value }) })] }), _jsxs("label", { children: ["Ora: ", Math.floor(l.ora), ":", String(Math.round((l.ora % 1) * 60)).padStart(2, '0'), _jsx("input", { type: "range", min: 5, max: 21, step: 0.25, value: l.ora, onChange: e => s.setLivelli({ ora: Number(e.target.value) }) })] })] }))] }));
}
function ProgettoP() {
    const s = useS();
    const p = s.progetto();
    const file = useRef(null);
    const [conferma, setConferma] = useState(false);
    const esporta = () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(p, null, 1)], { type: 'application/json' }));
        a.download = `${p.nome}.posimulatore.json`;
        a.click();
    };
    const importa = async (f) => {
        try {
            const j = JSON.parse(await f.text());
            if (!j.opzioni)
                throw new Error();
            s.importa(j);
            s.dici('Progetto importato');
        }
        catch {
            s.dici('File non valido');
        }
    };
    return (_jsxs("div", { className: "campi", children: [_jsxs("label", { children: ["Nome del progetto", _jsx("input", { value: p.nome, onChange: e => s.rinominaProgetto(e.target.value) })] }), _jsx("h3", { children: "Opzioni" }), _jsx("div", { className: "schede", children: p.opzioni.map(o => _jsxs("button", { className: o.id === p.attiva ? 'acceso' : '', onClick: () => s.apriOpzione(o.id), children: [o.nome, " ", _jsx("small", { children: o.oggetti.length })] }, o.id)) }), _jsxs("div", { className: "bottoni", children: [_jsx("button", { onClick: () => s.nuovaOpzione(true), "data-tip": "Copia l'opzione aperta per provare una variante", children: "+ Opzione (copia)" }), _jsx("button", { onClick: () => s.nuovaOpzione(false), children: "+ Opzione vuota" })] }), _jsx("h3", { children: "Oggetti" }), _jsxs("ul", { className: "elenco", children: [s.opzione().oggetti.map(o => (_jsxs("li", { className: "riga-oggetto", children: [_jsx("button", { className: (o.id === s.sel ? 'acceso' : '') + (o.nascosto ? ' spento' : ''), onClick: () => { s.set({ sel: o.id, pannello: 'oggetto' }); inquadra(o.pts, o.z ?? quota(o.pts[0][0], o.pts[0][1])); }, children: o.nome }), _jsx("button", { className: "quiet occhio", "aria-pressed": !o.nascosto, "aria-label": o.nascosto ? `Mostra ${o.nome}` : `Nascondi ${o.nome}`, "data-tip": o.nascosto ? 'Mostra' : 'Nascondi dalla vista', onClick: () => s.aggiorna(o.id, x => { if (x.nascosto)
                                    delete x.nascosto;
                                else
                                    x.nascosto = true; }), children: o.nascosto ? 'Mostra' : 'Nascondi' })] }, o.id))), !s.opzione().oggetti.length && _jsx("li", { className: "nota", children: "Ancora niente: scegli uno strumento a sinistra." })] }), _jsx("h3", { children: "Tutti i progetti" }), _jsx("ul", { className: "elenco", children: s.progetti.map(x => _jsx("li", { children: _jsx("button", { className: x.id === p.id ? 'acceso' : '', onClick: () => s.apriProgetto(x.id), children: x.nome }) }, x.id)) }), _jsxs("div", { className: "bottoni", children: [_jsx("button", { className: "primary", onClick: () => s.nuovoProgetto('Progetto ' + (s.progetti.length + 1)), children: "+ Progetto" }), _jsx("button", { onClick: esporta, children: "Esporta" }), _jsx("button", { onClick: () => file.current?.click(), children: "Importa" }), !conferma ? _jsx("button", { className: "danger", onClick: () => setConferma(true), children: "Elimina" })
                        : _jsxs(_Fragment, { children: [_jsxs("button", { className: "danger", onClick: () => { s.eliminaProgetto(p.id); setConferma(false); }, children: ["S\u00EC, elimina \u00AB", p.nome, "\u00BB"] }), _jsx("button", { onClick: () => setConferma(false), children: "No" })] })] }), _jsx("input", { ref: file, type: "file", accept: ".json,application/json", hidden: true, onChange: e => e.target.files?.[0] && importa(e.target.files[0]) }), _jsx("p", { className: "nota", children: "I progetti restano in questo browser. Esporta per conservarli o passarli a un altro dispositivo." })] }));
}
function Catalogo() {
    const s = useS();
    const gruppi = [...new Set(CATALOGO.map(m => m.gruppo))];
    return (_jsx("div", { className: "campi", children: gruppi.map(g => (_jsxs("div", { children: [_jsx("h3", { children: g }), _jsx("div", { className: "griglia", children: CATALOGO.filter(m => m.gruppo === g).map(m => (_jsxs("button", { onClick: () => s.set({ strumento: modelloStrumento(m.id, m.nome), bozza: [], pannello: null }), "data-tip": m.nota ?? `${m.dim[0]} x ${m.dim[1]} m, alto ${m.dim[2]} m`, children: [m.nome, _jsxs("small", { children: [m.dim[0], "\u00D7", m.dim[1], " m"] })] }, m.id))) })] }, g))) }));
}
function Aiuto() {
    const s = useS();
    const mod = s.inModifica && puoModificare(s.utente);
    const voce = (titolo, testo) => _jsxs("li", { children: [_jsx("b", { children: tr(titolo) }), ": ", tr(testo)] });
    return (_jsxs("div", { className: "campi testo", children: [_jsx("h3", { children: tr('Come si usa') }), _jsxs("ul", { children: [voce('Muoversi', 'un dito sposta la mappa, due dita avvicinano e ruotano, due dita in su o in giù inclinano. Se ti perdi, il pulsante con le frecce rimette la vista.'), voce('Cercare', 'scrivi nella barra in alto una via, un luogo, un negozio o un servizio. Tocca un risultato per vederlo sulla mappa.'), voce('Servizi', 'i bottoni sotto la barra mostrano bagni, fermate, biglietti, parcheggi, traghetti e farmacie.'), voce('Percorso', 'scegli due o più tappe dalla ricerca, dalla mappa, dalla tua posizione o da Casa; trascinale per cambiare ordine. Vedi il tempo a piedi, le scale, la salita e le alternative.'), voce('Casa', 'il pulsante con la casetta ricorda dove alloggi e ti riporta lì.'), voce('Dove sono', 'il pulsante col mirino mostra la tua posizione col GPS del telefono.'), voce('Livelli', 'foto 3D o mappa semplice, 3D più chiaro, colori delle vie, qualità.'), voce('Street View', 'in un punto o lungo il percorso, le foto a 360° di Google.'), voce('Condividi', 'ogni punto e ogni percorso ha un link da mandare su WhatsApp.')] }), mod && _jsxs(_Fragment, { children: [_jsx("h3", { children: "Per chi modifica" }), _jsxs("ul", { children: [_jsxs("li", { children: [_jsx("b", { children: "Disegnare" }), ": scegli uno strumento e tocca la mappa. Doppio clic, Invio o \u00ABFine\u00BB chiudono. Esc annulla."] }), _jsxs("li", { children: [_jsx("b", { children: "Modificare" }), ": tocca un oggetto, cambia i valori nel pannello, trascina l'oggetto o i punti azzurri. Canc lo elimina, Ctrl+Z annulla."] }), _jsxs("li", { children: [_jsx("b", { children: "Edifici" }), ": tocca un edificio per correggerne l'altezza o toglierlo in un'opzione."] }), _jsxs("li", { children: [_jsx("b", { children: "Opzioni" }), ": in \u00ABProgetti\u00BB copi l'opzione aperta per confrontare varianti."] }), _jsxs("li", { children: [_jsx("b", { children: "Vie" }), ": correggi il tracciato sul satellite, anche pi\u00F9 punti insieme."] }), _jsxs("li", { children: [_jsx("b", { children: "Eventi" }), ": compaiono sulla mappa solo mentre sono in corso."] }), _jsxs("li", { children: [_jsx("b", { children: "QR" }), ": dal percorso, \u00ABCrea QR da stampare\u00BB: chi lo inquadra vede solo quel percorso."] })] })] }), _jsx("h3", { children: tr('Da dove vengono i dati') }), _jsxs("ul", { children: [_jsxs("li", { children: [tr('Foto 3D'), ": Google Map Tiles API, ", tr('solo da guardare'), "."] }), _jsxs("li", { children: [tr('Terreno'), ": TINITALY 1.1, INGV, 10 m (CC BY 4.0); ", tr('vie'), ": LiDAR 2 m, PST-A, ", tr('Ministero dell\'Ambiente'), "."] }), _jsxs("li", { children: [tr('Vie, luoghi e confine'), ": \u00A9 OpenStreetMap contributors (ODbL)."] }), _jsxs("li", { children: [tr('Satellite e mappa semplice'), ": Esri."] })] }), _jsx("p", { className: "nota", children: tr('Tempi e quote sono indicativi: in paese ci sono molte scale, calcola qualche minuto in più.') })] }));
}

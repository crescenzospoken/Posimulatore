import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { portamiA } from './tappe';
import { useRicerca } from './ricerca';
import { t, linguaAttuale } from '../i18n';
import { useEffect, useState } from 'react';
import { useS } from '../store';
import { Icona } from './Icona';
import { CATEGORIE, categoria, orariLeggibili } from '../engine/poi';
import { poiDa, ricaricaPoi } from '../scene/poi';
import { elencoEventi, inCorso } from '../scene/eventi';
import { centraSu } from '../scene/gps';
import { dentroPositano } from '../scene/gps';
/** Chiamata alle API: JSON, intestazione propria (le scritture la richiedono) e messaggio d'errore leggibile. */
export async function chiama(via, metodo = 'GET', corpo) {
    const r = await fetch('/api/' + via, { method: metodo, headers: { 'Content-Type': 'application/json', 'X-Posimulatore': '1' }, body: corpo === undefined ? undefined : JSON.stringify(corpo), credentials: 'same-origin' });
    const j = await r.json().catch(() => null);
    if (!r.ok)
        throw new Error(j?.errore ?? 'Il server non risponde, riprova');
    // senza Worker (sviluppo) arriva la pagina HTML al posto del JSON
    if (j === null && via !== 'io')
        throw new Error('Il server non risponde, riprova');
    return j;
}
export const puoModificare = (u) => u?.ruolo === 'editor' || u?.ruolo === 'admin';
/** Fila di categorie da accendere e spegnere, come i filtri di Google Maps. */
export function Servizi() {
    const s = useS();
    const [tutte, setTutte] = useState(false);
    const on = new Set(s.poiCat);
    const cambia = (k) => s.set({ poiCat: on.has(k) ? s.poiCat.filter(x => x !== k) : [...s.poiCat, k] });
    const lista = tutte ? CATEGORIE : CATEGORIE.filter(c => c.base || on.has(c.k));
    // eventi in corso: primo filtro, porta al primo e apre la scheda
    const ora = elencoEventi().filter(e => inCorso(e));
    return (_jsxs("div", { className: "servizi", role: "toolbar", "aria-label": t('Punti di interesse'), children: [ora.length > 0 && _jsxs("button", { className: "chip evento-chip", onClick: () => { const e = ora[0]; centraSu([e.lon, e.lat]); s.set({ selEvento: e.id, selPoi: null, selGoogle: null }); }, children: [_jsx("span", { className: "chip-icona", children: _jsx(Icona, { n: "celebration" }) }), ora.length === 1 ? (s.lingua === 'en' && ora[0].titolo_en) || ora[0].titolo : `${ora.length} ${t('eventi in corso')}`] }), lista.map(c => (_jsxs("button", { className: 'chip' + (on.has(c.k) ? ' acceso' : ''), "aria-pressed": on.has(c.k), onClick: () => cambia(c.k), children: [_jsx("span", { className: "chip-icona", style: { color: c.col }, children: _jsx(Icona, { n: c.s }) }), t(c.nome)] }, c.k))), _jsx("button", { className: "chip quiet", onClick: () => setTutte(!tutte), children: tutte ? t('Meno') : t('Altri…') })] }));
}
/** Scheda di un punto di interesse: nome, categoria, note, orari, «Portami qui». */
export function SchedaPoi() {
    const s = useS();
    const p = s.selPoi ? poiDa(s.selPoi) : undefined;
    if (!p)
        return null;
    const c = categoria(p.c);
    const portami = () => portamiA({ p: p.p, nome: p.n ?? c.nome });
    const x = p.x ?? {};
    return (_jsxs("section", { className: "scheda-poi", "aria-label": p.n ?? c.nome, children: [_jsxs("div", { className: "pannello-testa", children: [_jsxs("h2", { children: [_jsx("span", { className: "icona-tonda", style: { background: c.col }, children: _jsx(Icona, { n: c.s }) }), p.n ?? t(c.nome)] }), _jsx("button", { className: "tondo quiet", onClick: () => s.set({ selPoi: null }), "aria-label": t('Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), _jsxs("p", { className: "nota", children: [t(c.nome), p.nascosto ? ' · ' + t('nascosto ai visitatori') : ''] }), p.note && _jsx("p", { children: p.note }), x.opening_hours && _jsxs("p", { children: [t('Orari'), ": ", linguaAttuale() === 'it' ? orariLeggibili(x.opening_hours) : x.opening_hours] }), x.fee && _jsx("p", { children: x.fee === 'yes' ? t('A pagamento') : x.fee === 'no' ? t('Gratuito') : x.fee }), x.wheelchair === 'yes' && _jsx("p", { children: t('Accessibile in sedia a rotelle') }), x.phone && _jsx("p", { children: _jsx("a", { href: 'tel:' + x.phone.replace(/\s/g, ''), children: x.phone }) }), _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: "primary", onClick: portami, children: [_jsx(Icona, { n: "directions" }), t('Portami qui')] }), _jsxs("button", { className: "quiet", onClick: () => s.set({ vista360: { modo: 'punto', p: p.p, titolo: p.n ?? t(c.nome) } }), children: [_jsx(Icona, { n: "streetview" }), "Street View"] }), _jsxs("button", { className: "quiet", onClick: () => condividi(p.n ?? c.nome, linkPunto({ id: p.id, p: p.p, nome: p.n }, true), s.dici), children: [_jsx(Icona, { n: "share" }), t('Condividi')] }), puoModificare(s.utente) && s.inModifica && _jsx("button", { onClick: () => s.set({ pannello: 'poi' }), children: t('Modifica') })] }), _jsx("p", { className: "nota", children: p.fonte === 'osm' ? t('Dati © OpenStreetMap') : t('Aggiunto dal Comune') })] }));
}
/** Pannello per aggiungere o correggere un punto (solo editor). Il punto nuovo nasce col clic sulla mappa. */
export function ModificaPoi() {
    const s = useS();
    const p = s.selPoi ? poiDa(s.selPoi) : undefined;
    const nuovo = s.selPoi?.startsWith('nuovo:');
    const [d, setD] = useState({ c: p?.c ?? 'bagni', n: p?.n ?? '', note: p?.note ?? '', nascosto: !!p?.nascosto });
    const [lavoro, setLavoro] = useState(false);
    useEffect(() => { setD({ c: p?.c ?? d.c, n: p?.n ?? '', note: p?.note ?? '', nascosto: !!p?.nascosto }); }, [s.selPoi]);
    const coord = s.poiPos ?? p?.p ?? (nuovo && s.selPoi ? s.selPoi.split(':').slice(1, 3).map(Number) : null);
    if (!coord)
        return _jsx("p", { className: "nota", children: "Tocca un punto della mappa per aggiungerlo, o un simbolo per correggerlo." });
    const id = nuovo ? 'mano:' + Math.random().toString(36).slice(2, 10) : s.selPoi;
    const salva = async () => {
        setLavoro(true);
        try {
            await chiama('poi/' + encodeURIComponent(id), 'PUT', { ...d, lon: coord[0], lat: coord[1] });
            await ricaricaPoi();
            s.set({ selPoi: id, poiPos: null, googleGiro: s.googleGiro + 1, poiCat: s.poiCat.includes(d.c) ? s.poiCat : [...s.poiCat, d.c] });
            s.dici('Salvato: lo vedono tutti');
        }
        catch (e) {
            s.dici(e.message);
        }
        finally {
            setLavoro(false);
        }
    };
    const togli = async () => {
        setLavoro(true);
        try {
            await chiama('poi/' + encodeURIComponent(id), 'DELETE');
            await ricaricaPoi();
            s.set({ selPoi: null, pannello: null, googleGiro: s.googleGiro + 1 });
            s.dici(p?.fonte === 'osm' ? 'Tornato com\'era su OpenStreetMap' : 'Punto eliminato');
        }
        catch (e) {
            s.dici(e.message);
        }
        finally {
            setLavoro(false);
        }
    };
    return (_jsxs("div", { className: "campi", children: [_jsxs("label", { children: ["Categoria", _jsx("select", { value: d.c, onChange: e => setD({ ...d, c: e.target.value }), children: CATEGORIE.map(c => _jsx("option", { value: c.k, children: c.nome }, c.k)) })] }), _jsxs("label", { children: ["Nome", _jsx("input", { value: d.n, maxLength: 80, placeholder: "Es. Bagni pubblici di Piazza dei Mulini", onChange: e => setD({ ...d, n: e.target.value }) })] }), _jsxs("label", { children: ["Note per chi lo cerca", _jsx("textarea", { value: d.note, maxLength: 400, rows: 3, placeholder: "Orari, prezzo, come si arriva", onChange: e => setD({ ...d, note: e.target.value }) })] }), _jsxs("label", { className: "riga", children: [_jsxs("span", { children: ["Nascondi ai visitatori", _jsx("small", { children: "Resta visibile solo a chi modifica" })] }), _jsx("input", { type: "checkbox", checked: d.nascosto, onChange: e => setD({ ...d, nascosto: e.target.checked }) })] }), _jsxs("p", { className: "nota", children: ["Posizione ", coord[1].toFixed(6), ", ", coord[0].toFixed(6), s.poiPos ? ' (nuova, da salvare)' : ''] }), _jsx("button", { className: 'quiet' + (s.spostaPoi ? ' acceso' : ''), "aria-pressed": s.spostaPoi, onClick: () => s.set({ spostaPoi: !s.spostaPoi, strumento: { k: 'poi' } }), children: s.spostaPoi ? 'Tocca la mappa dove va' : 'Sposta sulla mappa' }), _jsxs("div", { className: "riga-bottoni", children: [_jsx("button", { className: "primary", disabled: lavoro, onClick: salva, children: nuovo ? 'Aggiungi' : 'Salva' }), !nuovo && (p?.fonte === 'mano' || p?.nascosto || p?.note) && _jsx("button", { className: "danger", disabled: lavoro, onClick: togli, children: p?.fonte === 'osm' ? 'Annulla le correzioni' : 'Elimina' })] })] }));
}
/** Accesso e registrazione. Chi si registra resta in attesa finché l'amministratore non lo abilita. */
export function Accesso() {
    const s = useS();
    const [modo, setModo] = useState('accedi');
    const [d, setD] = useState({ email: '', nome: '', password: '' });
    const [err, setErr] = useState(null);
    const [lavoro, setLavoro] = useState(false);
    if (s.utente) {
        const u = s.utente;
        return (_jsxs("div", { className: "campi", children: [_jsxs("p", { children: [t('Hai fatto l\'accesso come'), " ", _jsx("b", { children: u.nome }), " (", u.email, ")."] }), _jsx(RigaCasa, {}), u.ruolo === 'attesa' && _jsx("p", { className: "nota", children: t('Il tuo account aspetta di essere abilitato dall\'amministratore. Intanto puoi usare la mappa come tutti.') }), puoModificare(u) && _jsxs("label", { className: "riga", children: [_jsxs("span", { children: ["Modalit\u00E0 modifica", _jsx("small", { children: "Progetti, disegno, edifici, punti di interesse" })] }), _jsx("input", { type: "checkbox", checked: s.inModifica, onChange: e => s.set({ inModifica: e.target.checked }) })] }), u.ruolo === 'admin' && _jsx("button", { onClick: () => s.set({ pannello: 'utenti' }), children: "Utenti e permessi" }), _jsx("button", { className: "quiet", onClick: async () => { try {
                        await chiama('esci', 'POST');
                    }
                    catch { /* già fuori */ } s.set({ utente: null, inModifica: false, pannello: null }); s.dici(t('Sei uscito')); }, children: t('Esci') })] }));
    }
    const invia = async (e) => {
        e.preventDefault();
        setErr(null);
        setLavoro(true);
        try {
            const u = await chiama(modo, 'POST', d);
            s.set({ utente: u, inModifica: puoModificare(u), pannello: puoModificare(u) ? null : 'accesso' });
            s.dici(modo === 'registrati' ? 'Registrazione fatta' : 'Bentornato, ' + u.nome);
        }
        catch (x) {
            setErr(x.message);
        }
        finally {
            setLavoro(false);
        }
    };
    return (_jsxs("form", { className: "campi", onSubmit: invia, children: [_jsx(RigaCasa, {}), _jsx("p", { className: "nota", children: t('La mappa è aperta a tutti. L\'accesso serve a chi progetta e aggiorna i punti di interesse.') }), modo === 'registrati' && _jsxs("label", { children: [t('Nome e cognome'), _jsx("input", { value: d.nome, autoComplete: "name", onChange: e => setD({ ...d, nome: e.target.value }), required: true })] }), _jsxs("label", { children: [t('Email'), _jsx("input", { type: "email", value: d.email, autoComplete: "email", onChange: e => setD({ ...d, email: e.target.value }), required: true })] }), _jsxs("label", { children: [t('Password'), _jsx("input", { type: "password", value: d.password, autoComplete: modo === 'accedi' ? 'current-password' : 'new-password', minLength: modo === 'registrati' ? 8 : undefined, onChange: e => setD({ ...d, password: e.target.value }), required: true }), modo === 'registrati' && _jsx("small", { children: t('Almeno 8 caratteri') })] }), err && _jsx("p", { className: "errore-campo", role: "alert", children: err }), _jsx("button", { className: "primary", disabled: lavoro, children: modo === 'accedi' ? 'Accedi' : 'Registrati' }), _jsx("button", { type: "button", className: "quiet", onClick: () => { setModo(modo === 'accedi' ? 'registrati' : 'accedi'); setErr(null); }, children: modo === 'accedi' ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi' }), modo === 'registrati' && _jsx("p", { className: "nota", children: t('Dopo la registrazione l\'amministratore abilita il tuo account alla modifica.') })] }));
}
/** Elenco utenti per l'amministratore: abilita, togli i permessi, elimina. */
export function Utenti() {
    const s = useS();
    const [r, setR] = useState(null);
    const [err, setErr] = useState(null);
    const leggi = () => chiama('utenti').then(setR, e => setErr(e.message));
    useEffect(() => { leggi(); }, []);
    const ruolo = async (email, ruolo) => { try {
        await chiama('utenti/' + encodeURIComponent(email), 'PUT', { ruolo });
        leggi();
    }
    catch (e) {
        s.dici(e.message);
    } };
    const [togliendo, setTogliendo] = useState(null);
    if (err)
        return _jsx("p", { className: "errore-campo", children: err });
    if (!r)
        return _jsx("p", { className: "nota", children: "Carico\u2026" });
    return (_jsxs("div", { className: "campi", children: [_jsx("p", { className: "nota", children: "\u00ABEditor\u00BB pu\u00F2 progettare e aggiornare i punti di interesse. \u00ABAmministratore\u00BB anche gestire gli utenti e i colori di base." }), _jsx("ul", { className: "elenco-utenti", children: r.map(u => (_jsxs("li", { children: [_jsxs("span", { children: [_jsx("b", { children: u.nome }), _jsxs("small", { children: [u.email, " \u00B7 dal ", new Date(u.creato).toLocaleDateString('it-IT')] })] }), u.email === s.utente?.email ? _jsx("small", { children: "tu" }) : _jsxs(_Fragment, { children: [_jsxs("select", { value: u.ruolo, onChange: e => ruolo(u.email, e.target.value), "aria-label": 'Ruolo di ' + u.nome, children: [_jsx("option", { value: "attesa", children: "In attesa" }), _jsx("option", { value: "editor", children: "Editor" }), _jsx("option", { value: "admin", children: "Amministratore" })] }), togliendo === u.email
                                    ? _jsx("button", { className: "danger", onClick: async () => { try {
                                            await chiama('utenti/' + encodeURIComponent(u.email), 'DELETE');
                                            setTogliendo(null);
                                            leggi();
                                        }
                                        catch (e) {
                                            s.dici(e.message);
                                        } }, children: "Conferma" })
                                    : _jsx("button", { className: "quiet danger", onClick: () => setTogliendo(u.email), "aria-label": 'Elimina ' + u.nome, children: "\u2715" })] })] }, u.email))) })] }));
}
/** Benvenuto per chi apre il sito: il punto «Casa» (dove alloggia), da posizione, mappa o ricerca. Diventa la partenza dei percorsi. */
export function SchedaCasa() {
    const s = useS();
    const [q, setQ] = useState('');
    const [cambia, setCambia] = useState(false);
    const { nostri: ris, google } = useRicerca(q);
    const fissa = (x) => { s.set({ casa: { p: x.p, nome: x.nome || 'Casa' }, scegliCasa: false, casaAperta: false }); centraSu(x.p); };
    const posizione = () => {
        if (!navigator.geolocation) {
            s.dici(t('Questo dispositivo non dà la posizione'));
            return;
        }
        navigator.geolocation.getCurrentPosition(g => { const p = [g.coords.longitude, g.coords.latitude]; if (!dentroPositano(p)) {
            s.dici(t('Sei fuori Positano: tocca la mappa o cerca un indirizzo'));
            return;
        } fissa({ p, nome: 'Casa' }); }, e => s.dici(e.code === e.PERMISSION_DENIED ? 'Posizione non permessa: tocca la mappa o cerca un indirizzo' : 'Posizione non disponibile adesso'), { enableHighAccuracy: true, timeout: 10000 });
    };
    if (s.scegliCasa)
        return (_jsxs("div", { className: "guida-strumento vetro", children: [_jsx("b", { children: t('Casa') }), _jsx("span", { children: t('Tocca la mappa dove vuoi la tua Casa') }), _jsx("button", { className: "quiet", onClick: () => s.set({ scegliCasa: false }), children: t('Annulla') })] }));
    return (_jsxs("section", { className: "scheda-poi scheda-casa", "aria-label": t('Il tuo punto Casa'), children: [_jsxs("div", { className: "pannello-testa", children: [_jsxs("h2", { children: [_jsx("span", { className: "icona-tonda", style: { background: '#0b6bcb' }, children: _jsx(Icona, { n: "home" }) }), s.casa && !cambia ? (s.casa.nome && s.casa.nome !== 'Casa' ? s.casa.nome : t('Casa')) : t('Scegli il tuo punto Casa')] }), _jsx("button", { className: "tondo quiet", onClick: () => s.set({ casaAperta: false }), "aria-label": t('Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), s.casa && !cambia ? _jsx(_Fragment, { children: _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: "primary", onClick: () => { s.set({ casaAperta: false }); portamiA(s.casa); }, children: [_jsx(Icona, { n: "directions" }), t('Portami a Casa')] }), _jsxs("button", { onClick: () => setCambia(true), children: [_jsx(Icona, { n: "edit" }), t('Cambia')] })] }) }) : _jsxs(_Fragment, { children: [_jsx("p", { className: "nota", children: t('I percorsi partono da qui e la ritrovi con un tocco sulla casetta.') }), _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: "primary", onClick: posizione, children: [_jsx(Icona, { n: "my_location" }), t('Sono qui')] }), _jsxs("button", { onClick: () => s.set({ scegliCasa: true }), children: [_jsx(Icona, { n: "location_on" }), t('Tocca la mappa')] })] }), _jsxs("div", { className: "cerca", style: { marginTop: 10 }, children: [_jsx("input", { value: q, onChange: e => setQ(e.target.value), placeholder: t('Cerca hotel, via o luogo'), "aria-label": t('Cerca il tuo alloggio') }), (ris.length > 0 || google.length > 0) && _jsxs("ul", { className: "risultati vetro", children: [ris.map(x => _jsx("li", { children: _jsxs("button", { onClick: () => fissa({ p: x.p, nome: x.nome }), children: [_jsx(Icona, { n: "location_on" }), _jsx("span", { children: x.nome }), _jsx("small", { children: t(x.tipo) })] }) }, x.nome + x.tipo + (x.poi ?? ''))), google.length > 0 && _jsx("li", { className: "titoletto", children: t('Da Google Maps') }), google.map(g => _jsx("li", { children: _jsxs("button", { onClick: () => fissa({ p: g.p, nome: g.nome }), children: [_jsx(Icona, { n: "hotel" }), _jsx("span", { children: g.nome }), _jsx("small", { children: g.tipo ?? g.indirizzo })] }) }, 'g' + g.id)), google.length > 0 && _jsx("li", { className: "attribuzione-google", children: t('Risultati di Google') })] })] })] })] }));
}
/** Il punto Casa nel pannello dell'account: si cambia o si toglie. */
function RigaCasa() {
    const s = useS();
    return (_jsxs("div", { className: "riga-casa", children: [_jsx(Icona, { n: "home" }), _jsx("span", { children: s.casa ? _jsxs(_Fragment, { children: ["Casa: ", _jsx("b", { children: s.casa.nome && s.casa.nome !== 'Casa' ? s.casa.nome : 'punto scelto' })] }) : 'Nessun punto Casa' }), _jsx("button", { type: "button", className: "quiet", onClick: () => s.set({ casaAperta: true, pannello: null }), children: s.casa ? 'Cambia' : 'Scegli' })] }));
}
/** Scheda di un luogo di Google trovato con la ricerca: nome, tipo, indirizzo, «Portami qui», «Apri in Google Maps». Niente si salva. */
export function SchedaGoogle() {
    const s = useS();
    const g = s.selGoogle;
    if (!g)
        return null;
    const portami = () => portamiA({ p: g.p, nome: g.nome });
    return (_jsxs("section", { className: "scheda-poi", "aria-label": g.nome, children: [_jsxs("div", { className: "pannello-testa", children: [_jsxs("h2", { children: [_jsx("span", { className: "icona-tonda", style: { background: '#c5221f' }, children: _jsx(Icona, { n: "location_on" }) }), g.nome] }), _jsx("button", { className: "tondo quiet", onClick: () => s.set({ selGoogle: null }), "aria-label": t('Chiudi'), children: _jsx(Icona, { n: "close" }) })] }), g.tipo && _jsx("p", { className: "nota", children: g.tipo }), g.indirizzo && _jsx("p", { children: g.indirizzo }), _jsxs("div", { className: "riga-bottoni", children: [_jsxs("button", { className: "primary", onClick: portami, children: [_jsx(Icona, { n: "directions" }), t('Portami qui')] }), g.url && _jsxs("a", { className: "bottone", href: g.url, target: "_blank", rel: "noopener", children: [_jsx(Icona, { n: "open_in_new" }), t('Orari e recensioni')] }), _jsxs("button", { className: "quiet", onClick: () => s.set({ vista360: { modo: 'punto', p: g.p, titolo: g.nome } }), children: [_jsx(Icona, { n: "streetview" }), "Street View"] }), _jsxs("button", { className: "quiet", onClick: () => condividi(g.nome, linkPunto({ p: g.p, nome: g.nome }, false), s.dici), children: [_jsx(Icona, { n: "share" }), t('Condividi')] })] }), _jsx("p", { className: "nota attribuzione-google", children: t('Dati di Google') })] }));
}
/** Condivide un punto: menu di condivisione del telefono, altrimenti copia il link. */
export async function condividi(titolo, url, dici) {
    try {
        if (navigator.share) {
            await navigator.share({ title: titolo, url });
            return;
        }
    }
    catch {
        return;
    }
    try {
        await navigator.clipboard.writeText(url);
        dici(t('Link copiato'));
    }
    catch {
        dici(t('Copia non riuscita'));
    }
}
export const linkPunto = (x, nostro) => {
    const u = new URL(location.origin + '/');
    if (nostro && x.id)
        u.searchParams.set('poi', x.id);
    else
        u.searchParams.set('punto', `${x.p[0].toFixed(6)},${x.p[1].toFixed(6)}${x.nome ? ',' + x.nome : ''}`);
    return u.toString();
};

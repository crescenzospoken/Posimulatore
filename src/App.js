import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { t } from './i18n';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Cartesian3 } from 'cesium';
import { useS } from './store';
import { impostaQualita, impostaNitidezza, quandoGoogle, quandoGoogleKo, googleAcceso, creaViewer, vistaTotale, attenua3D, impostaGoogle, impostaOrto, impostaSole, vai, vistaCorrente, foto, VAI, viewer } from './scene/viewer';
import { caricaEdifici, disegnaEdifici, disegnaCupole, mostraCupole } from './scene/edifici';
import { caricaContesto, mostraContesto, reteVie } from './scene/contesto';
import { pos } from './scene/viewer';
import { disegnaPercorso, inquadraPercorso } from './scene/percorso';
import { alternative, tappaDaLink } from './engine/percorso';
import { SchedaPercorso, BarraTappe } from './ui/Percorso';
import { Servizi, SchedaPoi, SchedaCasa, SchedaGoogle, chiama, puoModificare } from './ui/Pubblico';
import { avviaSovrapposti, impostaVoci } from './scene/sovrapposti';
import { caricaEventi, disegnaEventi } from './scene/eventi';
import { SchedaEvento } from './ui/Eventi';
import { portamiA, partenzaDiBase } from './ui/tappe';
import { StreetView } from './ui/StreetView';
import { caricaPoi, disegnaPoi, rifaiPoi, elencoPoi } from './scene/poi';
import { avviaGps, centraSu, dentroPositano, gpsAcceso, fermaGps, ultimaPosizione } from './scene/gps';
import { useRicerca } from './ui/ricerca';
import { avviaOggetti, disegnaOggetti, calcoli, quoteCambiate } from './scene/oggetti';
import { avviaInterazione, disegnaMisure, quotaBozza } from './scene/interazione';
import { avviaCammina, fermaCammina, tasti } from './scene/cammina';
import { quota } from './scene/oggetti';
import { GRUPPI } from './ui/strumenti';
import { Icona } from './ui/Icona';
import { Pannello } from './ui/Pannello';
import { Suggerimenti } from './ui/Suggerimenti';
import { trasla } from './engine/modifica';
const st0 = (k) => k === 'percorso';
export default function App() {
    const el = useRef(null);
    const [pronto, setPronto] = useState(false);
    const [errore, setErrore] = useState(null);
    // la posizione sotto il cursore va scritta direttamente nella barra: passare da React ridisegnerebbe tutta l'interfaccia a ogni movimento
    const barra = useRef(null);
    const setCur = (cur) => { const b = barra.current; if (b)
        b.textContent = cur ? `${cur.p[1].toFixed(5)}, ${cur.p[0].toFixed(5)} · ${cur.z.toFixed(1).replace('.', ',')} m s.l.m.` : 'Positano'; };
    const [aperto, setAperto] = useState(null);
    const [gps, setGps] = useState(false);
    /** Rimette la vista: sul percorso se ce n'è uno, sulla tua posizione se il GPS è acceso, altrimenti tutta Positano. */
    const rimettiVista = () => {
        const st = useS.getState(), io = ultimaPosizione();
        if (st.strumento.k === 'percorso' && calcRef.current)
            inquadraPercorso(calcRef.current);
        else if (gpsAcceso() && io && dentroPositano(io.p))
            centraSu(io.p);
        else
            vistaTotale();
    };
    const dove = () => {
        if (gpsAcceso()) {
            fermaGps();
            setGps(false);
            return;
        }
        let primo = true;
        setGps(true);
        avviaGps(p => {
            if (!primo)
                return;
            primo = false;
            if (dentroPositano(p.p))
                centraSu(p.p);
            else
                useS.getState().dici(t('Sei fuori Positano: il pallino blu compare quando arrivi'));
        }, t => { setGps(false); useS.getState().dici(t); });
    };
    const [q, setQ] = useState('');
    const [cercaAperta, setCercaAperta] = useState(false);
    const s = useS();
    const op = s.opzione();
    useEffect(() => {
        let stop;
        (async () => {
            try {
                try {
                    const c = await (await fetch('/config')).json();
                    if (c.ionToken || c.googleKey)
                        useS.setState(st => ({ ionTokenSito: c.ionToken ?? '', googleKey: c.googleKey ?? '', livelli: { ...st.livelli, google: st.livelli.googleScelto ?? true } }));
                }
                catch { /* sviluppo senza Worker */ }
                await creaViewer(el.current);
                avviaSovrapposti(el.current);
                impostaOrto(useS.getState().livelli.orto);
                // chi sono, colori di base per tutti: dal server (senza server si va avanti da visitatore)
                chiama('io').then(u => useS.setState(st => ({ utente: u, inModifica: st.inModifica && puoModificare(u) })), () => { });
                chiama('impostazioni').then(i => useS.setState({ coloriBase: i.coloriVie ?? {} }), () => { });
                await Promise.all([caricaContesto(), avviaOggetti(), caricaPoi(), caricaEventi()]);
                // gli edifici OSM (1 MB) servono solo se accesi o per controllare cosa c'è sotto una piazza: si caricano dopo
                setTimeout(() => caricaEdifici().then(() => useS.setState(st => ({ googleGiro: st.googleGiro + 1 }))), 4000);
                disegnaCupole(viewer);
                let tG;
                // Google finisce di caricare dopo ogni movimento: ricalcolare tutti gli oggetti ogni volta bloccava la pagina.
                // Si ricalcola solo quando la vista si è spostata davvero (oltre 80 m) e al massimo ogni 3 secondi.
                let ultimaPos = null, ultimaVolta = 0;
                quandoGoogle(() => {
                    clearTimeout(tG);
                    tG = setTimeout(() => {
                        const ora = viewer.camera.positionWC, t = performance.now();
                        if (ultimaPos && Cartesian3.distance(ora, ultimaPos) < 80)
                            return;
                        if (t - ultimaVolta < 3000)
                            return;
                        ultimaPos = Cartesian3.clone(ora);
                        ultimaVolta = t;
                        quoteCambiate();
                        rifaiPoi();
                        useS.setState(st => ({ googleGiro: st.googleGiro + 1 }));
                    }, 1200);
                });
                quandoGoogleKo(() => useS.getState().dici(t('Google 3D non risponde: per ora vedi il satellite')));
                stop = avviaInterazione(setCur, finisci);
                // se ci si muove di colpo (pizzico o trascinamento troppo veloce), Positano esce dalla vista o si guarda il cielo,
                // il pulsante «Rimetti la vista» lampeggia per qualche secondo: chi si è perso sa dove toccare
                {
                    // ultimo secondo di posizioni: ci si è persi se in un secondo la quota è più che raddoppiata (o dimezzata),
                    // se ci si è spostati di oltre due volte la quota, o se si guarda quasi l'orizzonte
                    const storia = [];
                    let spento = 0;
                    viewer.scene.postRender.addEventListener(() => {
                        const ora = performance.now(), cam = viewer.camera, h = Math.max(30, cam.positionCartographic.height);
                        if (cam._currentFlight) {
                            storia.length = 0;
                            return;
                        }
                        storia.push({ t: ora, p: Cartesian3.clone(cam.positionWC), h });
                        while (storia.length && ora - storia[0].t > 1000)
                            storia.shift();
                        const a = storia[0];
                        const perso = cam.pitch > -0.12 || h / a.h > 2.2 || a.h / h > 2.2 || Cartesian3.distance(a.p, cam.positionWC) > 2 * Math.max(h, a.h);
                        if (!perso)
                            return;
                        const b = document.querySelector('.fab-reset');
                        if (!b)
                            return;
                        b.classList.add('lampeggia');
                        clearTimeout(spento);
                        spento = window.setTimeout(() => b.classList.remove('lampeggia'), 6000);
                    });
                }
                // link o QR con il percorso: ?da=lon,lat,Nome&a=lon,lat,Nome
                const u = new URLSearchParams(location.search), da = tappaDaLink(u.get('da')), a = tappaDaLink(u.get('a'));
                // link di un punto: ?poi=id (nostro) o ?punto=lon,lat,Nome
                const lp = u.get('poi'), pp = tappaDaLink(u.get('punto'));
                const condiviso = lp ? elencoPoi().find(x => x.id === lp) : undefined;
                if (condiviso)
                    useS.setState(st => ({ selPoi: condiviso.id, casaChiesta: true, poiCat: st.poiCat.includes(condiviso.c) ? st.poiCat : [...st.poiCat, condiviso.c] }));
                else if (pp)
                    useS.setState({ selGoogle: { id: 'link', nome: pp.nome ?? 'Punto condiviso', p: pp.p }, casaChiesta: true });
                const centro = condiviso?.p ?? pp?.p;
                // ?t=lon,lat,Nome|lon,lat,Nome|… (più tappe) oppure ?da=…&a=…
                const tl = (u.get('t') ?? '').split('|').map(tappaDaLink).filter((x) => !!x);
                const tappeLink = tl.length ? tl : [da, a].filter((x) => !!x);
                if (tappeLink.length)
                    useS.setState({ tappe: tappeLink, strumento: { k: 'percorso' }, ospite: tappeLink.length >= 2, pannello: null });
                // all'apertura la vista di tutta Positano; chi progetta riparte dalla vista salvata nel progetto
                const st0x = useS.getState(), v = st0x.inModifica && puoModificare(st0x.utente) && st0x.progetto().vista;
                if (centro)
                    centraSu(centro);
                else if (!a) {
                    if (v)
                        vai(v, 0);
                    else
                        vistaTotale(0);
                }
                setPronto(true);
                window.__pronto = true;
            }
            catch (e) {
                console.error(e);
                setErrore(e instanceof Error ? e.message : String(e));
            }
        })();
        return () => stop?.();
    }, []);
    // modifica = account abilitato e modalità accesa; altrimenti la mappa è quella pubblica
    const mod = s.inModifica && puoModificare(s.utente);
    // scena <- stato
    useEffect(() => { if (pronto)
        disegnaOggetti(op.oggetti, s.sel, s.vSel, s.livelli.progetto && mod); }, [pronto, op, s.sel, s.vSel, s.googleGiro, s.livelli.progetto, mod]);
    useEffect(() => { if (pronto)
        disegnaEventi(mod, s.selEvento, s.lingua === 'en'); }, [pronto, mod, s.selEvento, s.lingua, s.googleGiro]);
    useEffect(() => { if (pronto)
        disegnaPoi(new Set(s.ospite ? [] : s.poiCat), s.selPoi, mod); }, [pronto, s.poiCat, s.selPoi, mod, s.googleGiro, s.ospite]);
    useEffect(() => { if (pronto && !mod && s.strumento.k !== 'naviga' && s.strumento.k !== 'percorso')
        s.set({ strumento: { k: 'naviga' }, bozza: [] }); }, [pronto, mod]);
    // correzione delle vie: si lavora sul satellite Esri (Google 3D non si può ricalcare); all'uscita torna com'era
    const primaDiVie = useRef(null);
    useEffect(() => {
        if (!pronto)
            return;
        if (s.strumento.k === 'vie' && !primaDiVie.current) {
            primaDiVie.current = { google: s.livelli.google, orto: s.livelli.orto };
            s.setLivelli({ google: false, orto: 'esri', strade: true });
        }
        else if (s.strumento.k !== 'vie' && primaDiVie.current) {
            const p = primaDiVie.current;
            primaDiVie.current = null;
            s.setLivelli({ google: p.google, orto: p.orto });
            s.set({ selVia: null, viaBozza: null, viaSel: [] });
        }
    }, [pronto, s.strumento.k]);
    useEffect(() => { if (pronto)
        disegnaEdifici(mod && s.livelli.edifici && !s.livelli.google, op.edifici, s.selEdificio, (s.sel && calcoli.get(s.sel)?.interferenze) || [], s.livelli.stile !== 'facciate'); }, [pronto, op, s.sel, s.selEdificio, s.livelli.edifici, s.livelli.google, s.livelli.stile]);
    useEffect(() => { if (pronto) {
        impostaOrto(s.livelli.orto);
        mostraContesto(s.livelli.strade, s.livelli.nomi, s.livelli.confine && !s.ospite, s.livelli.google, { ...s.coloriBase, ...s.livelli.coloriVie });
        mostraCupole(mod && !s.livelli.google && s.livelli.edifici);
        impostaSole(s.livelli);
        impostaNitidezza(s.livelli.nitido);
        impostaQualita(s.livelli.qualita);
        attenua3D(s.livelli.attenua ?? 0);
    } }, [pronto, s.livelli, s.ospite, s.coloriBase, mod]);
    useEffect(() => { if (pronto)
        disegnaMisure(s.misure); }, [pronto, s.misure]);
    // percorso a piedi
    const inPercorso = st0(s.strumento.k);
    const tp = s.tappe, a = tp.length > 1 ? tp[tp.length - 1] : null;
    const chiaveTappe = tp.map(x => x.p.join()).join('|');
    const calcRef = useRef(null);
    // il più veloce più le alternative (meno scale, meno salita); se ne sceglie una dalla scheda
    const [scelta, setScelta] = useState(0);
    const opzioni = useMemo(() => (pronto && inPercorso && tp.length >= 2 ? alternative(reteVie(), tp[0].p, tp[1].p, ...tp.slice(2).map(x => x.p)) : []), [pronto, inPercorso, chiaveTappe]);
    useEffect(() => setScelta(0), [opzioni]);
    const calc = opzioni[Math.min(scelta, opzioni.length - 1)] ?? null;
    useEffect(() => { if (pronto)
        disegnaPercorso(inPercorso ? calc : null, inPercorso ? tp : []); }, [pronto, inPercorso, calc, chiaveTappe, tp.map(x => x.nome).join(), s.livelli.google, s.googleGiro, s.lingua]);
    useEffect(() => { calcRef.current = calc; if (calc)
        inquadraPercorso(calc); }, [calc]);
    useEffect(() => {
        if (!pronto)
            return;
        const g = s.selGoogle;
        impostaVoci('gpl', g ? [{ id: 'gpl', tipo: 'tappa', pos: pos(g.p[0], g.p[1], quota(g.p[0], g.p[1]) + 3), testo: g.nome, icona: 'location_on', col: '#c5221f', scelto: true, maxDist: 1e9 }] : []);
    }, [pronto, s.selGoogle?.id, s.googleGiro]);
    // il punto Casa sulla mappa (toccandolo: percorso da Casa)
    useEffect(() => {
        if (!pronto)
            return;
        const c = s.casa;
        impostaVoci('casa', c && !s.ospite ? [{ id: 'casa', tipo: 'tappa', pos: pos(c.p[0], c.p[1], quota(c.p[0], c.p[1]) + 3), testo: c.nome && c.nome !== 'Casa' ? 'Casa · ' + c.nome : 'Casa', icona: 'home', col: '#0b6bcb', scelto: true, maxDist: 1e9,
                clic: () => portamiA(c) }] : []);
    }, [pronto, s.casa?.p[0], s.casa?.p[1], s.casa?.nome, s.ospite, s.googleGiro]);
    useEffect(() => { document.title = s.ospite && a?.nome ? `${t('Come arrivare a')} ${a.nome} · Positano 3D` : 'Positano 3D · ' + t('mappa e percorsi a piedi'); }, [s.ospite, a?.nome, s.lingua]);
    useEffect(() => {
        if (!pronto)
            return;
        impostaGoogle(s.livelli.google, s.ionToken || s.ionTokenSito, s.googleKey).then(err => { if (err) {
            s.dici(err);
            s.setLivelli({ google: false });
        }
        else
            disegnaOggetti(op.oggetti, s.sel); });
    }, [pronto, s.livelli.google, s.ionToken, s.ionTokenSito, s.googleKey]);
    // Cammina: si cammina nel 3D e Street View segue, per vedere i luoghi in alta qualità
    useEffect(() => { if (pronto) {
        if (s.strumento.k === 'cammina') {
            avviaCammina();
            if (s.googleKey)
                s.set({ vista360: { modo: 'cammina' } });
        }
        else {
            fermaCammina();
            if (s.vista360?.modo === 'cammina')
                s.set({ vista360: null });
        }
    } }, [pronto, s.strumento.k]);
    // tastiera
    useEffect(() => {
        const k = (e) => {
            if (e.target?.closest('input,textarea,select'))
                return;
            const st = useS.getState();
            if (e.key === 'Escape') {
                if (st.strumento.k !== 'naviga')
                    st.set({ strumento: { k: 'naviga' }, bozza: [] });
                else
                    st.set({ sel: null, selEdificio: null, info: null });
                setAperto(null);
            }
            else if (e.key === 'Enter' && st.strumento.k === 'disegna')
                finisci();
            else if ((e.key === 'Delete' || e.key === 'Backspace') && st.sel)
                st.togli(st.sel);
            else if (e.key.startsWith('Arrow') && st.sel && st.strumento.k === 'naviga') {
                // frecce: spostano l'oggetto scelto (o il punto scelto) di un passo; con Maiusc di dieci passi
                e.preventDefault();
                const k = (st.passo || 0.1) * (e.shiftKey ? 10 : 1);
                const de = e.key === 'ArrowRight' ? k : e.key === 'ArrowLeft' ? -k : 0, dn = e.key === 'ArrowUp' ? k : e.key === 'ArrowDown' ? -k : 0;
                st.aggiorna(st.sel, o => {
                    if (st.vSel !== null && o.pts[st.vSel]) {
                        const tutti = trasla([o.pts[st.vSel]], de, dn);
                        o.pts[st.vSel] = tutti[0];
                    }
                    else
                        o.pts = trasla(o.pts, de, dn);
                });
            }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey)
                    st.ripeti();
                else
                    st.annulla();
            }
            else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                st.ripeti();
            }
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, []);
    // punti nostri e di OpenStreetMap subito, luoghi di Google poco dopo (stessa ricerca delle tappe e di Casa)
    const { nostri: risultati, google } = useRicerca(q);
    const st = s.strumento;
    return (_jsxs("div", { className: 'app' + (s.ospite ? ' ospite' : '') + (mod ? ' in-modifica' : ' pubblico'), children: [_jsx("div", { ref: el, className: "scena" }), !pronto && !errore && _jsx("div", { className: "caricamento", children: t('Preparo Positano in 3D…') }), errore && _jsxs("div", { className: "caricamento errore", children: ["Il 3D non parte su questo dispositivo: ", errore] }), _jsxs("header", { className: 'cima' + (cercaAperta ? ' cerca-aperta' : ''), children: [st.k === 'percorso' ? _jsx(BarraTappe, { esci: () => s.set({ strumento: { k: 'naviga' }, aggiungiDaMappa: false }) }) : (_jsxs("div", { className: "ricerca vetro", children: [_jsx(Icona, { n: "search", className: "lente" }), _jsx("input", { value: q, onChange: e => setQ(e.target.value), onFocus: () => setCercaAperta(true), onBlur: () => setTimeout(() => setCercaAperta(false), 150), placeholder: t('Cerca a Positano'), "aria-label": t('Cerca vie, luoghi e servizi') }), q && _jsx("button", { className: "tondo quiet", onClick: () => setQ(''), "aria-label": t('Cancella la ricerca'), children: _jsx(Icona, { n: "close" }) }), _jsx("button", { className: "lingua quiet", onClick: () => s.set({ lingua: s.lingua === 'it' ? 'en' : 'it' }), "aria-label": s.lingua === 'it' ? 'English' : 'Italiano', "data-tip": s.lingua === 'it' ? 'English' : 'Italiano', children: s.lingua === 'it' ? 'EN' : 'IT' }), _jsx("button", { className: 'avatar' + (s.utente ? ' con-utente' : ''), onClick: () => s.set({ pannello: s.pannello === 'accesso' ? null : 'accesso' }), "aria-label": s.utente ? 'Il tuo account' : 'Accedi', "data-tip": s.utente ? s.utente.nome : 'Accedi per progettare e aggiornare la mappa', children: s.utente ? s.utente.nome.trim()[0]?.toUpperCase() : _jsx(Icona, { n: "person" }) }), (risultati.length > 0 || cercaAperta) && _jsx("ul", { className: "risultati vetro", children: q.trim() ? risultati.map(r => (_jsx("li", { children: _jsxs("button", { onMouseDown: e => e.preventDefault(), onClick: () => { const z = r.z ?? quota(r.p[0], r.p[1]); vai({ lon: r.p[0], lat: r.p[1] - 0.0012, h: z + 110, heading: 0, pitch: -40 }); setQ(''); setCercaAperta(false); if (r.poi) {
                                            const c = elencoPoi().find(x => x.id === r.poi).c;
                                            s.set({ selPoi: r.poi, poiCat: s.poiCat.includes(c) ? s.poiCat : [...s.poiCat, c] });
                                        } }, children: [_jsx(Icona, { n: r.poi ? 'location_on' : r.tipo === 'strada' ? 'route' : 'map' }), _jsx("span", { children: r.nome }), _jsx("small", { children: t(r.tipo) })] }) }, r.nome + r.tipo + (r.poi ?? '')))).concat(google.length ? [_jsx("li", { className: "titoletto", children: t('Da Google Maps') }, "gt"), ...google.map(g => (_jsx("li", { children: _jsxs("button", { onMouseDown: e => e.preventDefault(), onClick: () => { vai({ lon: g.p[0], lat: g.p[1] - 0.0012, h: quota(g.p[0], g.p[1]) + 110, heading: 0, pitch: -40 }); setQ(''); setCercaAperta(false); s.set({ selGoogle: g, selPoi: null, pannello: null }); }, children: [_jsx(Icona, { n: "location_on" }), _jsx("span", { children: g.nome }), _jsx("small", { children: g.tipo ?? g.indirizzo })] }) }, 'g' + g.id))), _jsx("li", { className: "attribuzione-google", children: t('Risultati di Google') }, "ga")] : []) : _jsxs(_Fragment, { children: [s.casa && _jsx("li", { children: _jsxs("button", { onMouseDown: e => e.preventDefault(), onClick: () => { centraSu(s.casa.p); setCercaAperta(false); document.activeElement?.blur(); }, children: [_jsx(Icona, { n: "home" }), _jsxs("span", { children: ["Casa", s.casa.nome && s.casa.nome !== 'Casa' ? ' · ' + s.casa.nome : ''] })] }) }), _jsx("li", { className: "titoletto", children: t('Vai a') }), VAI.map(v => _jsx("li", { children: _jsxs("button", { onMouseDown: e => e.preventDefault(), onClick: () => { vai(v); setCercaAperta(false); document.activeElement?.blur(); }, children: [_jsx(Icona, { n: "near_me" }), _jsx("span", { children: t(v.nome) })] }) }, v.nome))] }) })] })), mod && (_jsxs("div", { className: "barra-modifica vetro", children: [_jsxs("button", { className: "quiet progetto-nome", onClick: () => s.set({ pannello: 'progetto' }), "data-tip": "Progetti e opzioni", children: [s.progetto().nome, " \u00B7 ", op.nome] }), _jsx("button", { className: "tondo quiet", disabled: !s.passato.length, onClick: s.annulla, "data-tip": "Annulla (Ctrl+Z)", "aria-label": t('Annulla'), children: _jsx(Icona, { n: "undo" }) }), _jsx("button", { className: "tondo quiet", disabled: !s.futuro.length, onClick: s.ripeti, "data-tip": "Ripeti (Ctrl+Y)", "aria-label": "Ripeti", children: _jsx(Icona, { n: "redo" }) }), _jsx("button", { className: "tondo quiet solo-desktop", onClick: () => { s.salvaVista(vistaCorrente()); s.dici('Vista salvata nel progetto'); }, "data-tip": "Salva questa vista come partenza del progetto", "aria-label": "Salva vista", children: _jsx(Icona, { n: "push_pin" }) }), _jsx("button", { className: "tondo quiet solo-desktop", onClick: () => foto(s.progetto().nome), "data-tip": "Scarica la vista come immagine ad alta risoluzione", "aria-label": "Foto", children: _jsx(Icona, { n: "photo_camera" }) }), _jsx("button", { className: 'quiet' + (s.livelli.progetto ? '' : ' acceso'), onClick: () => s.setLivelli({ progetto: !s.livelli.progetto }), "aria-pressed": !s.livelli.progetto, "data-tip": s.livelli.progetto ? 'Nascondi il progetto e guarda Positano com\'è oggi' : 'Mostra di nuovo il progetto', children: s.livelli.progetto ? 'Com\'è oggi' : 'Progetto' })] })), !s.ospite && st.k !== 'percorso' && _jsx(Servizi, {})] }), !s.ospite && (_jsxs("div", { className: "fab", children: [_jsx("button", { className: 'fab-piccolo vetro' + (s.pannello === 'aiuto' ? ' acceso' : ''), onClick: () => s.set({ pannello: s.pannello === 'aiuto' ? null : 'aiuto' }), "aria-label": t('Guida'), "data-tip": t('Guida e fonti dei dati'), children: _jsx(Icona, { n: "help" }) }), _jsx("button", { className: 'fab-piccolo vetro' + (s.pannello === 'livelli' ? ' acceso' : ''), onClick: () => s.set({ pannello: s.pannello === 'livelli' ? null : 'livelli' }), "aria-label": t('Livelli'), "data-tip": t('Mappa, Google 3D, colori delle vie, qualità'), children: _jsx(Icona, { n: "layers" }) }), _jsx("button", { className: "fab-piccolo vetro", onClick: () => { const c = useS.getState().casa; if (c)
                            centraSu(c.p); s.set({ casaAperta: !s.casaAperta, selPoi: null, selGoogle: null, selEvento: null, pannello: null }); }, "aria-label": t('Casa'), "data-tip": t(s.casa ? 'Casa' : 'Scegli il tuo punto Casa'), children: _jsx(Icona, { n: "home" }) }), _jsx("button", { className: "fab-piccolo vetro fab-reset", onClick: () => { document.querySelector('.fab-reset')?.classList.remove('lampeggia'); rimettiVista(); }, "aria-label": t('Rimetti la vista'), "data-tip": t('Rimetti la vista: sul percorso, sulla tua posizione o su tutta Positano'), children: _jsx(Icona, { n: "zoom_out_map" }) }), _jsx("button", { className: 'fab-piccolo vetro' + (gps ? ' acceso' : ''), "aria-pressed": gps, onClick: dove, "aria-label": t('Dove sono'), "data-tip": t('Mostra dove sei (GPS)'), children: _jsx(Icona, { n: "my_location" }) }), _jsxs("button", { className: 'fab-grande' + (st.k === 'percorso' ? ' acceso' : ''), onClick: () => { if (st.k === 'percorso') {
                            s.set({ strumento: { k: 'naviga' } });
                            return;
                        } const da = partenzaDiBase(); s.set({ strumento: { k: 'percorso' }, tappe: s.tappe.length ? s.tappe : da ? [da] : [], aggiungiDaMappa: false, selPoi: null, selGoogle: null, pannello: null }); }, "aria-label": t('Percorso a piedi'), "data-tip": t('Da un punto a un altro a piedi, con salite e scale'), children: [_jsx(Icona, { n: "directions" }), _jsx("span", { children: t('Percorso') })] })] })), mod && _jsxs("nav", { className: "strumenti", "aria-label": "Strumenti", children: [_jsxs("button", { className: st.k === 'naviga' ? 'acceso' : '', onClick: () => { s.set({ strumento: { k: 'naviga' }, bozza: [] }); setAperto(null); }, "data-tip": "Muovi la vista, tocca per scegliere e trascina per spostare", children: [_jsx(Icona, { n: "pan_tool" }), "Naviga"] }), GRUPPI.map(g => (_jsxs("div", { className: "gruppo", children: [_jsxs("button", { className: aperto === g.id || (st.k !== 'naviga' && st.k !== 'cammina' && g.voci.some(v => JSON.stringify(v.s) === JSON.stringify(st))) ? 'acceso' : '', onClick: () => setAperto(aperto === g.id ? null : g.id), children: [_jsx(Icona, { n: g.icona }), g.nome] }), aperto === g.id && _jsxs("div", { className: "menu", children: [g.voci.map(v => (_jsx("button", { onClick: () => { s.set({ strumento: v.s, bozza: [], sel: null, selEdificio: null }); setAperto(null); }, children: v.nome }, v.nome))), g.id === 'misura' && s.misure.length > 0 && _jsx("button", { className: "danger", onClick: () => { s.set({ misure: [] }); setAperto(null); }, children: "Cancella le misure" })] })] }, g.id))), _jsxs("button", { className: s.pannello === 'catalogo' ? 'acceso' : '', onClick: () => { s.set({ pannello: s.pannello === 'catalogo' ? null : 'catalogo' }); setAperto(null); }, "data-tip": "Auto, bus, gazebo, palchi, tende, arredi", children: [_jsx(Icona, { n: "category" }), "Catalogo"] }), _jsxs("button", { className: st.k === 'cammina' ? 'acceso' : '', onClick: () => { s.set({ strumento: st.k === 'cammina' ? { k: 'naviga' } : { k: 'cammina' }, bozza: [] }); setAperto(null); }, "data-tip": "Cammina ad altezza d'uomo dal punto al centro dello schermo", children: [_jsx(Icona, { n: "directions_walk" }), "Cammina"] }), _jsxs("button", { className: st.k === 'poi' ? 'acceso' : '', onClick: () => { s.set({ strumento: st.k === 'poi' ? { k: 'naviga' } : { k: 'poi' }, sel: null, selPoi: null, pannello: st.k === 'poi' ? null : 'poi', spostaPoi: false }); setAperto(null); }, "data-tip": "Aggiungi o correggi bagni, fermate, parcheggi e altri punti: li vedono tutti", children: [_jsx(Icona, { n: "add_location_alt" }), "Punti"] }), _jsxs("button", { className: st.k === 'vie' ? 'acceso' : '', onClick: () => { s.set({ strumento: st.k === 'vie' ? { k: 'naviga' } : { k: 'vie' }, sel: null, selPoi: null, selVia: null, viaBozza: null, pannello: st.k === 'vie' ? null : 'via' }); setAperto(null); }, "data-tip": "Correggi le vie a mano sul satellite: le vedono tutti e migliorano i percorsi", children: [_jsx(Icona, { n: "edit_road" }), "Vie"] }), _jsxs("button", { className: st.k === 'eventi' ? 'acceso' : '', onClick: () => { s.set({ strumento: st.k === 'eventi' ? { k: 'naviga' } : { k: 'eventi' }, sel: null, selPoi: null, selEvento: null, nuovoEvento: null, pannello: st.k === 'eventi' ? null : 'evento' }); setAperto(null); }, "data-tip": "Concerti, feste, mercati, chiusure: compaiono solo mentre sono in corso", children: [_jsx(Icona, { n: "celebration" }), "Eventi"] })] }), (st.k === 'disegna' || st.k === 'misura') && (_jsxs("div", { className: "guida-strumento", children: [_jsx("b", { children: st.k === 'disegna' ? st.nome : 'Misura' }), _jsx("span", { children: st.k === 'disegna' ? st.aiuto : st.modo === 'quota' ? 'Clicca un punto' : st.modo === 'altezza' ? 'Clicca due punti' : 'Clicca i punti; ogni nuova misura parte dopo «Nuova»' }), st.k === 'disegna' && _jsxs("button", { className: "primary", disabled: s.bozza.length < st.min, onClick: finisci, children: ["Fine (", s.bozza.length, ")"] }), st.k === 'misura' && _jsx("button", { onClick: () => s.set({ misure: [...s.misure, { id: Math.random().toString(36).slice(2), modo: st.modo, pts: [] }] }), children: "Nuova" }), _jsx("button", { className: "quiet", onClick: () => s.set({ strumento: { k: 'naviga' }, bozza: [] }), children: t('Esci') })] })), st.k === 'cammina' && _jsx(Pad, {}), s.vista360 && s.googleKey && _jsx(StreetView, { vista: s.vista360, chiudi: () => s.set({ vista360: null }) }), st.k === 'percorso' && _jsx(SchedaPercorso, { calc: calc, opzioni: opzioni, scelta: scelta, scegli: setScelta, esci: () => s.set({ strumento: { k: 'naviga' }, aggiungiDaMappa: false }) }), s.selPoi && s.pannello !== 'poi' && st.k !== 'percorso' && _jsx(SchedaPoi, {}), s.selGoogle && !s.selPoi && !s.pannello && st.k !== 'percorso' && _jsx(SchedaGoogle, {}), s.selEvento && !s.pannello && st.k !== 'percorso' && st.k !== 'eventi' && _jsx(SchedaEvento, {}), pronto && !s.ospite && (s.scegliCasa || s.casaAperta) && _jsx(SchedaCasa, {}), s.pannello && _jsx(Pannello, { chiudi: () => s.set({ pannello: null, sel: null, selEdificio: null, info: null }) }), _jsx("footer", { className: "stato", children: _jsx("span", { ref: barra, children: t('Positano') }) }), s.avviso && _jsx("div", { className: "avviso", role: "status", children: s.avviso }), _jsx(Suggerimenti, {})] }));
}
function finisci() {
    const s = useS.getState();
    const t = s.strumento;
    if (t.k !== 'disegna')
        return;
    const b = s.bozza;
    if (b.length < t.min) {
        s.dici(`Servono almeno ${t.min} punti`);
        return;
    }
    let z = quotaBozza();
    // su Google 3D il terreno a 10 m non coincide con la superficie: gli oggetti in piedi prendono la quota cliccata
    if (z === undefined && googleAcceso() && ['modello', 'testo', 'volume', 'piazza'].includes(t.tipo))
        z = s.ultimaQuota ?? undefined;
    if (t.tipo === 'piazza' && z === undefined)
        z = Math.round(Math.max(quota(b[0][0], b[0][1]), quota(b[1][0], b[1][1])) * 10) / 10;
    const o = { tipo: t.tipo, nome: t.nome, pts: b, par: { ...t.par }, ...(z !== undefined ? { z: Math.round(z * 100) / 100 } : {}) };
    s.aggiungi(o);
    s.set({ strumento: { k: 'naviga' }, bozza: [] });
    viewer.scene.requestRender();
}
function Pad() {
    const b = (k, t, cls) => (_jsx("button", { className: 'pad-' + cls, onPointerDown: e => { e.preventDefault(); tasti[k] = 1; }, onPointerUp: () => (tasti[k] = 0), onPointerLeave: () => (tasti[k] = 0), "aria-label": t, children: t }));
    return (_jsxs("div", { className: "pad", children: [_jsxs("div", { className: "pad-tasti", children: [b('avanti', '▲', 'su'), b('sinistra', '◀', 'sx'), b('destra', '▶', 'dx'), b('indietro', '▼', 'giu')] }), _jsx("div", { className: "pad-nota", children: "Frecce o W A S D per camminare, Maiusc per correre, trascina per guardare" })] }));
}

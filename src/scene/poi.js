import { pos } from './viewer';
import { impostaVoci } from './sovrapposti';
import { useS } from '../store';
import { quota } from './oggetti';
import { categoria, unisciPoi } from '../engine/poi';
let osm = [], tutti = [];
export async function caricaPoi() {
    osm = (await (await fetch('/data/poi.json')).json()).punti;
    return ricaricaPoi();
}
/** Rilegge le correzioni a mano dal server (dopo una modifica o all'avvio). */
export async function ricaricaPoi() {
    let db = [];
    try {
        const r = await fetch('/api/poi');
        if (r.ok && (r.headers.get('content-type') ?? '').includes('json'))
            db = await r.json();
    }
    catch { /* sviluppo senza Worker */ }
    tutti = unisciPoi(osm, db);
    return tutti;
}
export const elencoPoi = () => tutti;
export const poiDa = (id) => tutti.find(p => p.id === id);
let firma = '';
/** Simboli dei punti in HTML sopra la scena (nitidi, cliccabili senza ridisegnare la scena). */
export function disegnaPoi(cat, sel, conNascosti) {
    const f = [...cat].join() + '|' + sel + '|' + conNascosti + '|' + tutti.map(p => p.p.join() + p.c + p.n + (p.nascosto ? 1 : 0)).join().length + '|' + tutti.length;
    if (f === firma)
        return;
    firma = f;
    const voci = [];
    for (const p of tutti) {
        if (!cat.has(p.c) || (p.nascosto && !conNascosti))
            continue;
        const c = categoria(p.c), id = p.id;
        voci.push({
            id: 'poi:' + id, tipo: 'poi', pos: pos(p.p[0], p.p[1], quota(p.p[0], p.p[1]) + 2.5), testo: p.n ?? (id === sel ? c.nome : ''),
            icona: c.s, col: c.col, scelto: id === sel, tenue: p.nascosto, maxDist: 3500,
            clic: () => {
                const s = useS.getState();
                if (s.strumento.k === 'poi')
                    useS.setState({ selPoi: id, pannello: 'poi', poiPos: null });
                // durante un percorso, toccare un punto lo aggiunge come tappa
                else if (s.strumento.k === 'percorso' && !s.ospite)
                    useS.setState({ tappe: [...s.tappe, { p: p.p, nome: p.n ?? categoria(p.c).nome }], aggiungiDaMappa: false });
                else
                    useS.setState({ selPoi: id, sel: null, selEdificio: null, pannello: null });
            },
        });
    }
    impostaVoci('poi', voci);
}
/** Dopo i caricamenti di Google le quote cambiano: i simboli si rimettono a posto. */
export const rifaiPoi = () => { firma = ''; };

// Eventi a tempo: si leggono da /api/eventi; sulla mappa solo quelli in corso, con un simbolo che pulsa.
import { pos } from './viewer';
import { quota } from './oggetti';
import { impostaVoci } from './sovrapposti';
import { useS } from '../store';
let tutti = [];
export const elencoEventi = () => tutti;
export const eventoDa = (id) => tutti.find(e => e.id === id);
export const inCorso = (e, ora = Date.now()) => Date.parse(e.inizio) <= ora && ora < Date.parse(e.fine);
export const posEvento = (e) => [e.lon, e.lat];
export async function caricaEventi() {
    try {
        const r = await fetch('/api/eventi');
        if (r.ok && (r.headers.get('content-type') ?? '').includes('json'))
            tutti = await r.json();
    }
    catch { /* sviluppo senza Worker */ }
    return tutti;
}
/** Disegna gli eventi in corso (chi modifica li vede tutti, anche futuri, più tenui). */
export function disegnaEventi(tuttiAncheFuturi, sel, en) {
    const ora = Date.now();
    impostaVoci('evt:', tutti.filter(e => inCorso(e, ora) || (tuttiAncheFuturi && Date.parse(e.fine) > ora)).map(e => ({
        id: 'evt:' + e.id, tipo: 'poi', pos: pos(e.lon, e.lat, quota(e.lon, e.lat) + 4), testo: (en && e.titolo_en) || e.titolo,
        icona: 'celebration', col: '#e91e63', scelto: e.id === sel, tenue: !inCorso(e, ora), maxDist: 6000, evento: true,
        clic: () => useS.setState({ selEvento: e.id, selPoi: null, selGoogle: null, pannello: useS.getState().strumento.k === 'eventi' ? 'evento' : null }),
    })));
}

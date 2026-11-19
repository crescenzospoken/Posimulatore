// Ricerca unica per la barra, le tappe del percorso e il punto Casa: punti nostri e di OpenStreetMap subito,
// luoghi di Google mezzo secondo dopo l'ultima lettera (solo con Google 3D acceso, mai salvati).
import { useEffect, useState } from 'react';
import { useS } from '../store';
import { cerca } from '../scene/contesto';
import { elencoPoi } from '../scene/poi';
import { categoria } from '../engine/poi';
import { cercaGoogle } from '../engine/luoghiGoogle';
export function cercaTutto(q) {
    const t = q.trim().toLowerCase();
    if (t.length < 2)
        return [];
    // nome, categoria, tipo di negozio o cucina, via: si trovano tutti i punti, anche delle categorie spente
    const testo = (p) => [p.n, categoria(p.c).nome, p.note, ...Object.values(p.x ?? {})].join(' ').toLowerCase();
    const poi = elencoPoi().filter(p => !p.nascosto && testo(p).includes(t))
        .sort((a, b) => Number((b.n ?? '').toLowerCase().startsWith(t)) - Number((a.n ?? '').toLowerCase().startsWith(t)))
        .slice(0, 8).map(p => ({ nome: p.n ?? categoria(p.c).nome, tipo: categoria(p.c).nome, p: p.p, poi: p.id }));
    return [...poi, ...cerca(q)].slice(0, 12);
}
/** Risultati nostri e di Google per il testo q. */
export function useRicerca(q) {
    const s = useS();
    const nostri = q ? cercaTutto(q) : [];
    const [google, setGoogle] = useState([]);
    useEffect(() => {
        const t = q.trim();
        // solo sopra il 3D di Google: i luoghi di Google non si possono mostrare su altre mappe (modo Mappa, satellite Esri)
        if (t.length < 3 || !s.googleKey || !s.livelli.google) {
            setGoogle([]);
            return;
        }
        const id = setTimeout(() => {
            cercaGoogle(t, s.googleKey, s.lingua).then(r => { const gia = new Set(cercaTutto(t).map(x => x.nome.toLowerCase())); setGoogle(r.filter(g => !gia.has(g.nome.toLowerCase()))); });
        }, 500);
        return () => clearTimeout(id);
    }, [q, s.googleKey, s.livelli.google, s.lingua]);
    return { nostri, google: q.trim().length >= 3 ? google : [] };
}

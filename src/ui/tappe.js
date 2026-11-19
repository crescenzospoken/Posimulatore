// Percorso a tappe: aprirlo verso un posto, aggiungere, togliere e spostare tappe.
import { useS } from '../store';
import { ultimaPosizione, dentroPositano } from '../scene/gps';
import { t } from '../i18n';
/** Partenza di base: la posizione se sei a Positano, altrimenti Casa. */
export function partenzaDiBase() {
    const io = ultimaPosizione();
    if (io && dentroPositano(io.p))
        return { p: io.p, nome: t('La mia posizione') };
    return useS.getState().casa;
}
/** «Portami qui»: percorso dalla partenza di base (o dalla prima tappa già scelta) a questo posto. */
export function portamiA(dest) {
    const s = useS.getState(), da = partenzaDiBase() ?? (s.strumento.k === 'percorso' ? s.tappe[0] : null);
    s.set({ strumento: { k: 'percorso' }, tappe: da ? [da, dest] : [dest], aggiungiDaMappa: !da, selPoi: null, selGoogle: null, selEvento: null, pannello: null });
}
/** Aggiunge una tappa in fondo al percorso (e lo apre se non c'era). */
export function aggiungiTappa(x) {
    const s = useS.getState();
    s.set({ strumento: { k: 'percorso' }, tappe: [...(s.strumento.k === 'percorso' ? s.tappe : []), x], aggiungiDaMappa: false, selPoi: null, selGoogle: null, selEvento: null, pannello: null });
}
export const lettera = (i) => String.fromCharCode(65 + i);

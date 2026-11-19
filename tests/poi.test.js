import { describe, expect, it } from 'vitest';
import { unisciPoi, orariLeggibili } from '../src/engine/poi';
describe('punti di interesse', () => {
    const osm = [{ id: 'osm:n1', c: 'bar', n: 'Bar A', p: [14.48, 40.62], x: { opening_hours: 'Mo-Sa 08:00-20:00; Su off' } }, { id: 'osm:n2', c: 'bagni', p: [14.49, 40.63] }];
    it('le correzioni a mano sostituiscono o nascondono il punto OSM, i nuovi si aggiungono', () => {
        const r = unisciPoi(osm, [
            { id: 'osm:n2', c: 'bagni', n: 'Bagni del porto', lon: 14.4901, lat: 40.6301, note: '0,50 €', nascosto: 0 },
            { id: 'osm:n1', c: 'bar', n: null, lon: 14.48, lat: 40.62, note: null, nascosto: 1 },
            { id: 'mano:x', c: 'biglietti', n: 'Tabacchi', lon: 14.485, lat: 40.625, note: null, nascosto: 0 },
        ]);
        expect(r).toHaveLength(3);
        expect(r.find(p => p.id === 'osm:n2')).toMatchObject({ n: 'Bagni del porto', note: '0,50 €', p: [14.4901, 40.6301], fonte: 'osm' });
        expect(r.find(p => p.id === 'osm:n1')).toMatchObject({ n: 'Bar A', nascosto: true });
        expect(r.find(p => p.id === 'mano:x')).toMatchObject({ fonte: 'mano', c: 'biglietti' });
    });
    it('orari leggibili', () => expect(orariLeggibili('Mo-Sa 08:00-20:00; Su off')).toBe('lun-sab 08:00-20:00 · dom chiuso'));
});

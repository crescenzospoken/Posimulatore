const CAMPI = 'places.id,places.displayName,places.location,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri';
// riquadro di Positano (compresi Montepertuso, Nocelle, Laurito)
const RIQUADRO = { low: { latitude: 40.605, longitude: 14.455 }, high: { latitude: 40.645, longitude: 14.525 } };
const memoria = new Map();
let spento = false;
/** Cerca a Positano; [] se la chiave non ha Places abilitato o la quota del giorno è finita (allora non riprova più). */
export async function cercaGoogle(testo, chiave, lingua = 'it') {
    const q = testo.trim();
    if (!chiave || spento || q.length < 3)
        return [];
    const k = lingua + '|' + q.toLowerCase();
    if (memoria.has(k))
        return memoria.get(k);
    try {
        const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chiave, 'X-Goog-FieldMask': CAMPI },
            body: JSON.stringify({ textQuery: q, languageCode: lingua, maxResultCount: 8, locationRestriction: { rectangle: RIQUADRO } }),
        });
        if (r.status === 403 || r.status === 429) {
            spento = r.status === 403;
            return [];
        }
        if (!r.ok)
            return [];
        const j = (await r.json());
        const out = (j.places ?? []).filter(p => p.location).map(p => ({
            id: p.id, nome: p.displayName?.text ?? '', p: [p.location.longitude, p.location.latitude],
            indirizzo: p.formattedAddress?.replace(/, \d{5} Positano.*$/, ''), tipo: p.primaryTypeDisplayName?.text, url: p.googleMapsUri,
        }));
        memoria.set(k, out);
        return out;
    }
    catch {
        return [];
    }
}

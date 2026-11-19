// Ricerca dei luoghi di Google (Places API New, Text Search) dal browser, con la stessa chiave del 3D.
// Regole: si mostrano sopra il 3D di Google (che è una mappa Google), con l'attribuzione, e NON si salvano:
// restano in memoria finché la pagina è aperta. Solo campi «Pro» (nome, posizione, indirizzo, tipo): quota gratuita più alta.
import type { LL } from './geo'

export type LuogoGoogle = { id: string; nome: string; p: LL; indirizzo?: string; tipo?: string; url?: string }
const CAMPI = 'places.id,places.displayName,places.location,places.formattedAddress,places.primaryTypeDisplayName,places.googleMapsUri'
// riquadro di Positano (compresi Montepertuso, Nocelle, Laurito)
const RIQUADRO = { low: { latitude: 40.605, longitude: 14.455 }, high: { latitude: 40.645, longitude: 14.525 } }
const memoria = new Map<string, LuogoGoogle[]>()
let spento = false

/** Cerca a Positano; [] se la chiave non ha Places abilitato o la quota del giorno è finita (allora non riprova più). */
export async function cercaGoogle(testo: string, chiave: string, lingua = 'it'): Promise<LuogoGoogle[]> {
  const q = testo.trim()
  if (!chiave || spento || q.length < 3) return []
  const k = lingua + '|' + q.toLowerCase()
  if (memoria.has(k)) return memoria.get(k)!
  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': chiave, 'X-Goog-FieldMask': CAMPI },
      body: JSON.stringify({ textQuery: q, languageCode: lingua, maxResultCount: 8, locationRestriction: { rectangle: RIQUADRO } }),
    })
    if (r.status === 403 || r.status === 429) { spento = r.status === 403; return [] }
    if (!r.ok) return []
    const j = (await r.json()) as { places?: { id: string; displayName?: { text: string }; location?: { latitude: number; longitude: number }; formattedAddress?: string; primaryTypeDisplayName?: { text: string }; googleMapsUri?: string }[] }
    const out = (j.places ?? []).filter(p => p.location).map(p => ({
      id: p.id, nome: p.displayName?.text ?? '', p: [p.location!.longitude, p.location!.latitude] as LL,
      indirizzo: p.formattedAddress?.replace(/, \d{5} Positano.*$/, ''), tipo: p.primaryTypeDisplayName?.text, url: p.googleMapsUri,
    }))
    memoria.set(k, out)
    return out
  } catch { return [] }
}

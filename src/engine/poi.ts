// Punti di interesse: categorie, unione fra OpenStreetMap (public/data/poi.json) e correzioni a mano (API /api/poi).
import type { LL } from './geo'

/** s = nome dell'icona Material (src/ui/icone.ts); icona = emoji, solo per i testi semplici */
export type Categoria = { k: string; s: string; nome: string; icona: string; col: string; base: boolean }
/** base = accesa all'apertura */
export const CATEGORIE: Categoria[] = [
  { k: 'bagni', s: 'wc', nome: 'Bagni pubblici', icona: '🚻', col: '#1a73e8', base: true },
  { k: 'fermate', s: 'directions_bus', nome: 'Fermate bus', icona: '🚌', col: '#188038', base: true },
  { k: 'biglietti', s: 'confirmation_number', nome: 'Biglietti bus', icona: '🎫', col: '#188038', base: true },
  { k: 'parcheggi', s: 'local_parking', nome: 'Parcheggi', icona: '🅿️', col: '#1967d2', base: true },
  { k: 'traghetti', s: 'directions_boat', nome: 'Traghetti', icona: '⛴️', col: '#0b8a9e', base: true },
  { k: 'taxi', s: 'local_taxi', nome: 'Taxi', icona: '🚕', col: '#b06000', base: false },
  { k: 'bar', s: 'local_cafe', nome: 'Bar e caffè', icona: '☕', col: '#e8710a', base: false },
  { k: 'ristoranti', s: 'restaurant', nome: 'Ristoranti', icona: '🍝', col: '#e8710a', base: false },
  { k: 'alimentari', s: 'shopping_cart', nome: 'Alimentari', icona: '🛒', col: '#9334e6', base: false },
  { k: 'farmacie', s: 'local_pharmacy', nome: 'Farmacie', icona: '💊', col: '#d93025', base: true },
  { k: 'salute', s: 'medical_services', nome: 'Salute e defibrillatori', icona: '⛑️', col: '#d93025', base: false },
  { k: 'bancomat', s: 'local_atm', nome: 'Bancomat', icona: '🏧', col: '#5f6368', base: false },
  { k: 'acqua', s: 'water_drop', nome: 'Acqua potabile', icona: '🚰', col: '#1a73e8', base: false },
  { k: 'info', s: 'info', nome: 'Informazioni', icona: 'ℹ️', col: '#1a73e8', base: false },
  { k: 'spiagge', s: 'beach_access', nome: 'Spiagge', icona: '🏖️', col: '#0b8a9e', base: false },
  { k: 'panorami', s: 'photo_camera', nome: 'Panorami', icona: '📷', col: '#0b8a9e', base: false },
  { k: 'chiese', s: 'church', nome: 'Chiese', icona: '⛪', col: '#5f6368', base: false },
  { k: 'sicurezza', s: 'local_police', nome: 'Polizia e soccorso', icona: '🚓', col: '#3c4043', base: false },
  { k: 'altro', s: 'location_on', nome: 'Altro', icona: '📍', col: '#5f6368', base: false },
]
export const categoria = (k: string) => CATEGORIE.find(c => c.k === k) ?? CATEGORIE[CATEGORIE.length - 1]

export type Poi = { id: string; c: string; n?: string; p: LL; note?: string; x?: Record<string, string>; fonte: 'osm' | 'mano'; nascosto?: boolean }
export type PoiOsm = { id: string; c: string; n?: string; p: LL; x?: Record<string, string> }
export type PoiDb = { id: string; c: string; n: string | null; lon: number; lat: number; note: string | null; nascosto: number }

/** Unisce: una riga a mano con l'id di un punto OSM lo corregge (o lo nasconde); le altre sono punti nuovi. */
export function unisciPoi(osm: PoiOsm[], db: PoiDb[]): Poi[] {
  const m = new Map(db.map(d => [d.id, d]))
  const out: Poi[] = osm.map(o => {
    const d = m.get(o.id)
    if (!d) return { ...o, fonte: 'osm' }
    m.delete(o.id)
    return { id: o.id, c: d.c, n: d.n ?? o.n, p: [d.lon, d.lat], note: d.note ?? undefined, x: o.x, fonte: 'osm', nascosto: !!d.nascosto }
  })
  for (const d of m.values()) out.push({ id: d.id, c: d.c, n: d.n ?? undefined, p: [d.lon, d.lat], note: d.note ?? undefined, fonte: 'mano', nascosto: !!d.nascosto })
  return out
}

const ORARI: Record<string, string> = { Mo: 'lun', Tu: 'mar', We: 'mer', Th: 'gio', Fr: 'ven', Sa: 'sab', Su: 'dom', PH: 'festivi', off: 'chiuso' }
/** Orari OSM resi leggibili (solo le sigle dei giorni; il resto resta com'è). */
export const orariLeggibili = (s: string) => s.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b/g, x => ORARI[x]).replace(/;\s*/g, ' · ')

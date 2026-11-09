import type { Strumento } from '../store'
import type { Tipo } from '../engine/model'
type D = Extract<Strumento, { k: 'disegna' }>
const d = (tipo: Tipo, nome: string, par: D['par'], min: number, max: number, aiuto: string): D => ({ k: 'disegna', tipo, nome, par, min, max, aiuto })
const LINEA = 'Clicca i punti lungo la strada, doppio clic o «Fine» per chiudere'
const POLI = 'Clicca i vertici dell\'area, doppio clic o «Fine» per chiudere'
export const GRUPPI: { id: string; nome: string; icona: string; voci: { nome: string; s: Strumento }[] }[] = [
  { id: 'misura', nome: 'Misura', icona: '📏', voci: [
    { nome: 'Distanza e pendenza', s: { k: 'misura', modo: 'distanza' } },
    { nome: 'Area', s: { k: 'misura', modo: 'area' } },
    { nome: 'Dislivello fra due punti', s: { k: 'misura', modo: 'altezza' } },
    { nome: 'Quota di un punto', s: { k: 'misura', modo: 'quota' } },
  ] },
  { id: 'segnaletica', nome: 'Segnaletica', icona: '〰️', voci: [
    { nome: 'Linea continua', s: d('linea', 'Linea continua', { stile: 'continua', colore: 'bianco', larghezza: 0.12 }, 2, 999, LINEA) },
    { nome: 'Linea tratteggiata', s: d('linea', 'Linea tratteggiata', { stile: 'tratteggiata', colore: 'bianco', larghezza: 0.12, tratto: 3, vuoto: 3 }, 2, 999, LINEA) },
    { nome: 'Doppia linea continua', s: d('linea', 'Doppia linea continua', { stile: 'doppia', colore: 'bianco', larghezza: 0.12 }, 2, 999, LINEA) },
    { nome: 'Linea gialla (cantiere)', s: d('linea', 'Linea gialla', { stile: 'continua', colore: 'giallo', larghezza: 0.15 }, 2, 999, LINEA) },
    { nome: 'Linea di arresto', s: d('arresto', 'Linea di arresto', { colore: 'bianco' }, 2, 2, 'Clicca i due estremi della linea') },
    { nome: 'Strisce pedonali', s: d('zebra', 'Strisce pedonali', { profondita: 2.5, vuoto: 0.5 }, 2, 2, 'Clicca un bordo della strada e poi quello di fronte') },
    { nome: 'Freccia', s: d('freccia', 'Freccia', { rot: 0, lunghezza: 4.5 }, 1, 1, 'Clicca dove va la freccia; il verso si gira nel pannello') },
  ] },
  { id: 'stalli', nome: 'Stalli', icona: '🅿️', voci: [
    { nome: 'Auto in linea, bianchi', s: d('stalli', 'Stalli in linea', { disposizione: 'linea', tipoStallo: 'auto', colore: 'bianco', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Auto in linea, blu', s: d('stalli', 'Stalli blu in linea', { disposizione: 'linea', tipoStallo: 'auto', colore: 'blu', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Auto a pettine', s: d('stalli', 'Stalli a pettine', { disposizione: 'pettine', tipoStallo: 'auto', colore: 'bianco', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Auto a spina (45°)', s: d('stalli', 'Stalli a spina', { disposizione: 'spina', tipoStallo: 'auto', colore: 'bianco', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Disabili', s: d('stalli', 'Stalli disabili', { disposizione: 'pettine', tipoStallo: 'disabili', colore: 'giallo', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Moto e scooter', s: d('stalli', 'Stalli moto', { disposizione: 'pettine', tipoStallo: 'moto', colore: 'bianco', lato: 1 }, 2, 999, LINEA) },
    { nome: 'Carico e scarico', s: d('stalli', 'Carico e scarico', { disposizione: 'linea', tipoStallo: 'carico', colore: 'giallo', lato: 1 }, 2, 999, LINEA) },
  ] },
  { id: 'aree', nome: 'Aree', icona: '▱', voci: [
    { nome: 'Area di attesa (protezione civile)', s: d('area', 'Area di attesa', { uso: 'attesa' }, 3, 999, POLI) },
    { nome: 'Area pedonale', s: d('area', 'Area pedonale', { uso: 'pedonale' }, 3, 999, POLI) },
    { nome: 'ZTL', s: d('area', 'ZTL', { uso: 'ztl' }, 3, 999, POLI) },
    { nome: 'Cantiere', s: d('area', 'Cantiere', { uso: 'cantiere' }, 3, 999, POLI) },
    { nome: 'Mercato o evento', s: d('area', 'Area evento', { uso: 'mercato' }, 3, 999, POLI) },
    { nome: 'Parcheggio', s: d('area', 'Parcheggio', { uso: 'parcheggio' }, 3, 999, POLI) },
    { nome: 'Verde', s: d('area', 'Verde', { uso: 'verde' }, 3, 999, POLI) },
  ] },
  { id: 'strutture', nome: 'Strutture', icona: '🏗️', voci: [
    { nome: 'Piazza a sbalzo con parcheggio', s: d('piazza', 'Piazza a sbalzo', { livelli: 1, attacco: 0 }, 3, 999, 'Il primo lato che disegni è quello attaccato alla strada. Doppio clic per chiudere') },
    { nome: 'Volume (edificio, muro, box)', s: d('volume', 'Volume', { altezza: 6, colore: '#e9d8bd', opacita: 1 }, 3, 999, POLI) },
    { nome: 'Transenne', s: d('barriera', 'Transenne', { tipo: 'transenna' }, 2, 999, LINEA) },
    { nome: 'New jersey', s: d('barriera', 'New jersey', { tipo: 'newjersey' }, 2, 999, LINEA) },
    { nome: 'Ringhiera', s: d('barriera', 'Ringhiera', { tipo: 'ringhiera' }, 2, 999, LINEA) },
    { nome: 'Parapetto in vetro', s: d('barriera', 'Parapetto in vetro', { tipo: 'vetro' }, 2, 999, LINEA) },
    { nome: 'Muro', s: d('barriera', 'Muro', { tipo: 'muro', altezza: 2 }, 2, 999, LINEA) },
    { nome: 'Scritta', s: d('testo', 'Scritta', { testo: 'Scritta', alto: 4 }, 1, 1, 'Clicca dove mettere la scritta') },
  ] },
]
export const modelloStrumento = (id: string, nome: string): Strumento => d('modello', nome, { m: id, rot: 0, scala: 1 }, 1, 1, 'Clicca dove posarlo. Si gira e si sposta dal pannello o trascinandolo')

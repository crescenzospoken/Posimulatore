// Posimulatore offline: la pagina, il codice, Cesium e i nostri dati (vie, quote, punti) restano sul telefono,
// così percorsi e indicazioni funzionano anche nei vicoli senza campo. Google 3D, API e /config sempre dalla rete.
const VERSIONE = 'posimulatore-1'
const BASE = ['/', '/index.html', '/manifest.webmanifest', '/icona-192.png', '/data/strade.json', '/data/quote-vie.json', '/data/poi.json', '/data/luoghi.json', '/data/confine.json', '/data/terreno.json', '/data/terreno-dettaglio.bin']
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(BASE)).then(() => self.skipWaiting())) })
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url)
  if (e.request.method !== 'GET' || u.origin !== location.origin) return
  if (u.pathname.startsWith('/api/') || u.pathname === '/config' || u.pathname.startsWith('/wms')) return
  // la pagina: prima la rete (aggiornamenti), senza campo quella salvata
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(VERSIONE).then(x => x.put('/', c)); return r }).catch(() => caches.match('/')))
    return
  }
  // codice (con l'impronta nel nome), Cesium e dati: dalla memoria, poi si aggiorna in silenzio
  e.respondWith(caches.match(e.request).then(m => {
    const rete = fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSIONE).then(x => x.put(e.request, c)) } return r }).catch(() => m)
    return m || rete
  }))
})

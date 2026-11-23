// Lingue: italiano (testi nel codice) e inglese. t('testo italiano') restituisce la traduzione nella lingua scelta.
// Le parti per chi progetta (modalità modifica) restano in italiano.
export type Lingua = 'it' | 'en'
let lingua: Lingua = 'it'
export const linguaAttuale = () => lingua
export const impostaLingua = (l: Lingua) => { lingua = l; document.documentElement.lang = l }
/** Lingua di partenza: ?lang=, poi quella del telefono (italiano solo se il telefono è in italiano). */
export const linguaIniziale = (): Lingua => {
  const q = new URLSearchParams(location.search).get('lang')
  if (q === 'it' || q === 'en') return q
  return (navigator.language || 'it').toLowerCase().startsWith('it') ? 'it' : 'en'
}

const EN: Record<string, string> = {
  
  'Da Google Maps': 'From Google Maps',
  'Risultati di Google': 'Results by Google',
  'Vai a': 'Go to',
  'Percorso': 'Directions',
  'Positano': 'Positano',
  'Cerca a Positano': 'Search Positano',
  'Cerca vie, luoghi e servizi': 'Search streets, places and services',
  'Cancella la ricerca': 'Clear search',
  'Guida': 'Help',
  'Guida e fonti dei dati': 'Help and data sources',
  'Livelli': 'Layers',
  'Mappa, Google 3D, colori delle vie, qualità': 'Map, Google 3D, street colours, quality',
  'Casa': 'Home',
  'Rimetti la vista': 'Reset view',
  'Rimetti la vista: sul percorso, sulla tua posizione o su tutta Positano': 'Reset view: to your route, your location or all of Positano',
  'Dove sono': 'My location',
  'Mostra dove sei (GPS)': 'Show where you are (GPS)',
  'Percorso a piedi': 'Walking directions',
  'Da un punto a un altro a piedi, con salite e scale': 'From one place to another on foot, with climbs and stairs',
  'Sei fuori Positano: il pallino blu compare quando arrivi': 'You are outside Positano: the blue dot will appear when you arrive',
  'Google 3D non risponde: per ora vedi il satellite': 'Google 3D is not responding: showing satellite for now',
  'Accessibile in sedia a rotelle': 'Wheelchair accessible',
  'Portami qui': 'Take me here',
  'Condividi': 'Share',
  'Modifica': 'Edit',
  'Hai fatto l\'accesso come': 'Signed in as',
  
  
  'Nome e cognome': 'Full name',
  'Email': 'Email',
  'Password': 'Password',
  'Almeno 8 caratteri': 'At least 8 characters',
  'Dopo la registrazione l\'amministratore abilita il tuo account alla modifica.': 'After signing up, the administrator enables your account for editing.',
  'Accedi': 'Sign in',
  'Registrati': 'Sign up',
  'Non hai un account? Registrati': 'No account? Sign up',
  'Hai già un account? Accedi': 'Already have an account? Sign in',
  'Esci': 'Sign out',
  'Account': 'Account',
  'Il tuo account': 'Your account',
  'Accedi per progettare e aggiornare la mappa': 'Sign in to design and update the map',
  
  
  
  'Sono qui': 'I am here',
  'Tocca la mappa': 'Tap the map',
  'Annulla': 'Cancel',
  'Cambia': 'Change',
  'Scegli': 'Choose',
  'Nessun punto Casa': 'No Home set',
  'punto scelto': 'chosen point',
  'Orari e recensioni': 'Hours and reviews',
  'Dati di Google': 'Data by Google',
  'Dati © OpenStreetMap': 'Data © OpenStreetMap',
  'Aggiunto dal Comune': 'Added locally',
  'Punti di interesse': 'Places',
  'Chiudi': 'Close',
  'Riduci': 'Minimise',
  'Il tuo punto Casa': 'Your Home',
  
  'Cerca hotel, via o luogo': 'Search hotel, street or place',
  'Cerca il tuo alloggio': 'Search for where you are staying',
  'Sei uscito': 'Signed out',
  'Questo dispositivo non dà la posizione': 'This device cannot share its location',
  'Sei fuori Positano: tocca la mappa o cerca un indirizzo': 'You are outside Positano: tap the map or search an address',
  'Posizione non permessa: tocca la mappa o cerca un indirizzo': 'Location not allowed: tap the map or search an address',
  'Posizione non disponibile adesso': 'Location not available right now',
  'Posizione non permessa: abilitala nelle impostazioni del browser': 'Location not allowed: enable it in your browser settings',
  'Link copiato': 'Link copied',
  'Copia non riuscita': 'Copy failed',
  
  'Da qui': 'From here',
  
  
  'Inverti': 'Swap',
  'Come conviene': 'Best way to get there',
  'Indicazioni': 'Step by step',
  'Stime nostre: passo tranquillo con salite e scale (regola DIN 33466 sulle quote LiDAR), gradini stimati in 16 cm l\'uno. Bus e auto sono indicativi. Col censimento delle scale diventeranno misure vere.': 'Our estimates: relaxed pace including climbs and stairs (DIN 33466 rule on LiDAR heights), steps estimated at 16 cm each. Bus and car times are indicative.',
  'Nessun percorso trovato: scegli punti vicino a una via o a una scala.': 'No route found: choose points near a street or a stairway.',
  'Link e QR': 'Link and QR',
  'Chi lo apre vede solo questo percorso. Dai un nome alla partenza e all\'arrivo: compare sul cartello.': 'Whoever opens it sees only this route. Name the start and destination: they appear on the sign.',
  'Copia link': 'Copy link',
  'Crea QR da stampare': 'Create printable QR',
  'Scarica l\'immagine': 'Download image',
  
  'Parti da dove sei adesso': 'Start from where you are now',
  'Scambia partenza e arrivo': 'Swap start and destination',
  'Percorsi alternativi': 'Alternative routes',
  'Questo telefono non dà la posizione': 'This phone cannot share its location',
  'Sei fuori Positano: scegli la partenza sulla mappa': 'You are outside Positano: choose the start on the map',
  'Posizione non disponibile: scegli la partenza sulla mappa': 'Location not available: choose the start on the map',
  'Copia non riuscita: tieni premuto sul link': 'Copy failed: press and hold the link',
  'La mia posizione': 'My location',
  'Partenza': 'Start',
  
  
  
  
  
  'Carico Street View…': 'Loading Street View…', 'Qui Google non ha foto a 360°: prova un po\' più avanti': 'No 360° photos here: try a little further on', 'Street View non raggiungibile': 'Street View not available', 'Indietro': 'Back', 'Avanti': 'Forward', 'Guarda il percorso': 'Preview the route',
  'Trascina per spostare': 'Drag to reorder', 'Togli la tappa': 'Remove stop', 'Da dove parti?': 'Where from?', 'Dove vuoi andare?': 'Where to?', 'Aggiungi una tappa': 'Add a stop', 'Sulla mappa': 'On the map', 'Tocca la mappa per aggiungere una tappa.': 'Tap the map to add a stop.', 'Cambia le tappe': 'Change stops',
  'Attenua il 3D': 'Soften the 3D', 'Schiarisce le foto del 3D: vie, percorsi e punti risaltano di più': 'Lightens the 3D photos so streets, routes and places stand out',
  'Scegli il tuo punto Casa': 'Choose your Home', 'Portami a Casa': 'Take me Home', 'I percorsi partono da qui e la ritrovi con un tocco sulla casetta.': 'Directions start here, and the house button brings you back.', 'Tocca la mappa dove vuoi la tua Casa': 'Tap the map where your Home is',
  'Da': 'From', 'A': 'To', 'In corso': 'Happening now', 'Programma': 'Programme', 'eventi in corso': 'events now',
  'Più veloce': 'Fastest', 'Meno scale': 'Fewer stairs', 'Meno salita': 'Less climbing',
  'A piedi': 'On foot', 'Bus': 'Bus', 'Auto': 'Car', 'consigliato': 'recommended',
  'ritorno': 'return', 'a piedi': 'on foot', 'gradini': 'steps', 'salita': 'up', 'discesa': 'down',
  'senza scale': 'no stairs', 'circa': 'about', 'sale': 'up', 'scende': 'down',
  'Scale': 'Stairs', 'Vicolo': 'Lane', 'Sentiero': 'Path', 'Strada': 'Road',
  'Bus sulla statale, attesa media 15 min, biglietto a bordo o in tabaccheria': 'Bus on the coast road, average wait 15 min, ticket on board or at a tobacconist',
  'Più il parcheggio: d\'estate lunghe attese e tariffe alte': 'Plus parking: long waits and high prices in summer',
  'quasi senza scale': 'almost no stairs',
  'Come arrivare': 'How to get there',
  'Come arrivare a': 'How to get to',
  'Inquadra il codice: si apre la mappa 3D con il percorso': 'Scan the code: the 3D map opens with the route',
  'Altri…': 'More…', 'Meno': 'Less',
  'Lingua': 'Language',
  // categorie
  'Bagni pubblici': 'Public toilets', 'Fermate bus': 'Bus stops', 'Biglietti bus': 'Bus tickets', 'Parcheggi': 'Parking',
  'Traghetti': 'Ferries', 'Taxi': 'Taxi', 'Bar e caffè': 'Bars and cafés', 'Ristoranti': 'Restaurants', 'Alimentari': 'Groceries',
  'Farmacie': 'Pharmacies', 'Salute e defibrillatori': 'Health and defibrillators', 'Bancomat': 'ATMs', 'Acqua potabile': 'Drinking water',
  'Informazioni': 'Information', 'Spiagge': 'Beaches', 'Panorami': 'Viewpoints', 'Chiese': 'Churches', 'Polizia e soccorso': 'Police and rescue',
  'Hotel e alloggi': 'Hotels and stays', 'Negozi': 'Shops', 'Altre attività': 'Other businesses', 'Altro': 'Other',
  'A pagamento': 'Paid', 'Gratuito': 'Free', 'Orari': 'Hours', 'nascosto ai visitatori': 'hidden from visitors',
  'strada': 'street', 'Tutta Positano': 'All of Positano', 'Spiaggia Grande e Collegiata': 'Spiaggia Grande and the Collegiata',
  'Bivio di Chiesa Nuova': 'Chiesa Nuova junction', 'La Sponda': 'La Sponda', 'Fornillo': 'Fornillo', 'Montepertuso': 'Montepertuso', 'Nocelle': 'Nocelle', 'Laurito': 'Laurito', 'Li Galli': 'Li Galli',
  // pannelli pubblici: Livelli, Guida
  'mappa e percorsi a piedi': 'map and walking routes',
  'Tipo di mappa': 'Map type', 'Foto 3D': '3D photos', 'Mappa': 'Map', 'Immagine del suolo': 'Ground image', 'Mappa semplice': 'Simple map', 'Satellite': 'Satellite',
  'Mappa OpenStreetMap': 'OpenStreetMap map', 'Torna ai colori di base': 'Back to default colours', 'Qualità e velocità': 'Quality and speed',
  'Leggera: veloce, adatta al telefono': 'Light: fast, best on phones', 'Normale': 'Normal', 'Alta: più dettaglio, serve un telefono o computer potente': 'High: more detail, needs a powerful phone or computer',
  'Vie, scale e sentieri': 'Streets, steps and paths', 'Tocca un colore per cambiarlo': 'Tap a colour to change it', 'Nomi dei luoghi': 'Place names', 'Confine comunale': 'Town boundary',
  'Immagine più nitida': 'Sharper image', 'Più dettaglio e colore sulle foto aeree': 'More detail and colour on aerial photos',
  'Statale': 'Main road', 'Strade': 'Roads', 'Accessi e cortili': 'Driveways and yards', 'Vie pedonali': 'Pedestrian streets', 'Sentieri e mulattiere': 'Paths and mule tracks',
  'Punto di interesse': 'Place', 'tappe': 'stops', 'Fatto': 'Done',
  'Fonti dei dati': 'Data sources', 'solo da guardare': 'view only',
  'Un dito sposta, due dita ingrandiscono, ruotano e inclinano': 'One finger moves, two fingers zoom, rotate and tilt',
  'Cerca vie, luoghi, negozi e servizi': 'Search streets, places, shops and services',
  'Percorso a piedi con tempo, scale e salita': 'Walking route with time, steps and climb',
  'Casa: salva dove alloggi e torna lì': 'Home: save where you stay and get back there',
  'La tua posizione col GPS': 'Your location by GPS', 'Rimetti la vista se ti perdi': 'Reset the view if you get lost',
  'Foto 3D o mappa semplice, colori delle vie': '3D photos or simple map, street colours',
  'Street View: foto a 360° di Google': 'Street View: Google 360° photos', 'Condividi un punto o un percorso': 'Share a place or a route',
  'Tempi e quote sono indicativi: in paese ci sono molte scale, calcola qualche minuto in più.': 'Times and heights are estimates: Positano has many steps, allow a few extra minutes.',
  // accesso con Google e luoghi salvati
  'Casa e luoghi salvati restano nel tuo account, su ogni telefono.': 'Home and saved places stay in your account, on every phone.',
  'Registrazione fatta': 'Account created', 'Bentornato': 'Welcome back',
  "Con l'accesso Casa e luoghi salvati ti seguono su ogni telefono. La mappa resta aperta a tutti.": 'Sign in to keep Home and saved places on every phone. The map stays open to everyone.',
  'Email e password (per chi modifica)': 'Email and password (for editors)', 'Google non risponde, riprova più tardi': 'Google is not responding, try again later',
  'I tuoi luoghi': 'Your places', 'Togli dai salvati': 'Remove from saved', 'Salvato': 'Saved', 'Salva': 'Save',
  // «Portami qui» dalla posizione
  'Cerco dove sei…': 'Finding where you are…', 'Posizione non disponibile: parto da Casa': 'Location not available: starting from Home',
  'Sei fuori Positano: parto da Casa': 'You are outside Positano: starting from Home',
  'GPS spento o non permesso: parto da Casa': 'GPS off or not allowed: starting from Home', 'GPS spento o non permesso: scegli la partenza sulla mappa': 'GPS off or not allowed: pick the start on the map',
  'Privacy': 'Privacy', "Termini d'uso": 'Terms of use', 'Elimina il mio account': 'Delete my account', 'Account eliminato': 'Account deleted', 'Sì, elimina tutto': 'Yes, delete everything', 'No': 'No',
  'Apri i dettagli': 'Show details',
  'Chiudi il percorso': 'Close the route', 'La mappa 3D non parte su questo dispositivo. Prova ad aggiornare il browser o a riaprire la pagina.': 'The 3D map cannot start on this device. Try updating your browser or reloading the page.',
  'Spessore': 'Thickness', 'Opacità': 'Opacity', 'Dove il 3D le copre': 'Where the 3D hides them',
}

/** Traduce un testo italiano; se manca la traduzione resta in italiano. */
export const t = (s: string) => (lingua === 'it' ? s : EN[s] ?? s)

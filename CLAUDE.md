# Posimulatore · note per Claude

- Lingua dell'interfaccia: italiano. Spiegazioni dei pulsanti dopo 1 secondo (`data-tip`), mai subito. Mai sottotitoli. Niente `confirm()`/`prompt()` di sistema. Stati accesi in azzurrino (`--accento-soft`), mai neri.
- Quote: tutto in m s.l.m. nel codice; Cesium vuole l'ellissoide: `GEOIDE` = 47,6 m (EGM96 a Positano) in `src/scene/terreno.ts`.
- Google 3D: solo visualizzazione (regole Map Tiles API): vietato salvare, esportare o ricalcare oggetti da quelle mesh.
- `requestRenderMode` è attivo: dopo ogni cambio di scena `viewer.scene.requestRender()`.
- Prove: `npm test` per il motore; per la grafica `node scripts/serve.mjs` (con `NODE_USE_ENV_PROXY=1` dietro proxy) e Playwright su `/?prova` (espone `window.__S` e `window.__V`). Ogni modifica va vista in una schermata.
- Cesium `1.146.0` con `@cesium/engine 26.4.0` fissato in `overrides`: la 26.5 non va con la 1.146.
- Velocità: mai `scene.pick` o `pickPosition` nel movimento del mouse (ognuno ridisegna tutta la scena con Google). La barra delle coordinate si scrive nel DOM, non nello stato React. Gli oggetti si ricalcolano dopo i caricamenti di Google solo se la vista si è spostata (oltre 80 m, al massimo ogni 3 s). Livelli di qualità in `src/scene/viewer.ts` (`Q`): leggera di base sul telefono.
- Gli oggetti hanno `nascosto`; «Com'è oggi» spegne tutto il progetto (`livelli.progetto`). La piazza toglie l'esistente da Google solo con `scava: true`.
- Le anteprime dei rami non hanno il secret `CESIUM_ION_TOKEN`: per provare con Google, servire la build locale sotto l'indirizzo vero con `page.route` di Playwright.
- Vie OSM disegnate in 3D alla quota LiDAR (`public/data/quote-vie.json`, DTM 2 m; quarto valore = superficie DSM se c'è, per le strade su arcate), non più `clampToGround`: proiettate sul terreno a 10 m alla Sponda finivano sui tetti. Mai `getHeight` di Google su tutte le vie (6 s).
- Percorso A→B: `src/engine/percorso.ts` (DIN 33466, test in `tests/percorso.test.ts`). Link `?da=lon,lat,Nome&a=lon,lat,Nome` apre la modalità ospite (solo percorso), per i QR.
- Di base edifici OSM e oggetti di progetto spenti (`rev: 2` nei livelli salvati).

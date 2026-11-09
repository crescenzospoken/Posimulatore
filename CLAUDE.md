# Posimulatore · note per Claude

- Lingua dell'interfaccia: italiano. Spiegazioni dei pulsanti dopo 1 secondo (`data-tip`), mai subito. Mai sottotitoli. Niente `confirm()`/`prompt()` di sistema. Stati accesi in azzurrino (`--accento-soft`), mai neri.
- Quote: tutto in m s.l.m. nel codice; Cesium vuole l'ellissoide: `GEOIDE` = 47,6 m (EGM96 a Positano) in `src/scene/terreno.ts`.
- Google 3D: solo visualizzazione (regole Map Tiles API): vietato salvare, esportare o ricalcare oggetti da quelle mesh.
- `requestRenderMode` è attivo: dopo ogni cambio di scena `viewer.scene.requestRender()`.
- Prove: `npm test` per il motore; per la grafica `node scripts/serve.mjs` (con `NODE_USE_ENV_PROXY=1` dietro proxy) e Playwright su `/?prova` (espone `window.__S` e `window.__V`). Ogni modifica va vista in una schermata.
- Cesium `1.146.0` con `@cesium/engine 26.4.0` fissato in `overrides`: la 26.5 non va con la 1.146.

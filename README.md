# Posimulatore

Positano in 3D da modificare: segnaletica, stalli, aree, strutture temporanee, piazze a sbalzo con parcheggio, misure e camminata ad altezza d'uomo. È la base per simulare le decisioni su viabilità e spazi pubblici e vederne gli effetti.

Tutto a costo zero e con dati aperti:

| Dato | Fonte | Licenza |
|---|---|---|
| Terreno nel comune | TINITALY 1.1, INGV, 10 m | CC BY 4.0 |
| Terreno attorno | Copernicus DEM GLO-30 | licenza Copernicus |
| Edifici, strade, luoghi, confine | OpenStreetMap (9/11/2026) | ODbL |
| Immagine del suolo | Esri World Imagery; in alternativa ortofoto 2012 del Geoportale Nazionale | attribuzione |
| 3D fotorealistico (facoltativo) | Google Photorealistic 3D Tiles via Cesium ion (gratuito) | solo visualizzazione, niente copie né ricalchi |

## Comandi

```bash
npm ci --legacy-peer-deps
npm run dev        # sviluppo
npm test           # motore (geometria, stalli, piazza a sbalzo)
npm run build      # dist/
npx wrangler deploy   # pubblica su Cloudflare Workers (piano gratuito)
```

Rifare i dati: `scripts/build-data.py` (vedi l'intestazione per le fonti da scaricare).

## Struttura

- `src/engine/` motore puro, testato: geometria locale, stalli, piazza a sbalzo, catalogo, norme con fonte.
- `src/scene/` CesiumJS: terreno nostro, edifici con facciate generate, oggetti, interazione, camminata.
- `src/ui/` pannelli e strumenti. `src/store.ts` progetti, opzioni, annulla/ripeti (salvati nel browser).
- `worker/` Cloudflare Worker: file statici e proxy dell'ortofoto ministeriale (servita solo in http).

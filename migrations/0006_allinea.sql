-- Punti di controllo messi a mano con lo strumento «Allinea»: di quanti metri (est, nord) spostare le vie in quel punto
-- perché combacino col 3D di Google. Solo disegno: percorsi e tempi usano i dati originali. Si sommano alle misure
-- automatiche di public/data/allinea-google.json, che vicino a un punto manuale non contano più.
CREATE TABLE IF NOT EXISTS allinea (id TEXT PRIMARY KEY, lon REAL NOT NULL, lat REAL NOT NULL, e REAL NOT NULL, n REAL NOT NULL, autore TEXT NOT NULL, aggiornato TEXT NOT NULL);

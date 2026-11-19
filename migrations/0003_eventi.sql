-- Eventi a tempo (concerti, feste, mercati, chiusure): compaiono sulla mappa solo da «inizio» a «fine» (ISO, ora italiana salvata in UTC).
CREATE TABLE IF NOT EXISTS eventi (id TEXT PRIMARY KEY, titolo TEXT NOT NULL, titolo_en TEXT, descr TEXT, descr_en TEXT, lon REAL NOT NULL, lat REAL NOT NULL, inizio TEXT NOT NULL, fine TEXT NOT NULL, link TEXT, autore TEXT NOT NULL, aggiornato TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS eventi_fine ON eventi(fine);

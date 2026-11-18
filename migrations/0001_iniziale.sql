-- Utenti: chi si registra parte «in attesa»; l'amministratore li abilita (editor) dalla pagina Utenti.
CREATE TABLE IF NOT EXISTS utenti (email TEXT PRIMARY KEY, nome TEXT NOT NULL, hash TEXT NOT NULL, sale TEXT NOT NULL, ruolo TEXT NOT NULL DEFAULT 'attesa', creato TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessioni (token TEXT PRIMARY KEY, email TEXT NOT NULL, scade INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessioni_email ON sessioni(email);
-- Punti di interesse aggiunti o corretti a mano (quelli di OpenStreetMap stanno in public/data/poi.json; qui solo le correzioni, con lo stesso id)
CREATE TABLE IF NOT EXISTS poi (id TEXT PRIMARY KEY, c TEXT NOT NULL, n TEXT, lon REAL NOT NULL, lat REAL NOT NULL, note TEXT, nascosto INTEGER NOT NULL DEFAULT 0, autore TEXT NOT NULL, aggiornato TEXT NOT NULL);
-- Impostazioni per tutti (es. coloriVie)
CREATE TABLE IF NOT EXISTS impostazioni (k TEXT PRIMARY KEY, v TEXT NOT NULL, autore TEXT NOT NULL, aggiornato TEXT NOT NULL);

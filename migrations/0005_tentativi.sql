-- Limite ai tentativi di accesso e registrazione: chiave = azione + impronta dell'IP (mai l'IP in chiaro) o email.
-- Le righe più vecchie di un giorno si cancellano da sole.
CREATE TABLE IF NOT EXISTS tentativi (k TEXT PRIMARY KEY, n INTEGER NOT NULL, da INTEGER NOT NULL);

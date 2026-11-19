-- Dati personali del visitatore che accede (con Google o email): Casa e luoghi salvati, in JSON. Mai dati di Google.
ALTER TABLE utenti ADD COLUMN dati TEXT;

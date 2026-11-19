-- Vie corrette a mano dagli editor (sul satellite Esri e con le quote LiDAR, mai ricalcate da Google 3D).
-- c = JSON [[lon,lat],...]; dz = metri da aggiungere alla quota del terreno (strade su arcate); controllata = 1 se verificata sul posto o sulla foto.
CREATE TABLE IF NOT EXISTS vie (id TEXT PRIMARY KEY, c TEXT NOT NULL, dz REAL NOT NULL DEFAULT 0, controllata INTEGER NOT NULL DEFAULT 1, nascosta INTEGER NOT NULL DEFAULT 0, autore TEXT NOT NULL, aggiornato TEXT NOT NULL);

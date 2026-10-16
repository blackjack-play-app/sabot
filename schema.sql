-- Totaux d'activité anonymes, agrégés par jour (aucune donnée personnelle)
CREATE TABLE IF NOT EXISTS events (
  day TEXT NOT NULL,
  e TEXT NOT NULL,
  p TEXT NOT NULL DEFAULT '',
  src TEXT NOT NULL DEFAULT 'web',
  country TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, e, p, src, country)
);

-- Réglages du tableau de bord (ex. k = 'reset' : date de remise à zéro + téléchargements GitHub déjà comptés)
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);

-- Activité par tranche de 10 minutes, avec ville approximative (carte et direct du tableau de bord pro)
CREATE TABLE IF NOT EXISTS hits (
  slot TEXT NOT NULL,
  e TEXT NOT NULL,
  p TEXT NOT NULL DEFAULT '',
  src TEXT NOT NULL DEFAULT 'web',
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  lat REAL,
  lon REAL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (slot, e, p, src, country, city)
);
CREATE INDEX IF NOT EXISTS hits_slot ON hits (slot);

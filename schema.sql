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

-- Visiteurs uniques du jour (empreinte anonyme recalculée chaque jour avec un sel aléatoire effacé ensuite)
-- t0 / t1 : première et dernière activité (secondes) ; srcs : 1 site, 2 appli PC, 4 appli installée, 8 itch.io
CREATE TABLE IF NOT EXISTS visitors (
  day TEXT NOT NULL,
  vid TEXT NOT NULL,
  t0 INTEGER NOT NULL,
  t1 INTEGER NOT NULL,
  srcs INTEGER NOT NULL DEFAULT 0,
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  lat REAL,
  lon REAL,
  device TEXT NOT NULL DEFAULT '',
  os TEXT NOT NULL DEFAULT '',
  browser TEXT NOT NULL DEFAULT '',
  entry TEXT NOT NULL DEFAULT '',
  ref TEXT NOT NULL DEFAULT '',
  camp TEXT NOT NULL DEFAULT '',
  page TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0,
  starts INTEGER NOT NULL DEFAULT 0,
  rounds INTEGER NOT NULL DEFAULT 0,
  drills INTEGER NOT NULL DEFAULT 0,
  dl INTEGER NOT NULL DEFAULT 0,
  ret INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, vid)
);
CREATE INDEX IF NOT EXISTS visitors_t1 ON visitors (t1);

-- Personnes actives par tranche de 10 minutes
CREATE TABLE IF NOT EXISTS presence (
  slot TEXT NOT NULL,
  vid TEXT NOT NULL,
  PRIMARY KEY (slot, vid)
);

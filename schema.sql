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

# Sabot — entraîneur de blackjack en 3D

Jeu d'entraînement au blackjack (jetons fictifs uniquement) : table 3D, croupier réaliste, jusqu'à 5 mains, coach de stratégie de base, comptage de cartes, exercices, simulateur et statistiques.

- Site : https://blackjack-play.app
- Jouer : https://blackjack-play.app/game/

## Structure

| Dossier | Contenu |
|---|---|
| `site/` | Site statique publié sur Cloudflare Pages (`site/game/` = le jeu) |
| `pages/` | Sources des pages du site (assemblées par `tools/build-site.mjs`) |
| `desktop/` | Application de bureau Electron (Windows, macOS, Linux) |
| `tools/` | Serveur local, captures d'écran, conversion des avatars, génération du site |
| `tests/` | Tests du moteur (simulation de millions de mains) |

## Commandes

```bash
npm install                      # outils
node tools/serve.mjs             # site local sur http://localhost:8080
node tests/edge.test.js          # vérifie l'avantage maison calculé par le moteur
node tools/build-site.mjs        # régénère les pages, sitemap.xml, robots.txt
python tools/build-sw.py         # régénère le cache hors ligne
cd desktop && npm run dist:win   # installateur Windows
```

Publier une nouvelle version : changer la version dans `site.config.json` et `desktop/package.json`, puis pousser un tag `vX.Y.Z` : GitHub Actions construit et publie les installateurs.

## Licences des ressources

Avatars Microsoft Rocketbox (MIT), sons Kenney (CC0), matières et HDRI Poly Haven (CC0), three.js (MIT), polices Barlow et Source Serif 4 (OFL), icônes Lucide (ISC). Détails : `site/credits.html`.

# product_system_manager

Backend de gestion e-commerce. En **V1**, le système fait une seule chose : **importer les commandes d'un Google Sheet (EasySell) et les afficher** sur un tableau de bord. Aucune logique métier interne (produits, ventes, stock) n'est branchée à ce stade.

- **Runtime** : [Bun](https://bun.com)
- **HTTP** : Express 5
- **Base de données** : PostgreSQL 16 via Drizzle ORM
- **Vues** : React 19 rendu en HTML statique côté serveur (SSR, sans JS client), injecté dans une coquille EJS
- **Source des données** : Google Sheets API (compte de service, lecture seule)

> Les montants sont en **FCFA** et les commentaires du code sont en français.

---

## Fonctionnement

```text
Google Sheet (EasySell)
   │  CRON (toutes les minutes)
   ▼
easysell_orders  ──►  Tableau de bord  (/easysell-orders/view)
 (table de staging)
```

- Un **cron** lit le Sheet toutes les minutes et fait un **UPSERT** dans `easysell_orders` (clé `sheet_id + external_order_id`). Les nouvelles commandes sont insérées, les existantes **réactualisées** depuis le Sheet — donc un changement de statut dans le Sheet est répercuté automatiquement.
- La **source du Sheet** se configure depuis l'interface (on colle le lien), sans toucher au `.env`.
- **Multi-Sheet** : si on change de Sheet, l'ancien reste en base et la vue affiche toutes les sources avec une colonne « Source » (le Sheet actif est marqué « actif »).

---

## Prérequis

- [Bun](https://bun.com) installé
- Docker (pour PostgreSQL)
- Un **compte de service Google** avec accès en lecture au Sheet (le Sheet doit être partagé avec l'email du compte de service)

---

## Configuration

Créer un fichier `.env` à la racine :

```bash
# Connexion Postgres. Depuis l'hôte, utiliser localhost (et NON le nom du conteneur).
DATABASE_URL=postgres://admin:secret@localhost:5432/ecommerce

# Compte de service Google (lecture seule sur le Sheet)
GOOGLE_CLIENT_EMAIL=mon-compte@projet.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Sheet par défaut (repli si aucun Sheet n'est configuré via l'interface)
GOOGLE_SHEET_ID=<id_du_google_sheet>
```

> Le host de `DATABASE_URL` dans `docker-compose.yml` est le nom du conteneur (`e_commerce_db`), qui ne résout que dans le réseau Docker. Pour lancer l'app / les scripts depuis l'hôte, pointer sur `localhost:5432`.

---

## Démarrage (première fois)

```bash
bun install                 # dépendances

bun run db:up               # démarre PostgreSQL (Docker, premier plan)
#  → en arrière-plan : docker compose up -d

bunx drizzle-kit migrate    # crée les tables (les migrations ne sont PAS auto-appliquées)
bun run src/main.ts         # démarre le serveur + le cron de synchronisation
```

L'application est disponible sur <http://localhost:3000>.

| Page                                           | URL                     |
| ---------------------------------------------- | ----------------------- |
| Tableau de bord (configurer la source Sheet)   | `/`                     |
| Commandes EasySell (table, filtre, pagination) | `/easysell-orders/view` |
| Commandes EasySell (JSON)                      | `/easysell-orders`      |

Sur le tableau de bord, **colle le lien de ton Google Sheet** : l'ID est extrait, l'accès est vérifié, puis la synchronisation l'alimente automatiquement.

---

## Commandes

```bash
# Base de données (Docker)
bun run db:up        # démarre Postgres (premier plan)
bun run db:down      # arrête Postgres
bun run db:reset     # down + up

# Migrations (Drizzle)
bunx drizzle-kit generate   # génère une migration depuis src/db/schema.ts
bunx drizzle-kit migrate    # applique les migrations
bunx drizzle-kit studio     # explore la base

# Application
bun run src/main.ts                      # serveur + cron
bun run watch                            # idem avec rechargement auto (tsx watch)
DISABLE_CRONS=true bun run src/main.ts   # serveur sans le cron

# Données
bunx tsx src/db/index.ts                       # seed (données de démo) — ⚠ vide la table d'abord
bunx tsx src/script/import-external-orders.ts  # déclenche une synchro manuelle
bunx tsx src/script/test-sheet.ts              # test de connexion au Sheet
```

> ⚠️ `src/db/index.ts` est un script de **seed** (malgré son nom) : il **efface toutes les lignes** de `easysell_orders` avant d'insérer les données de démo. À ne lancer que sur une base de test.

---

## Architecture

Structure **hexagonale**, un dossier par contexte sous `src/modules/<contexte>/` (à ce jour : `easysell-order`) :

| Couche      | Rôle                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `core/`     | Entités du domaine, ports (interfaces), services (cas d'usage). Contient aussi `sync.service.ts` (la logique d'import). |
| `inbound/`  | Contrôleur Express + vues React (`inbound/views/`).                                                                     |
| `outbound/` | Adaptateur Drizzle (implémente le port).                                                                                |
| `index.ts`  | Câblage : `repo → service → routeur`.                                                                                   |

Éléments transverses :

- `src/main.ts` — démarre Express, monte les routeurs, lance le cron.
- `src/db/` — `schema.ts` (les 2 tables), `client.ts` (client Drizzle partagé), `index.ts` (seed).
- `src/shared/` — `view.ts` (pont React→EJS), `home.tsx` (dashboard), `settings.ts` / `settings.rest.ts` (config du Sheet), `scheduler.ts` (cron), `format.ts`, `validate.ts`, `errors.ts`, `views/` (layout EJS + composant dashboard).
- `src/lib/google-sheet.ts` — client Google Sheets (compte de service).
- `drizzle/` — migrations SQL générées (ne pas éditer à la main).

### Modèle de données

Deux tables seulement :

- **`easysell_orders`** — données brutes du Sheet (staging). Clé unique `(sheet_id, external_order_id)` qui sert de cible au UPSERT. Les montants sont en `numeric(12,2)`, manipulés en **string** au niveau persistance pour éviter la dérive flottante.
- **`app_settings`** — config clé/valeur éditable depuis l'interface : `google_sheet_id`, `google_sheet_url`, et un `sheet_name:<sheetId>` par Sheet configuré (libellé lisible).

> Pour les détails d'architecture et les décisions de conception, voir [`CLAUDE.md`](CLAUDE.md).

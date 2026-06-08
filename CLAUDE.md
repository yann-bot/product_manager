# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`product_system_manager` is the backend for a Senegalese e-commerce management system (money is FCFA; domain comments are in French). Runtime is **Bun**; HTTP via **Express 5**; persistence via **Drizzle ORM** on **PostgreSQL 16**; pages are **React 19 rendered to static HTML server-side** (no client JS) injected into an **EJS** shell.

**Scope.** Two things live side by side:

1. **EasySell ingestion** (the original V1): Google Sheet (EasySell) → raw rows imported into the `easysell_orders` staging table → displayed "as-is" on the dashboard.
2. **Product module** (`modules/product/`): a real internal business context — the product catalog (full CRUD + archive), the first building block of the "OS Commerce" roadmap (see `E-COM-COFFRE/Produits.md`).

Other business contexts (sales, stock, purchases, customers, reconciliation) are **still not built** — an earlier design with all of those tables was deliberately removed; **do not reintroduce those unless explicitly asked.** The product module is the exception that *was* asked for.

## Commands

```bash
bun install              # install dependencies

bun run db:up            # start Postgres via docker compose (foreground)
bun run db:down          # stop Postgres
bun run db:reset         # down + up

bunx drizzle-kit generate   # generate a migration from schema.ts into ./drizzle
bunx drizzle-kit migrate    # apply migrations (NOT auto-applied at startup)
bunx drizzle-kit studio     # browse the DB

bunx tsx src/db/index.ts    # seed demo data (NOT the db client — see File notes). Re-runnable: wipes easysell_orders first.

bun run src/main.ts         # start the Express server + the cron
bun run watch               # same, with auto-reload (tsx watch src/main.ts)
DISABLE_CRONS=true bun run src/main.ts   # run without the in-process cron

bunx tsx src/script/import-external-orders.ts  # manual trigger of CRON 1 (Sheet -> easysell_orders)
bunx tsx src/script/test-sheet.ts              # dump raw Sheet rows (connectivity check)
```

First run from scratch (from the host): `bun run db:up` → `bunx drizzle-kit migrate` → `bunx tsx src/db/index.ts`.

The `dev` / `build` scripts in package.json are non-functional placeholders; use `bun run src/main.ts` or `bun run watch`. There are no lint or test scripts; if you add tests, prefer Bun's built-in `bun test`.

## Environment

`.env` holds `DATABASE_URL`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`. The Postgres host in docker-compose is the **container name** `e_commerce_db`, which resolves only inside the docker network — to run app/seed/drizzle-kit from the host, point `DATABASE_URL` at `localhost:5432` (credentials `admin:secret`, db `ecommerce`, per `docker-compose.yml`).

Google access uses a **service account** (`lib/google-sheet.ts`, readonly scope). The target Sheet must be shared with `GOOGLE_CLIENT_EMAIL`.

## Architecture

**Hexagonal, one folder per bounded context under `src/modules/<context>/`** (`easysell-order`, `product`):
- `core/` — `entities.ts` (domain interface + repository **port**) and `*.service.ts` (use-cases). Also holds `sync.service.ts` (the Sheet ingestion logic).
- `inbound/` — Express controller (`*.rest.tsx`) + React views (`inbound/views/`).
- `outbound/` — Drizzle adapter implementing the port (`*.postgres.ts`).
- `index.ts` — manual wiring: `repo → service → controller(router)`, exported as the router.

`src/main.ts` boots Express, mounts each router (`HomeRouter`, `SettingsRouter`, `EasySellOrderRouter`, `ProductRouter`), sets EJS as the view engine, serves static assets as a fallback, then calls `startCrons()`.

Key design decisions:

- **`easysell_orders` is a pure staging table** (`src/db/schema.ts`): lenient, no FKs, no enforced defaults — data is kept exactly as it arrives (quantity/price/status stay `null` if absent/invalid). `sheet_id` records the source spreadsheet. `(sheet_id, external_order_id)` is **UNIQUE** (one order = one Sheet row in practice) — this is the upsert key.

- **Ingestion (`sync.service.ts`, run by CRON 1).** Reads range `A:Z`; column positions are in the `COL` map; `NOISE_PRODUCTS` filters misaligned rows; rows without an order id or product name are skipped. **UPSERT on `(sheet_id, external_order_id)`**: new orders are inserted and already-known orders are *re-synced* from the Sheet (status, client, prices…) — the Sheet is the source of truth, so status changes propagate. Within a batch, rows are de-duplicated by `external_order_id` (last occurrence wins) to avoid hitting the same row twice in one `ON CONFLICT`. The Sheet id is resolved from `app_settings.google_sheet_id`, falling back to `GOOGLE_SHEET_ID` (`shared/settings.ts → getSheetId`).

- **`app_settings` is key/value config** editable from the UI (`google_sheet_id`, `google_sheet_url`, and one `sheet_name:<sheetId>` per configured Sheet) — the Sheet source is not hard-coded in `.env`. `POST /settings/google-sheet` extracts the id from a pasted link (`extractSheetId`), verifies the service account can read it (403/404 handling), then persists (id + url + the Sheet's title as `sheet_name:<id>`).

- **Multi-Sheet is supported, not exclusive.** Switching the active Sheet (UI) only changes which Sheet the cron syncs (`getSheetId` = `app_settings.google_sheet_id` → env fallback). Rows from previously-synced Sheets stay in the DB (keyed by their own `sheet_id`) and the orders view shows **all** Sheets, with a per-row "Source" column (friendly title via `getSheetNames`, else `shortSheetId`) and an "actif" badge on the currently-synced one. There is no per-Sheet deletion.

- **One cron only** (`shared/scheduler.ts`): CRON 1 `* * * * *` runs `EasySellSyncService.sync()`. A re-entrancy guard skips a run still in flight; `DISABLE_CRONS=true` turns it off. The manual script calls the same service.

- **React SSR ↔ EJS bridge** (`shared/view.ts → renderPage`): each page body is a React component rendered with `renderToStaticMarkup` (no hydration, no client JS) and injected into `shared/views/layout.ejs`. `NavKey` in `view.ts` enumerates the highlightable nav tabs.

- **Money is `numeric(12,2)` and surfaces as a `string`** through Drizzle. Keep money as strings at the persistence boundary (sync, seed) to avoid float drift; the outbound adapter converts to `number` only when building domain entities. Display formatting (FCFA, fr-FR) lives in `shared/format.ts`.

- **`status` is plain `VARCHAR`, not a pg enum** — Sheet status strings (e.g. `"A - Livré"`) are stored verbatim.

Routes: `GET /` (dashboard), `POST /settings/google-sheet` (connect a Sheet), `GET /easysell-orders` (JSON), `GET /easysell-orders/view` (HTML table).

Product module routes (`modules/product/inbound/product.rest.tsx`) come in two families on the same `ProductService`:

- **JSON REST:** `GET/POST /products`, `GET/PATCH/DELETE /products/:id` (`DELETE` = archive, never a hard delete — RM-04).
- **HTML screens:** `GET /products/view` (list, `?status=all|active|archived`), `GET|POST /products/new` (create), `GET /products/:id/view` (detail), `GET|POST /products/:id/edit` (update), `POST /products/:id/archive`. Forms post `urlencoded`; zod (`z.coerce`/`preprocess`) normalizes the string inputs. Business rules (RM-01 name required, RM-02 sellingPrice > 0, default status `active`) live in `product.service.ts`; the DB column also defaults `status` to `'active'` via `DEFAULT_PRODUCT_STATUS`.

### File notes

- `src/db/schema.ts` — **barrel only**: re-exports every schema; defines no table itself. This is the single aggregation point Drizzle reads (`drizzle.config.ts` + `db/client.ts`), so editing the re-exported files drives migrations. **Schema separation rule:** all schemas are centralized under `src/db/schemas/`, **one file per module/topic** (`<topic>.schema.ts`), never mixed. Never define a table in the barrel. To add a table: create/edit `src/db/schemas/<topic>.schema.ts` then re-export it from `db/schema.ts`. Today: `easysell_orders` → `db/schemas/easysell-order.schema.ts`; `app_settings` → `db/schemas/app-settings.schema.ts`.
- `src/db/client.ts` — the shared Drizzle client (`db`); import this from adapters/scripts.
- `src/db/index.ts` — despite the name, this is the **seed script**, not the client. Re-runnable; wipes `easysell_orders` first.
- `src/shared/` — cross-cutting: `view.ts` (SSR bridge), `home.tsx` (dashboard `/`), `settings.ts` + `settings.rest.ts` (Sheet config), `scheduler.ts` (cron), `errors.ts` (domain errors + FK-violation detection), `format.ts`, `validate.ts` (zod body validation), `views/` (EJS layout + dashboard component).
- `src/lib/google-sheet.ts` — Google Sheets API client (service account).
- `src/script/` — manual one-shot triggers over the same services.
- `drizzle/` — generated SQL migrations + metadata; don't hand-edit.

## TypeScript

Strict mode with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (use `import type` for type-only imports). JSX is `react-jsx`; Bun/bundler mode allows importing `.ts`/`.tsx` extensions directly.

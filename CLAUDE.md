# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`product_system_manager` is the backend for a Senegalese e-commerce management system (money is FCFA; domain comments are in French). Runtime is **Bun**; HTTP via **Express 5**; persistence via **Drizzle ORM** on **PostgreSQL**; pages are **React 19 rendered to static HTML server-side** (no client JS, no hydration) injected into an **EJS** shell.

What started as EasySell ingestion is now a multi-module "OS Commerce": raw Google Sheet orders are ingested, the delivered ones are turned into internal sales, sales draw down a stock ledger and get a FIFO-costed COGS snapshot, and everything is reported through a dashboard and analytics screens. Money flows are in FCFA.

## Scope — the modules

Seven bounded contexts under `src/modules/`, **grouped into category folders by concern** (`src/modules/<category>/<context>/`), plus cross-cutting code in `src/shared/`:

```text
src/modules/
  ingestion/    easysell, easysell-sale   — external data in (staging + bridge to internal)
  catalog/      product                   — reference / master data
  operations/   sales, stock              — business transactions that move stock & revenue
  valuation/    costing                   — accounting / FIFO cost
  reporting/    analytics                 — read-only compute-on-read aggregates
```

The category is purely an organisational grouping — there is no code at the category level (no `index.ts`, no shared state); each `<context>/` is still a self-contained hexagonal module. Same-category siblings import each other directly (`operations/sales` → `../stock`); cross-category imports route through the category dir (`operations/sales` → `../../catalog/product`).

1. **`ingestion/easysell`** — EasySell ingestion (the original V1): Google Sheet → raw rows upserted into the `easysell_orders` **staging table** → displayed "as-is".
2. **`ingestion/easysell-sale`** — the bridge from raw EasySell orders to the internal catalog. Delivered orders are imported into `easysell_sales` (pending), then **reconciled manually by product name** to a real `products.id`; a successful reconciliation materializes a real internal sale.
3. **`catalog/product`** — the product catalog (full CRUD + archive, never hard-delete).
4. **`operations/sales`** — internal sales (merchant-entered or born from reconciliation). MVP mono-produit. A sale decrements stock and gets a FIFO COGS snapshot.
5. **`operations/stock`** — the stock movement journal. Stock level is **derived** (`SUM(quantity)` of signed deltas), never stored.
6. **`valuation/costing`** — FIFO valuation: per-sale COGS snapshot at sale time, plus an auditable full-replay recalculation.
7. **`reporting/analytics`** — compute-on-read reporting over the EasySell orders (status buckets, daily series, indicators).

Customers/finance contexts are **not built** — only blocks backed by real data exist. Don't fabricate them; the roadmap (`E-COM-COFFRE/`) tracks future phases.

## Commands

```bash
bun install              # install dependencies

bun run db:up            # start Postgres via docker compose (foreground)
bun run db:down          # stop Postgres
bun run db:reset         # down + up
bun run db:push          # drizzle-kit push (dev-only schema sync, bypasses migrations)

bunx drizzle-kit generate   # generate a migration from schema.ts into ./drizzle
bun run migrate             # apply migrations (drizzle-kit migrate)
bunx drizzle-kit studio     # browse the DB

bunx tsx src/db/index.ts    # seed demo data (NOT the db client — see File notes). Re-runnable: wipes easysell_orders first.

bun run start            # start the Express server + the cron pipeline (bun run src/main.ts)
bun run dev              # same, with auto-reload (bun --watch src/main.ts)
DISABLE_CRONS=true bun run start   # run without the in-process cron

bun test                 # run unit tests (Bun's built-in runner; *.test.ts colocated in core/)

# Manual one-shot triggers (same services the cron uses):
bunx tsx src/script/import-external-orders.ts   # CRON 1: Sheet -> easysell_orders
bunx tsx src/script/import-easysell-sales.ts    # CRON 2: easysell_orders -> easysell_sales
bunx tsx src/script/recalculate-cogs.ts         # auditable FIFO recompute -> sales.cogs_recalculated
bunx tsx src/script/backfill-reconciled-sales.ts # idempotent data migration (old reconciliations -> internal sales)
bunx tsx src/script/test-sheet.ts               # dump raw Sheet rows (connectivity check)
```

First run from scratch (from the host): `bun run db:up` → `bun run migrate` → `bunx tsx src/db/index.ts`.

The `build` script (`bun build`) is a non-functional placeholder — Bun runs the TypeScript directly, there is no build step. There is no lint script.

## Environment

`.env` holds `DATABASE_URL`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`, and optionally `PORT` / `DISABLE_CRONS`. The Postgres host in docker-compose is the **container name** `e_commerce_db`, which resolves only inside the docker network — to run app/seed/drizzle-kit from the host, point `DATABASE_URL` at `localhost:5432` (credentials `admin:secret`, db `ecommerce`, per `docker-compose.yml`).

Google access uses a **service account** (`lib/google-sheet.ts`, readonly scope). The target Sheet must be shared with `GOOGLE_CLIENT_EMAIL`.

## Deployment

A single `Dockerfile` (base `oven/bun:1`, no build step) is self-sufficient across platforms: its `CMD` runs `bunx drizzle-kit migrate` **then** starts the app + in-process cron. So in production migrations *are* applied at startup; locally they are not — apply them yourself with `bun run migrate`.

- `render.yaml` — Render blueprint (Docker web service, Oregon, `develop` branch, autodeploy). The Postgres DB is provisioned out-of-band; `DATABASE_URL` + the Google secrets are set in the dashboard. ⚠️ on the `free` plan the service sleeps after ~15 min idle, so the per-minute cron pauses during sleep.
- `railway.json` — Railway equivalent (Dockerfile builder, `preDeployCommand` runs the migration).

## Architecture

**Hexagonal, one folder per bounded context, grouped by concern under `src/modules/<category>/<context>/`** (see "Scope — the modules"):

- `core/` — `*.entities.ts` (domain types + repository/collaborator **ports**) and `*.service.ts` (use-cases). Pure logic also lives here (`fifo.ts`, `movement.ts`, `classify-status.ts`, `build-easysell-sale.ts`) with colocated `*.test.ts`. The Sheet ingestion logic is `easysell/core/sync.service.ts`; the sale import is `easysell-sale/core/import-sales.service.ts`.
- `inbound/` — Express controller (`*.rest.tsx`) + React views (`inbound/views/`).
- `outbound/` — Drizzle adapter implementing the port (`*.postgres.ts`).
- `index.ts` — manual wiring: `repo → service → controller(router)`, exported as the router. Cross-module dependencies are injected here (e.g. Sales wires in Product, Stock, and Costing).

`src/main.ts` boots Express, mounts each router (`HomeRouter`, `SettingsRouter`, `EasySellOrderRouter`, `ProductRouter`, `SalesRouter`, `StockRouter`, `ReconciliationRouter`, `AnalyticsRouter`, `CostingRouter`), sets EJS as the view engine, serves static assets as a fallback (`index: false`, so `/` stays the dashboard), then calls `startCrons()`.

Key design decisions:

- **`easysell_orders` is a pure staging table** (`db/schemas/easysell-order.schema.ts`): lenient, no FKs, no enforced defaults — data is kept exactly as it arrives (quantity/price/status stay `null` if absent/invalid). `sheet_id` records the source spreadsheet. `(sheet_id, external_order_id)` is **UNIQUE** — the upsert key.

- **Ingestion (`sync.service.ts`).** Reads range `A:Z`; column positions are in the `COL` map; `NOISE_PRODUCTS` filters misaligned rows; rows without an order id or product name are skipped. **UPSERT on `(sheet_id, external_order_id)`**: the Sheet is the source of truth, so status/client/price changes propagate, not just new orders. Within a batch, rows are de-duplicated by `external_order_id` (last wins). The Sheet id resolves from `app_settings.google_sheet_id`, falling back to `GOOGLE_SHEET_ID` (`shared/settings.ts → getSheetId`).

- **The cron is a chained PIPELINE** (`shared/scheduler.ts`), `* * * * *`: CRON 1 `EasySellSyncService.sync()` (Sheet → `easysell_orders`) then CRON 2 `EasySellSaleImportService.import()` (delivered orders → `easysell_sales`) run in one job, so the import always sees fresh data and shares one re-entrancy guard (`guarded()`). `DISABLE_CRONS=true` turns it off. The manual scripts call the same services. The reconciliation step itself (`easysell_sales` → internal sale) is **manual**, not cronned.

- **`app_settings` is key/value config** editable from the UI. Each configured Sheet is described by a **trio of prefixed keys**: `sheet_name:<id>` (readable title), `sheet_url:<id>` (pasted link, optional), `sheet_disabled:<id>` (`"1"` when disabled — absence = enabled). `sheets_migrated_v2` is the one-time mono→multi migration flag (legacy `google_sheet_id`/`google_sheet_url` are read only by that migration). `POST /settings/google-sheet` accepts **one link per line** (textarea), extracts each id (`extractSheetId`), verifies the service account can read it (403/404 handling) per link, then persists — reporting added/failed.

- **Multi-Sheet is concurrent, not exclusive.** Several Sheets can be configured and **each is independently enabled/disabled**; the cron syncs **all enabled Sheets** (`getEnabledSheetIds`), isolating per-Sheet failures so one bad Sheet (access revoked, deleted) doesn't break the others. Rows from any Sheet stay (keyed by their own `sheet_id`); the orders view shows **all** Sheets with a per-row "Source" column and an "actif" badge on the currently-enabled ones. Settings can enable/disable (`POST /settings/sheets/toggle`) or remove (`POST /settings/sheets/remove`, which drops the config but keeps already-imported rows) any Sheet. Helpers live in `shared/settings.ts` (`listSheets`, `getEnabledSheetIds`, `addSheet`, `setSheetEnabled`, `removeSheet`). **Upgrade behaviour:** on first run the mono-Sheet migration keeps the formerly-active Sheet enabled and disables previously-archived ones, so sync behaviour doesn't change until the user enables more.

- **Internal sales (`sales.service.ts`).** Rules (canvas « Module Sales »): RM-01 a sale targets a product; RM-02 quantity > 0; RM-03 unit price is read **from the product at sale time** (snapshot); RM-04 line total = qty × unit price; RM-05 sale total = sum; RM-06 a cancelled sale leaves revenue. Sales depends on the Product port (pricing), the Stock port (`StockLedger`: `recordSaleOut`/`reverseSale`), and the Costing port (`CostingLedger`: `costSale`). A sale born from reconciliation carries `easysell_sale_id` (UNIQUE → idempotent reconciliation/backfill; multiple NULLs allowed for manual sales).

- **Stock is derived (`stock.service.ts`).** Only signed-delta movements are written (`in` +q, `out` −q, `adjustment` = target − current); the level is read as `SUM(quantity)`. No agregate is stored, so no drift. **No negative-stock block** — a sale must always go through. `sale_id` / `easysell_sale_id` trace auto-generated movements (sale out, cancellation in); at most one source per movement.

- **FIFO costing (`costing/`).** `replayFifo` (pure) drives two uses on the stock journal: `costSale` writes a **frozen** per-sale COGS snapshot (`sales.cogs`) right after the stock-out, plus the per-lot breakdown into the **immutable** `sale_lot_allocations` (the accounting record); `recalculate` replays the full per-product journal into `sales.cogs_recalculated` (audit truth). The gap between the two reveals sales made **à découvert** (uncovered, priced at a provisional `unit_cost` with `lot_movement_id` NULL) and later regularized. `stock_movements.unit_cost` is the frozen per-lot cost (set on `in` movements; NULL on pure `out`); the **selling** price lives on the product.

- **Reconciliation is by name (`reconciliation.service.ts`).** The merchant links an EasySell product name (free text) to a real product: (1) the mapping is memorized in `easysell_product_mappings` to auto-reconcile future imports; (2) all `pending` `easysell_sales` of that name are reconciled immediately; (3) each materializes an internal sale (port `SalesWriter`), which is what decrements stock.

- **Analytics is compute-on-read (`analytics.service.ts`).** No stored aggregates; raw status counts are folded into canonical buckets via `classifyStatus`. `NOISE` and `UNKNOWN` are excluded from indicators (RM-04). The dashboard read (`shared/dashboard.read.ts`) is a separate, transverse read-only SQL view ("only real data": products, stock, orders, sales).

- **React SSR ↔ EJS bridge** (`shared/view.tsx → renderPage`): each page body **and the chrome** (sidebar + topbar) are React components rendered with `renderToStaticMarkup` (no hydration, no client JS); `renderPage` injects all three (`sidebar`, `topbar`, `body`) into the thin shell `shared/views/layout.ejs` (which now holds only CSS, structure, and the client table script). `NavKey` enumerates the nav tabs: `dashboard`, `easysell-orders`, `products`, `sales`, `stock`, `reconciliation`, `analytics`, `costing`, `settings`. `shared/views/Sidebar.tsx` owns the nav: items grouped under collapsible `<details>` parents (Produits&Stock, Ventes, Reporting) — the group containing the active key is auto-opened; no client JS. **Icons are `react-icons` (Feather, `react-icons/fi`)** rendered to inline SVG server-side — no emoji in the UI.

- **Money is `numeric(12,2)` and surfaces as a `string`** through Drizzle. Keep money as strings at the persistence boundary (sync, seed); the outbound adapter converts to `number` only when building domain entities. Display formatting (FCFA, fr-FR) lives in `shared/format.ts`.

- **Status/type columns are plain `VARCHAR`, not pg enums** — EasySell status strings (e.g. `"A - Livré"`) are stored verbatim; product/sale `status`, movement `type`, and reconciliation status stay loose VARCHARs whose DB defaults mirror the `core` constants (`DEFAULT_PRODUCT_STATUS`, `DEFAULT_SALE_STATUS`, `DEFAULT_RECONCILIATION_STATUS`).

### Routes

- **Shared:** `GET /` (dashboard), `GET /settings/view` (settings page), `POST /settings/google-sheet` (add one-or-more Sheets, one link per line), `POST /settings/sheets/toggle` (enable/disable a Sheet), `POST /settings/sheets/remove` (drop a Sheet's config). All settings POSTs redirect back to `?redirect=` or `/`.
- **EasySell:** `GET /easysell-orders` (JSON, unfiltered), `GET /easysell-orders/view` (HTML; shared date window `?period|month|from+to` filtered in-memory on `date_heure` — undated rows show only under "Tout"). **One tab per Sheet** via `?sheetId=<id>` (absent = "Toutes les sources"); tabs cover every configured Sheet **plus** orphan Sheets still present in the data, and **disabled Sheets stay browsable** (read-only banner) — the tab list/filter is built in the controller, the view is pure.
- **Product:** JSON REST `GET/POST /products`, `GET/PATCH/DELETE /products/:id` (`DELETE` = archive, never hard delete — RM-04). HTML: `GET /products/view` (`?status=all|active|archived`), `GET|POST /products/new`, `GET /products/:id/view`, `GET|POST /products/:id/edit`, `POST /products/:id/archive`. Forms post `urlencoded`; zod normalizes inputs; business rules (RM-01 name, RM-02 sellingPrice > 0, default `active`) in `product.service.ts`.
- **Sales:** JSON `GET/POST /sales`, `GET /sales/:id`, `PATCH /sales/:id/cancel`. HTML: `GET /sales/view` (date filter `?period|month|from+to` + `?status`), `GET|POST /sales/new`, `GET /sales/:id/view`, `POST /sales/:id/cancel`.
- **Stock:** JSON `GET/POST /stock/movements`, `GET /stock`. HTML: `GET /stock/view`, `GET|POST /stock/movements/new`, `GET /stock/movements`, `GET /stock/:productId/view`.
- **Reconciliation:** `GET /reconciliation/view`, `POST /reconciliation/reconcile`.
- **Analytics:** `GET /analytics` (JSON), `GET /analytics/view`. Both accept `?sheetId=` and the shared date window (`?period|month|from+to`); "CA du mois" stays the current calendar month, independent of the window.
- **Costing:** `GET /costing/view` (audit screen), `POST /costing/recalculate`.

### File notes

- `src/db/schema.ts` — **barrel only**: re-exports every schema; defines no table. This is the single aggregation point Drizzle reads (`drizzle.config.ts` + `db/client.ts`), so editing the re-exported files drives migrations. **Schema separation rule:** all schemas live under `src/db/schemas/`, **one file per module/topic** (`<topic>.schema.ts`). Never define a table in the barrel. To add a table: create/edit `src/db/schemas/<topic>.schema.ts` then re-export it. Today: `easysell-order`, `app-settings`, `product`, `sales`, `easysell-sale` (+ `easysell_product_mappings`), `stock-movement`, `sale-lot-allocation`.
- `src/db/client.ts` — the shared Drizzle client (`db`); import this from adapters/scripts.
- `src/db/index.ts` — despite the name, the **seed script**, not the client. Re-runnable; wipes `easysell_orders` first.
- `src/shared/` — cross-cutting: `view.tsx` (SSR bridge + `NavKey`; renders chrome + body), `home.tsx` (dashboard `/` controller), `dashboard.read.ts` (transverse compute-on-read SQL), `settings.ts` (Sheet config helpers) + `settings.rest.tsx` (`GET /settings/view` page + `POST /settings/google-sheet` + `parseSheetStatus`), `date-scope.ts` (shared date-window filter: `resolveDateScope` → `{scope, range}` + `dateScopeQuery`, used by Sales/Analytics/EasySell), `scheduler.ts` (the cron pipeline), `errors.ts` (domain errors + FK-violation detection), `format.ts`, `validate.ts` (zod body validation), `views/` (`layout.ejs` shell, `Sidebar.tsx`, `Topbar.tsx`, `DashboardPage.tsx`, `SettingsPage.tsx`, `DateFilterBar.tsx`, `charts.tsx`).
- `src/lib/google-sheet.ts` — Google Sheets API client (service account).
- `src/script/` — manual one-shot triggers over the same services (see Commands).
- `drizzle/` — generated SQL migrations (`0000`–`0008`) + metadata; don't hand-edit.

## TypeScript

Strict mode with `noUncheckedIndexedAccess` and `verbatimModuleSyntax` (use `import type` for type-only imports). JSX is `react-jsx`; Bun/bundler mode allows importing `.ts`/`.tsx` extensions directly.
</content>
</invoke>

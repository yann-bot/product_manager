import 'dotenv/config';
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { startCrons } from "./shared/scheduler";
import HomeRouter from "./shared/home";
import SettingsRouter from "./shared/settings.rest";
import EasySellOrderRouter from "./modules/ingestion/easysell";
import ProductRouter from "./modules/catalog/product";
import SalesRouter from "./modules/operations/sales";
import StockRouter from "./modules/operations/stock";
import ReconciliationRouter from "./modules/ingestion/easysell-sale";
import AnalyticsRouter from "./modules/reporting/analytics";
import CostingRouter from "./modules/valuation/costing";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Moteur de vues : EJS comme coquille HTML partagée. Le corps des pages
// est rendu par React (SSR) puis injecté dans le layout (voir shared/view.ts).
app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "src/shared/views"));

// Routes applicatives (prioritaires sur les fichiers statiques).
app.use(HomeRouter);
app.use(SettingsRouter);
app.use(EasySellOrderRouter);
app.use(ProductRouter);
app.use(SalesRouter);
app.use(StockRouter);
app.use(ReconciliationRouter);
app.use(AnalyticsRouter);
app.use(CostingRouter);

// Repli statique : assets + ancienne UI de test accessible via /index.html.
// `index: false` pour ne pas court-circuiter la route "/" du dashboard.
app.use(express.static(rootDir, { index: false }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port}`);
  // Couche d'automatisation : CRON 1 (sync Google Sheet -> easysell_orders).
  startCrons();
});

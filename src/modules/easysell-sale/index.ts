import { db } from "../../db/client";
import { ReconciliationService } from "./core/reconciliation.service";
import { ProductService } from "../product/core/product.service";
import { ProductPostgresRepository } from "../product/outbound/product.postgres";
import { StockService } from "../stock/core/stock.service";
import { StockPostgresRepository } from "../stock/outbound/stock.postgres";
import { SalesService } from "../sales/core/sales.service";
import { SalesPostgresRepository } from "../sales/outbound/sales.postgres";
import ReconciliationController from "./inbound/reconciliation.rest";

// Surface HTTP du module easysell-sale : l'écran de réconciliation manuelle.
// (L'import easysell_orders -> easysell_sales, lui, passe par le cron et le
// script, pas par une route.)
//
// Une réconciliation réussie matérialise une VENTE INTERNE : on injecte le
// SalesService (qui satisfait le port SalesWriter). La vente, à son tour,
// décrémente le stock via son propre StockLedger.
const productRepo = new ProductPostgresRepository(db);
const stockService = new StockService(new StockPostgresRepository(db), productRepo);
const salesService = new SalesService(
  new SalesPostgresRepository(db),
  productRepo,
  stockService,
);
const service = new ReconciliationService(salesService);
const productService = new ProductService(productRepo);
const ReconciliationRouter = ReconciliationController(service, productService);

export default ReconciliationRouter;

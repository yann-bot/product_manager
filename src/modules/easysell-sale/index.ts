import { db } from "../../db/client";
import { ReconciliationService } from "./core/reconciliation.service";
import { ProductService } from "../product/core/product.service";
import { ProductPostgresRepository } from "../product/outbound/product.postgres";
import { StockService } from "../stock/core/stock.service";
import { StockPostgresRepository } from "../stock/outbound/stock.postgres";
import ReconciliationController from "./inbound/reconciliation.rest";

// Surface HTTP du module easysell-sale : l'écran de réconciliation manuelle.
// (L'import easysell_orders -> easysell_sales, lui, passe par le cron et le
// script, pas par une route.)
//
// Une réconciliation réussie génère une sortie de stock : on injecte le
// StockService (qui satisfait le port StockOut).
const productRepo = new ProductPostgresRepository(db);
const stockService = new StockService(new StockPostgresRepository(db), productRepo);
const service = new ReconciliationService(stockService);
const productService = new ProductService(productRepo);
const ReconciliationRouter = ReconciliationController(service, productService);

export default ReconciliationRouter;

// src/script/import-easysell-sales.ts
//
// Lancement manuel de l'import easysell_orders -> easysell_sales.
// La logique vit dans EasySellSaleImportService (partagée avec le cron).

import "dotenv/config";
import { db } from "../db/client";
import { EasySellSaleImportService } from "../modules/ingestion/easysell-sale/core/import-sales.service";
import { StockService } from "../modules/operations/stock/core/stock.service";
import { StockPostgresRepository } from "../modules/operations/stock/outbound/stock.postgres";
import { ProductPostgresRepository } from "../modules/catalog/product/outbound/product.postgres";
import { SalesService } from "../modules/operations/sales/core/sales.service";
import { SalesPostgresRepository } from "../modules/operations/sales/outbound/sales.postgres";
import { CostingService } from "../modules/valuation/costing/core/costing.service";
import { CostingPostgresRepository } from "../modules/valuation/costing/outbound/costing.postgres";

async function main() {
  const productRepo = new ProductPostgresRepository(db);
  const stock = new StockService(new StockPostgresRepository(db), productRepo);
  const sales = new SalesService(
    new SalesPostgresRepository(db),
    productRepo,
    stock,
    new CostingService(new CostingPostgresRepository(db)),
  );
  const r = await new EasySellSaleImportService(sales).import();
  console.log(
    `${r.imported} vente(s) importée(s) dans easysell_sales ` +
      `(réconciliées=${r.reconciled}, en attente=${r.pending}) ; ` +
      `${r.skippedExisting} déjà importée(s), ${r.skippedNotDelivered} non livrée(s)/sans produit ; ` +
      `${r.salesCreated} vente(s) interne(s) créée(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

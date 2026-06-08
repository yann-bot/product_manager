// src/script/import-easysell-sales.ts
//
// Lancement manuel de l'import easysell_orders -> easysell_sales.
// La logique vit dans EasySellSaleImportService (partagée avec le cron).

import "dotenv/config";
import { db } from "../db/client";
import { EasySellSaleImportService } from "../modules/easysell-sale/core/import-sales.service";
import { StockService } from "../modules/stock/core/stock.service";
import { StockPostgresRepository } from "../modules/stock/outbound/stock.postgres";
import { ProductPostgresRepository } from "../modules/product/outbound/product.postgres";
import { SalesService } from "../modules/sales/core/sales.service";
import { SalesPostgresRepository } from "../modules/sales/outbound/sales.postgres";

async function main() {
  const productRepo = new ProductPostgresRepository(db);
  const stock = new StockService(new StockPostgresRepository(db), productRepo);
  const sales = new SalesService(new SalesPostgresRepository(db), productRepo, stock);
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

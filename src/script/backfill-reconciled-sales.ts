// src/script/backfill-reconciled-sales.ts
//
// Migration de données one-shot (idempotente) : convertit les
// réconciliations EasySell EXISTANTES — qui avaient généré une sortie de
// stock DIRECTE mais aucune vente interne — en vraies ventes internes.
//
// Pour chaque vente EasySell réconciliée sans vente interne (qty > 0) :
//   1) crée la vente interne (createFromEasySell) -> nouvelle sortie de
//      stock portée par `sale_id` ;
//   2) supprime l'ancienne sortie directe (portée par `easysell_sale_id`).
// => stock net inchangé, provenance désormais cohérente.
//
// Idempotent : le LEFT JOIN sur `sales.easysell_sale_id` exclut celles déjà
// converties ; la contrainte UNIQUE est un filet de sécurité.

import "dotenv/config";
import { and, eq, gt, isNull, isNotNull } from "drizzle-orm";
import { db } from "../db/client";
import { easysellSales } from "../db/schemas/easysell-sale.schema";
import { sales } from "../db/schemas/sales.schema";
import { stockMovements } from "../db/schemas/stock-movement.schema";
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
  const salesService = new SalesService(
    new SalesPostgresRepository(db),
    productRepo,
    stock,
    new CostingService(new CostingPostgresRepository(db)),
  );

  const rows = await db
    .select({
      id: easysellSales.id,
      productId: easysellSales.productId,
      quantity: easysellSales.quantity,
      unitPrice: easysellSales.unitPrice,
      totalPrice: easysellSales.totalPrice,
      saleDate: easysellSales.saleDate,
    })
    .from(easysellSales)
    .leftJoin(sales, eq(sales.easysellSaleId, easysellSales.id))
    .where(
      and(
        eq(easysellSales.reconciliationStatus, "reconciled"),
        isNotNull(easysellSales.productId),
        isNotNull(easysellSales.quantity),
        gt(easysellSales.quantity, 0),
        isNull(sales.id),
      ),
    );

  let created = 0;
  let removedOldOut = 0;
  for (const r of rows) {
    if (r.productId === null || r.quantity === null) continue; // garde TS

    await salesService.createFromEasySell({
      productId: r.productId,
      quantity: r.quantity,
      easysellSaleId: r.id,
      unitPrice: r.unitPrice !== null ? Number(r.unitPrice) : null,
      totalPrice: r.totalPrice !== null ? Number(r.totalPrice) : null,
      saleDate: r.saleDate,
    });
    created++;

    const deleted = await db
      .delete(stockMovements)
      .where(eq(stockMovements.easysellSaleId, r.id))
      .returning({ id: stockMovements.id });
    removedOldOut += deleted.length;
  }

  console.log(
    `Backfill : ${rows.length} réconciliation(s) à convertir ; ` +
      `${created} vente(s) interne(s) créée(s), ` +
      `${removedOldOut} ancienne(s) sortie(s) directe(s) supprimée(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

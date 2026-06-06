import { db } from "../../../db/client";
import { easysellOrders } from "../../../db/schemas/easysell-order.schema";
import {
  easysellSales,
  easysellProductMappings,
} from "../../../db/schemas/easysell-sale.schema";
import {
  isDeliveredSale,
  buildEasySellSaleInsert,
  type SourceOrder,
} from "./build-easysell-sale";
import type { StockOut } from "./stock.port";

//
// ======================================================
// IMPORT : easysell_orders -> easysell_sales
// ======================================================
// Étape « ExternalOrder -> EasySellSale » du flux de réconciliation.
// Service batch auto-suffisant (db en direct), en miroir de
// `easysell/core/sync.service.ts`. La transformation pure est dans
// `build-easysell-sale.ts` (testée).
//
//   - LIVRÉES SEULEMENT : seules les commandes livrées deviennent des
//     ventes (le reste est ignoré).
//   - AUTO-RÉCONCILIATION : on relie le nom de produit EasySell à un
//     produit interne via `easysell_product_mappings` (sinon "pending").
//   - IDEMPOTENT (skip-existing) : on n'insère que les commandes pas
//     encore présentes dans `easysell_sales` (préserve la réconciliation
//     manuelle déjà faite — on ne réécrit jamais un product_id/statut).
// ======================================================
//

export interface ImportResult {
  /** Lignes easysell_sales nouvellement insérées. */
  imported: number;
  /** Parmi les importées : auto-réconciliées (product_id trouvé). */
  reconciled: number;
  /** Parmi les importées : en attente de réconciliation manuelle. */
  pending: number;
  /** Commandes déjà importées (ou doublon intra-lot) — ignorées. */
  skippedExisting: number;
  /** Commandes non livrées ou sans nom de produit — pas des ventes. */
  skippedNotDelivered: number;
  /** Sorties de stock générées par les ventes auto-réconciliées à l'import. */
  stockOut: number;
}

export class EasySellSaleImportService {
  constructor(private readonly stock: StockOut) {}

  async import(): Promise<ImportResult> {
    // 1. Source : commandes brutes (colonnes utiles ; montants en string).
    const orders = await db
      .select({
        externalOrderId: easysellOrders.externalOrderId,
        status: easysellOrders.status,
        productName: easysellOrders.nomProduit,
        quantity: easysellOrders.quantite,
        unitPrice: easysellOrders.prixUnitaire,
        totalPrice: easysellOrders.prixTotal,
        saleDate: easysellOrders.dateHeure,
      })
      .from(easysellOrders);

    // 2. Mappings nom EasySell -> produit interne (auto-réconciliation).
    const mappings = await db
      .select({
        name: easysellProductMappings.easySellProductName,
        productId: easysellProductMappings.productId,
      })
      .from(easysellProductMappings);
    const productIdByName = new Map<string, string>();
    for (const m of mappings) productIdByName.set(m.name, m.productId);

    // 3. Déjà importées (idempotence par external_order_id).
    const existingRows = await db
      .select({ externalOrderId: easysellSales.externalOrderId })
      .from(easysellSales);
    const existing = new Set(existingRows.map((r) => r.externalOrderId));

    let skippedNotDelivered = 0;
    let skippedExisting = 0;
    let reconciled = 0;
    let pending = 0;

    // Dédoublonnage intra-lot par external_order_id (1re occurrence gardée).
    const toInsert = new Map<string, typeof easysellSales.$inferInsert>();

    for (const o of orders) {
      // Pas une vente : non livrée, ou sans nom de produit (insert impossible).
      if (!o.productName || !isDeliveredSale(o.status)) {
        skippedNotDelivered++;
        continue;
      }
      // Déjà en base ou déjà vue dans ce lot.
      if (existing.has(o.externalOrderId) || toInsert.has(o.externalOrderId)) {
        skippedExisting++;
        continue;
      }

      const productId = productIdByName.get(o.productName) ?? null;
      const source: SourceOrder = {
        externalOrderId: o.externalOrderId,
        productName: o.productName,
        quantity: o.quantity,
        unitPrice: o.unitPrice,
        totalPrice: o.totalPrice,
        saleDate: o.saleDate,
      };
      toInsert.set(o.externalOrderId, buildEasySellSaleInsert(source, productId));
      if (productId) reconciled++;
      else pending++;
    }

    const rows = [...toInsert.values()];
    let stockOut = 0;
    if (rows.length > 0) {
      const inserted = await db
        .insert(easysellSales)
        .values(rows)
        .returning({
          id: easysellSales.id,
          productId: easysellSales.productId,
          quantity: easysellSales.quantity,
          reconciliationStatus: easysellSales.reconciliationStatus,
        });

      // Sortie de stock pour les ventes AUTO-réconciliées à l'import (mapping
      // trouvé). Quantité nulle/≤0 ignorée.
      for (const r of inserted) {
        if (
          r.reconciliationStatus === "reconciled" &&
          r.productId !== null &&
          r.quantity !== null &&
          r.quantity > 0
        ) {
          await this.stock.recordEasySellOut({
            productId: r.productId,
            quantity: r.quantity,
            easysellSaleId: r.id,
          });
          stockOut++;
        }
      }
    }

    return {
      imported: rows.length,
      reconciled,
      pending,
      skippedExisting,
      skippedNotDelivered,
      stockOut,
    };
  }
}

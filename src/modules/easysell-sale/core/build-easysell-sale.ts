import { classifyStatus } from "../../analytics/core/classify-status";
import {
  easysellSales,
  DEFAULT_RECONCILIATION_STATUS,
} from "../../../db/schemas/easysell-sale.schema";

//
// ======================================================
// Transformation PURE : easysell_orders -> easysell_sales
// ======================================================
// Cœur testable de l'import (le service ne fait que l'I/O autour).
//   - `isDeliveredSale` : seule une commande LIVRÉE devient une vente
//     (décision « livrées seulement »), via classifyStatus (déjà testé).
//   - `buildEasySellSaleInsert` : mappe une commande source vers la ligne
//     à insérer, et tranche le statut de réconciliation selon qu'un
//     produit interne a (ou non) été trouvé.
// Montants laissés en `string` (numeric -> numeric) : pas de dérive
// flottante (règle « money as strings »).
// ======================================================
//

type InsertValues = typeof easysellSales.$inferInsert;

/** Sous-ensemble d'une commande EasySell nécessaire à l'import (productName non-null). */
export interface SourceOrder {
  externalOrderId: string;
  productName: string;
  quantity: number | null;
  unitPrice: string | null;
  totalPrice: string | null;
  saleDate: Date | null;
}

/** Une commande ne devient une vente que si elle est LIVRÉE (= vrai CA). */
export function isDeliveredSale(status: string | null): boolean {
  return classifyStatus(status) === "DELIVERED";
}

/**
 * Ligne `easysell_sales` à insérer pour une commande livrée.
 * `productId` résolu par le service via les mappings : présent => réconcilié,
 * absent (null) => en attente de réconciliation manuelle.
 */
export function buildEasySellSaleInsert(
  order: SourceOrder,
  productId: string | null,
): InsertValues {
  return {
    externalOrderId: order.externalOrderId,
    productName: order.productName,
    quantity: order.quantity,
    unitPrice: order.unitPrice,
    totalPrice: order.totalPrice,
    saleDate: order.saleDate,
    productId,
    reconciliationStatus: productId ? "reconciled" : DEFAULT_RECONCILIATION_STATUS,
  };
}

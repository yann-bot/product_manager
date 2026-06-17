import { and, eq, sql } from "drizzle-orm";
import { db } from "../../../../db/client";
import {
  easysellSales,
  easysellProductMappings,
} from "../../../../db/schemas/easysell-sale.schema";
import type { SalesWriter } from "./sales.port";

//
// ======================================================
// RÉCONCILIATION MANUELLE : easysell_sales (pending) -> Product
// ======================================================
// Le marchand relie un NOM de produit EasySell (texte libre) à un produit
// interne. La réconciliation se fait PAR NOM (pas ligne par ligne) :
//   1) on mémorise le mapping (easysell_product_mappings) pour automatiser
//      les imports futurs ;
//   2) on réconcilie IMMÉDIATEMENT toutes les ventes "pending" de ce nom
//      (l'import saute les déjà-importées, donc il faut les mettre à jour
//      ici, sinon elles resteraient "pending" pour toujours) ;
//   3) chaque vente réconciliée matérialise une VENTE INTERNE (port
//      SalesWriter) — l'import ne ramène que des commandes livrées, donc de
//      vraies ventes ; c'est la vente créée qui décrémente le stock.
// Service auto-suffisant (db en direct), en miroir des autres services
// batch du module EasySell.
// ======================================================
//

/** Un groupe de ventes en attente, agrégé par nom de produit EasySell. */
export interface PendingGroup {
  productName: string;
  count: number;
  /** Somme des total_price (nuls comptés 0), FCFA. */
  totalAmount: number;
}

/** Compteurs d'en-tête de l'écran de réconciliation. */
export interface ReconciliationCounts {
  pendingSales: number;
  reconciledSales: number;
  pendingNames: number;
}

export class ReconciliationService {
  constructor(private readonly sales: SalesWriter) {}

  /** Groupes de ventes EN ATTENTE, par nom de produit (les plus gros d'abord). */
  async pendingGroups(): Promise<PendingGroup[]> {
    return db
      .select({
        productName: easysellSales.productName,
        count: sql<number>`count(*)::int`,
        totalAmount: sql<number>`coalesce(sum(${easysellSales.totalPrice}), 0)::float8`,
      })
      .from(easysellSales)
      .where(eq(easysellSales.reconciliationStatus, "pending"))
      .groupBy(easysellSales.productName)
      .orderBy(sql`count(*) desc`);
  }

  async counts(): Promise<ReconciliationCounts> {
    const [row] = await db
      .select({
        pendingSales: sql<number>`count(*) filter (where ${easysellSales.reconciliationStatus} = 'pending')::int`,
        reconciledSales: sql<number>`count(*) filter (where ${easysellSales.reconciliationStatus} = 'reconciled')::int`,
        pendingNames: sql<number>`count(distinct ${easysellSales.productName}) filter (where ${easysellSales.reconciliationStatus} = 'pending')::int`,
      })
      .from(easysellSales);
    return row ?? { pendingSales: 0, reconciledSales: 0, pendingNames: 0 };
  }

  /**
   * Réconcilie un nom de produit EasySell vers un produit interne.
   * Mémorise le mapping (upsert) puis réconcilie toutes les ventes "pending"
   * de ce nom. Retourne le nombre de ventes réconciliées.
   */
  async reconcile(productName: string, productId: string): Promise<number> {
    // 1. Mapping pour les imports futurs (idempotent : ré-affecte le produit
    //    si le nom était déjà mappé).
    await db
      .insert(easysellProductMappings)
      .values({ easySellProductName: productName, productId })
      .onConflictDoUpdate({
        target: easysellProductMappings.easySellProductName,
        set: { productId: sql`excluded.product_id` },
      });

    // 2. Réconciliation immédiate des ventes "pending" de ce nom.
    const updated = await db
      .update(easysellSales)
      .set({ productId, reconciliationStatus: "reconciled" })
      .where(
        and(
          eq(easysellSales.productName, productName),
          eq(easysellSales.reconciliationStatus, "pending"),
        ),
      )
      .returning({
        id: easysellSales.id,
        quantity: easysellSales.quantity,
        unitPrice: easysellSales.unitPrice,
        totalPrice: easysellSales.totalPrice,
        saleDate: easysellSales.saleDate,
      });

    // 3. Une VENTE INTERNE par vente réconciliée (qui génère la sortie de
    //    stock). Quantité nulle/≤0 ignorée : on ne vend pas une quantité
    //    inconnue. Montants numeric (string) -> number à la frontière.
    for (const row of updated) {
      if (row.quantity !== null && row.quantity > 0) {
        await this.sales.createFromEasySell({
          productId,
          quantity: row.quantity,
          easysellSaleId: row.id,
          unitPrice: row.unitPrice !== null ? Number(row.unitPrice) : null,
          totalPrice: row.totalPrice !== null ? Number(row.totalPrice) : null,
          saleDate: row.saleDate,
        });
      }
    }

    return updated.length;
  }
}

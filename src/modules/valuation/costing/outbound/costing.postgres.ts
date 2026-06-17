import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "../../../../db/client";
import { stockMovements } from "../../../../db/schemas/stock-movement.schema";
import { sales } from "../../../../db/schemas/sales.schema";
import { products } from "../../../../db/schemas/product.schema";
import { saleLotAllocations } from "../../../../db/schemas/sale-lot-allocation.schema";
import type {
  CostingRepository,
  LedgerEvent,
  SaleSnapshot,
} from "../core/costing.entities";

type MovementRow = typeof stockMovements.$inferSelect;

// Argent : numeric <-> string à la frontière (cf. « money as strings »).
const toNumber = (v: string | null): number | null =>
  v !== null ? Number(v) : null;
const toMoney = (n: number): string => String(n);

function toEvent(row: MovementRow): LedgerEvent {
  return {
    movementId: row.id,
    saleId: row.saleId,
    kind: row.type as LedgerEvent["kind"],
    signedQty: row.quantity,
    unitCost: toNumber(row.unitCost),
    createdAt: row.createdAt,
  };
}

export class CostingPostgresRepository implements CostingRepository {
  constructor(private readonly db: DB) {}

  // Journal complet d'un produit, ordre FIFO stable : (created_at, id).
  async eventsForProduct(productId: string): Promise<LedgerEvent[]> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId))
      .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id));
    return rows.map(toEvent);
  }

  // Journal tronqué jusqu'au mouvement 'out' de la vente (inclus) : sert au
  // snapshot. Comparaison de tuple (created_at, id) pour borner précisément.
  async eventsForProductUpToSale(
    productId: string,
    saleId: string,
  ): Promise<LedgerEvent[]> {
    const [out] = await this.db
      .select({ createdAt: stockMovements.createdAt, id: stockMovements.id })
      .from(stockMovements)
      .where(
        and(eq(stockMovements.saleId, saleId), eq(stockMovements.type, "out")),
      )
      .limit(1);
    if (!out) return [];

    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.productId, productId),
          sql`(${stockMovements.createdAt}, ${stockMovements.id}) <= (${out.createdAt}, ${out.id})`,
        ),
      )
      .orderBy(asc(stockMovements.createdAt), asc(stockMovements.id));
    return rows.map(toEvent);
  }

  async distinctProductIds(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ productId: stockMovements.productId })
      .from(stockMovements);
    return rows.map((r) => r.productId);
  }

  async fallbackCostOf(productId: string): Promise<number> {
    const [row] = await this.db
      .select({ costPrice: products.costPrice })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    return row?.costPrice != null ? Number(row.costPrice) : 0;
  }

  // Fige le snapshot d'une vente : ventilation (remplacée pour idempotence) +
  // cogs + découvert sur la vente.
  async saveSnapshot(snapshot: SaleSnapshot): Promise<void> {
    await this.db
      .delete(saleLotAllocations)
      .where(eq(saleLotAllocations.saleId, snapshot.saleId));

    if (snapshot.allocations.length > 0) {
      await this.db.insert(saleLotAllocations).values(
        snapshot.allocations.map((a) => ({
          saleId: snapshot.saleId,
          lotMovementId: a.lotMovementId,
          quantity: a.quantity,
          unitCost: toMoney(a.unitCost),
        })),
      );
    }

    await this.db
      .update(sales)
      .set({
        cogs: toMoney(snapshot.cogs),
        shortfallQuantity: snapshot.shortfallQuantity,
      })
      .where(eq(sales.id, snapshot.saleId));
  }

  async saveRecalculated(
    saleId: string,
    cogsRecalculated: number,
  ): Promise<void> {
    await this.db
      .update(sales)
      .set({ cogsRecalculated: toMoney(cogsRecalculated) })
      .where(eq(sales.id, saleId));
  }
}

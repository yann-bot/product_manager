import { desc, eq, sql } from "drizzle-orm";
import type { DB } from "../../../db/client";
import { stockMovements } from "../../../db/schemas/stock-movement.schema";
import { products } from "../../../db/schemas/product.schema";
import type {
  NewMovement,
  ProductStock,
  StockMovement,
  StockMovementRepository,
} from "../core/stock.entities";

type Row = typeof stockMovements.$inferSelect;

function toEntity(row: Row): StockMovement {
  return {
    id: row.id,
    productId: row.productId,
    type: row.type as StockMovement["type"],
    quantity: row.quantity,
    note: row.note,
    saleId: row.saleId,
    easysellSaleId: row.easysellSaleId,
    createdAt: row.createdAt,
  };
}

// Stock courant = SUM des deltas. Cast ::int pour récupérer un number JS
// (cf. analytics.postgres.ts), coalesce pour 0 quand aucun mouvement.
const sumQty = sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::int`;

export class StockPostgresRepository implements StockMovementRepository {
  constructor(private readonly db: DB) {}

  async create(movement: NewMovement): Promise<StockMovement> {
    const [row] = await this.db
      .insert(stockMovements)
      .values({
        productId: movement.productId,
        type: movement.type,
        quantity: movement.quantity,
        note: movement.note ?? null,
        saleId: movement.saleId ?? null,
        easysellSaleId: movement.easysellSaleId ?? null,
      })
      .returning();
    if (!row)
      throw new Error("Insertion mouvement de stock : aucune ligne retournée.");
    return toEntity(row);
  }

  async findAll(productId?: string): Promise<StockMovement[]> {
    const rows = await this.db
      .select()
      .from(stockMovements)
      .where(productId ? eq(stockMovements.productId, productId) : undefined)
      .orderBy(desc(stockMovements.createdAt));
    return rows.map(toEntity);
  }

  async stockByProduct(): Promise<ProductStock[]> {
    const rows = await this.db
      .select({
        productId: products.id,
        productName: products.name,
        status: products.status,
        quantity: sumQty,
      })
      .from(products)
      .leftJoin(stockMovements, eq(stockMovements.productId, products.id))
      .groupBy(products.id, products.name, products.status)
      .orderBy(products.name);
    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      status: r.status as ProductStock["status"],
      quantity: r.quantity,
    }));
  }

  async currentStockOf(productId: string): Promise<number> {
    const [row] = await this.db
      .select({ quantity: sumQty })
      .from(stockMovements)
      .where(eq(stockMovements.productId, productId));
    return row?.quantity ?? 0;
  }
}

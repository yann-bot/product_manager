import { desc, eq } from "drizzle-orm";
import type { DB } from "../../../../db/client";
import { sales } from "../../../../db/schemas/sales.schema";
import { NotFoundError } from "../../../../shared/errors";
import type { NewSale, Sale, SalesRepository } from "../core/sales.entities";

type Row = typeof sales.$inferSelect;

// Argent : la colonne numeric remonte/attend une `string` via Drizzle.
// On convertit aux frontières (cf. décision « money as strings »). Ici
// unit_price / total_amount sont NOT NULL : toujours présents.
const toNumber = (value: string): number => Number(value);
const toNumberOrNull = (value: string | null): number | null =>
  value !== null ? Number(value) : null;
const toMoney = (value: number): string => String(value);

function toEntity(row: Row): Sale {
  return {
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    unitPrice: toNumber(row.unitPrice),
    totalAmount: toNumber(row.totalAmount),
    status: row.status as Sale["status"],
    notes: row.notes,
    cogs: toNumberOrNull(row.cogs),
    cogsRecalculated: toNumberOrNull(row.cogsRecalculated),
    shortfallQuantity: row.shortfallQuantity,
    easysellSaleId: row.easysellSaleId,
    saleDate: row.saleDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class SalesPostgresRepository implements SalesRepository {
  constructor(private readonly db: DB) {}

  async findAll(): Promise<Sale[]> {
    const rows = await this.db
      .select()
      .from(sales)
      .orderBy(desc(sales.saleDate), desc(sales.createdAt));
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<Sale | null> {
    const [row] = await this.db
      .select()
      .from(sales)
      .where(eq(sales.id, id))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async create(sale: NewSale): Promise<Sale> {
    const [row] = await this.db
      .insert(sales)
      .values({
        productId: sale.productId,
        quantity: sale.quantity,
        unitPrice: toMoney(sale.unitPrice),
        totalAmount: toMoney(sale.totalAmount),
        status: sale.status,
        notes: sale.notes ?? null,
        easysellSaleId: sale.easysellSaleId ?? null,
        saleDate: sale.saleDate,
      })
      .returning();
    if (!row) throw new Error("Insertion vente : aucune ligne retournée.");
    return toEntity(row);
  }

  async cancel(id: string): Promise<Sale> {
    const [row] = await this.db
      .update(sales)
      .set({ status: "cancelled" })
      .where(eq(sales.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Vente introuvable : ${id}`);
    return toEntity(row);
  }
}

import { desc, eq } from "drizzle-orm";
import type { DB } from "../../../db/client";
import { products } from "../../../db/schemas/product.schema";
import { NotFoundError } from "../../../shared/errors";
import {
  DEFAULT_PRODUCT_STATUS,
  type CreateProductDTO,
  type Product,
  type ProductRepository,
  type UpdateProductDTO,
} from "../core/product.entities";

type Row = typeof products.$inferSelect;
type InsertValues = typeof products.$inferInsert;

// Argent : la colonne numeric remonte/attend une `string` via Drizzle.
// On convertit aux frontières (cf. décision « money as strings »).
const toNumber = (value: string | null): number | null =>
  value !== null ? Number(value) : null;
const toMoney = (value: number | null | undefined): string | null =>
  value === null || value === undefined ? null : String(value);

function toEntity(row: Row): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    sellingPrice: toNumber(row.sellingPrice),
    costPrice: toNumber(row.costPrice),
    status: row.status as Product["status"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ProductPostgresRepository implements ProductRepository {
  constructor(private readonly db: DB) {}

  async findAll(): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .orderBy(desc(products.createdAt));
    return rows.map(toEntity);
  }

  async findById(id: string): Promise<Product | null> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id))
      .limit(1);
    return row ? toEntity(row) : null;
  }

  async create(product: CreateProductDTO): Promise<Product> {
    const [row] = await this.db
      .insert(products)
      .values({
        name: product.name,
        description: product.description ?? null,
        sellingPrice: toMoney(product.sellingPrice),
        costPrice: toMoney(product.costPrice),
        status: product.status ?? DEFAULT_PRODUCT_STATUS,
      })
      .returning();
    if (!row) throw new Error("Insertion produit : aucune ligne retournée.");
    return toEntity(row);
  }

  async update(id: string, updates: UpdateProductDTO): Promise<Product> {
    // Ne pose dans le SET que les champs réellement fournis.
    const values: Partial<InsertValues> = {};
    if (updates.name !== undefined) values.name = updates.name;
    if (updates.description !== undefined)
      values.description = updates.description ?? null;
    if (updates.sellingPrice !== undefined)
      values.sellingPrice = toMoney(updates.sellingPrice);
    if (updates.costPrice !== undefined)
      values.costPrice = toMoney(updates.costPrice);
    if (updates.status !== undefined) values.status = updates.status;

    // Rien à modifier : on renvoie l'état courant (404 si absent).
    if (Object.keys(values).length === 0) {
      const current = await this.findById(id);
      if (!current) throw new NotFoundError(`Produit introuvable : ${id}`);
      return current;
    }

    const [row] = await this.db
      .update(products)
      .set(values)
      .where(eq(products.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Produit introuvable : ${id}`);
    return toEntity(row);
  }

  async archive(id: string): Promise<Product> {
    const [row] = await this.db
      .update(products)
      .set({ status: "archived" })
      .where(eq(products.id, id))
      .returning();
    if (!row) throw new NotFoundError(`Produit introuvable : ${id}`);
    return toEntity(row);
  }
}

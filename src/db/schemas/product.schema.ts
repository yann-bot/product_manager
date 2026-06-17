import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { DEFAULT_PRODUCT_STATUS } from "../../modules/catalog/product/core/product.entities";

//
// ======================================================
// PRODUCTS  (module: product)
// ======================================================
// Catalogue produit interne. Contrairement à `easysell_orders`
// (staging brut), c'est une vraie table métier : contraintes
// fortes et valeurs par défaut.
//
// Le statut par défaut vient de DEFAULT_PRODUCT_STATUS (core)
// pour rester aligné avec le DTO/service : une seule source de
// vérité. Ré-exporté par le barrel `src/db/schema.ts`.
// ======================================================
//

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Argent : numeric(12,2) (FCFA), nullable. Remonte en `string`
  // via Drizzle ; l'adaptateur outbound convertit en `number`.
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }),
  // Coût de revient PAR DÉFAUT (repli) — pas le prix d'achat de référence,
  // qui vit par lot sur stock_movements.unit_cost (rejeu FIFO, module costing).
  // Propriété renommée `defaultCostPrice` ; la colonne reste `cost_price`
  // (renommage de colonne volontairement évité pour ne pas migrer la prod).
  defaultCostPrice: numeric("cost_price", { precision: 12, scale: 2 }),

  // "active" | "archived" — VARCHAR (pas un enum pg) pour rester
  // souple. Défaut DB = filet de sécurité aligné sur le service.
  status: varchar("status", { length: 20 })
    .notNull()
    .default(DEFAULT_PRODUCT_STATUS),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

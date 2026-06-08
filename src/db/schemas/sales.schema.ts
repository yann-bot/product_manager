import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { DEFAULT_SALE_STATUS } from "../../modules/sales/core/sales.entities";
import { products } from "./product.schema";
import { easysellSales } from "./easysell-sale.schema";

//
// ======================================================
// SALES  (module: sales)
// ======================================================
// Ventes internes saisies par le marchand. Vraie table métier
// (contraintes fortes), comme `products` et contrairement au staging
// brut `easysell_orders`.
//
// MVP mono-produit : une vente référence UN produit + une quantité
// (pas de table de lignes). `unit_price` est un snapshot du prix de
// vente produit au moment de la vente (RM-03) ; `total_amount` =
// quantity × unit_price (RM-04/RM-05).
//
// Statut par défaut = DEFAULT_SALE_STATUS (core) pour rester aligné
// avec le DTO/service. Ré-exporté par le barrel `src/db/schema.ts`.
// ======================================================
//

export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),

  // FK vers le catalogue produit. Les produits sont archivés, jamais
  // supprimés (RM-04 du module Produit) : la référence reste stable.
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),

  quantity: integer("quantity").notNull(),

  // Argent : numeric(12,2) (FCFA). Remonte en `string` via Drizzle ;
  // l'adaptateur outbound convertit en `number`. NOT NULL : toute
  // vente a un prix et un total calculés (≠ produits, où c'est nullable).
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),

  // "completed" | "cancelled" — VARCHAR (pas un enum pg) pour rester
  // souple. Défaut DB = filet de sécurité aligné sur le service.
  status: varchar("status", { length: 20 })
    .notNull()
    .default(DEFAULT_SALE_STATUS),

  notes: text("notes"),

  // Provenance : vente issue de la réconciliation d'une vente EasySell.
  // NULL pour une vente saisie manuellement. UNIQUE (un easysell_sales ne
  // donne qu'UNE vente interne) => idempotence de la réconciliation/backfill.
  // Postgres autorise plusieurs NULL sous une contrainte unique.
  easysellSaleId: uuid("easysell_sale_id")
    .references(() => easysellSales.id)
    .unique(),

  // Date commerciale de la vente (≠ created_at technique). Défaut now().
  saleDate: timestamp("sale_date").defaultNow().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

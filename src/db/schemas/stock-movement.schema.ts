import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./product.schema";
import { sales } from "./sales.schema";
import { easysellSales } from "./easysell-sale.schema";

//
// ======================================================
// STOCK MOVEMENTS  (module: stock)
// ======================================================
// Journal des mouvements de stock — UNIQUE source de vérité du stock.
// Le niveau de stock d'un produit n'est PAS stocké : il se calcule à la
// lecture = SUM(quantity) (même philosophie que l'Analytics). Donc aucune
// dérive possible.
//
// `quantity` est un DELTA SIGNÉ :
//   - in         : +q  (réapprovisionnement)
//   - out        : −q  (vente, perte, casse)
//   - adjustment : cible − stock courant (correction d'inventaire, ±)
// => stock(produit) = SUM(quantity).
//
// `sale_id` (nullable) trace les mouvements générés automatiquement par
// une vente (sortie à la création, entrée compensatoire à l'annulation).
//
// Un fichier de schéma = un sujet. Ré-exporté par le barrel `db/schema.ts`.
// ======================================================
//

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),

  // "in" | "out" | "adjustment" — VARCHAR souple (pas un enum pg), aligné
  // sur MOVEMENT_TYPES (core). Toujours fourni, donc pas de défaut.
  type: varchar("type", { length: 20 }).notNull(),

  // Delta signé (cf. en-tête). SUM(quantity) = stock courant.
  quantity: integer("quantity").notNull(),

  // Prix de revient unitaire du LOT (FCFA, numeric(12,2) -> string via Drizzle).
  // Renseigné sur les mouvements de DISPONIBILITÉ (entrée 'in' = réappro, ou
  // entrée compensatoire d'annulation) ; NULL sur la consommation pure ('out').
  // C'est le coût FIGÉ du lot : le module costing le rejoue en FIFO pour valoriser
  // les ventes (cf. `modules/costing`). Le prix de VENTE, lui, vit sur le produit.
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),

  note: text("note"),

  // Mouvement issu d'une vente interne (sortie auto / entrée d'annulation).
  // NULL pour les mouvements manuels.
  saleId: uuid("sale_id").references(() => sales.id),

  // Mouvement issu d'une vente EasySell réconciliée (sortie). NULL sinon.
  // Une source au plus : `sale_id` OU `easysell_sale_id` (ou aucune = manuel).
  easysellSaleId: uuid("easysell_sale_id").references(() => easysellSales.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

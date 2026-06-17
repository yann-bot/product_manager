import {
  pgTable,
  uuid,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { sales } from "./sales.schema";
import { stockMovements } from "./stock-movement.schema";

//
// ======================================================
// SALE LOT ALLOCATIONS  (module: costing)
// ======================================================
// Ventilation FIGÉE d'une vente sur les lots qu'elle a consommés (snapshot
// FIFO au moment de la vente). Une vente = une ou plusieurs lignes ici :
//   « 20 unités du lot Mai @1750, 30 unités du lot Juin @2250 ».
//
// IMMUABLE : écrite une fois par le snapshot, jamais modifiée par le recalcul
// (qui n'écrit que `sales.cogs_recalculated`). C'est la pièce comptable de la
// marge et le point d'ancrage d'une future répartition par investisseur.
//
// `lot_movement_id` NULL = part À DÉCOUVERT (non couverte par un lot réel),
// cotée au coût provisoire `unit_cost` (dernier coût connu / repli produit).
//
// Invariant : pour une vente, SUM(quantity) = quantité vendue ; et
// SUM(quantity × unit_cost) = sales.cogs (snapshot).
//
// Un fichier de schéma = un sujet. Ré-exporté par le barrel `db/schema.ts`.
// ======================================================
//

export const saleLotAllocations = pgTable("sale_lot_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),

  saleId: uuid("sale_id")
    .notNull()
    .references(() => sales.id),

  // Lot consommé = le mouvement de DISPONIBILITÉ ('in') imputé. NULL pour la
  // part à découvert (cotée provisoirement, régularisée au recalcul suivant).
  lotMovementId: uuid("lot_movement_id").references(() => stockMovements.id),

  quantity: integer("quantity").notNull(),

  // Coût unitaire imputé (FCFA) : coût figé du lot, ou coût provisoire si à
  // découvert. numeric(12,2) -> string via Drizzle.
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

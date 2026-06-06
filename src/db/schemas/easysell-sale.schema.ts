import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { products } from "./product.schema";

//
// ======================================================
// EASYSELL SALES  (sujet : réconciliation EasySell -> catalogue interne)
// ======================================================
// Pont entre les commandes EasySell brutes (`easysell_orders`, staging)
// et le catalogue produit interne (`products`). Chaque commande externe
// peut donner une `easysell_sales` à RÉCONCILIER MANUELLEMENT : relier le
// nom de produit EasySell (texte libre) à un vrai `products.id`.
//
// Flux (cf. Excalidraw « Drawing 2026-06-06 09.30.15 ») :
//   ExternalOrder (easysell_orders)
//     -> EasySellSale  (réconciliation manuelle)
//        -> Product -> Stock (futur)
//
// `easysell_product_mappings` mémorise les correspondances nom -> produit
// déjà tranchées, pour automatiser les réconciliations suivantes.
//
// Données volontairement TOLÉRANTES (quantité/prix/date nullables) : la
// source EasySell est souvent incomplète ; la réconciliation manuelle
// complète/valide ensuite.
//
// Un fichier de schéma = un sujet. Ré-exporté par le barrel `db/schema.ts`.
// ======================================================
//

// Statut de réconciliation par défaut à l'import (pas encore relié à un
// produit). Source unique de vérité ; à déplacer en `core` le jour où un
// module EasySellSale sera créé (cf. DEFAULT_PRODUCT_STATUS / DEFAULT_SALE_STATUS).
export const DEFAULT_RECONCILIATION_STATUS = "pending";

export const easysellSales = pgTable("easysell_sales", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Commande EasySell source. Lien SOUPLE (pas de FK) : la clé naturelle
  // de `easysell_orders` est composite (sheet_id, external_order_id), donc
  // non référençable par cette seule colonne.
  externalOrderId: varchar("external_order_id", { length: 100 }).notNull(),

  // Nom de produit EasySell (texte libre, snapshot au moment de l'import).
  // Sert de clé de réconciliation (-> easysell_product_mappings / products).
  productName: varchar("product_name", { length: 255 }).notNull(),

  // Bloc montants : nullable (source EasySell incomplète ; la réconciliation
  // complète). Argent en numeric(12,2) (FCFA), remonte en `string` via Drizzle.
  quantity: integer("quantity"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
  totalPrice: numeric("total_price", { precision: 12, scale: 2 }),

  saleDate: timestamp("sale_date"),

  // "pending" | "reconciled" (+ valeurs futures). VARCHAR souple ; défaut DB
  // aligné sur DEFAULT_RECONCILIATION_STATUS.
  reconciliationStatus: varchar("reconciliation_status", { length: 20 })
    .notNull()
    .default(DEFAULT_RECONCILIATION_STATUS),

  // Produit interne réconcilié. NULL tant que la réconciliation n'est pas
  // faite (statut "pending").
  productId: uuid("product_id").references(() => products.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const easysellProductMappings = pgTable("easysell_product_mappings", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Nom de produit EasySell -> produit interne. UNIQUE : un nom EasySell ne
  // mappe que vers un seul produit (clé de lookup de la réconciliation).
  easySellProductName: varchar("easysell_product_name", { length: 255 })
    .notNull()
    .unique(),

  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

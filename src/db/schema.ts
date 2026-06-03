import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

//
// ======================================================
// EASYSELL ORDERS
// ======================================================
// Données brutes importées depuis le Google Sheet EasySell.
// Zone de staging pure : aucune contrainte forte, aucune
// logique métier. On garde la donnée telle qu'elle arrive
// (souvent incomplète, dans des formats qu'on ne contrôle
// pas) pour l'afficher « tel quel » sur le dashboard.
//
// Clé naturelle (sheet_id, external_order_id) : une commande =
// une ligne dans le Sheet. Cette contrainte unique permet au sync
// de faire un UPSERT, donc de répercuter les changements faits dans
// le Sheet (statut, client, prix…) et pas seulement les nouvelles
// commandes.
// ======================================================
//

export const easysellOrders = pgTable("easysell_orders", {
  id: uuid("id").defaultRandom().primaryKey(),

  // Google Sheet (spreadsheetId) d'où provient la ligne. Permet de
  // rattacher chaque enregistrement à sa source quand plusieurs Sheets
  // sont configurés au fil du temps.
  sheetId: varchar("sheet_id", { length: 255 }).notNull(),

  externalOrderId: varchar("external_order_id", {
    length: 100,
  }).notNull(),

  dateHeure: timestamp("date_heure"),

  // Bloc client (brut)
  nomComplet: varchar("nom_complet", { length: 255 }),
  telephone: varchar("telephone", { length: 50 }),
  adresse: text("adresse"),
  noteClient: text("note_client"),

  // Bloc produit (brut)
  nomProduit: varchar("nom_produit", { length: 255 }),
  prixUnitaire: numeric("prix_unitaire", {
    precision: 12,
    scale: 2,
  }),
  quantite: integer("quantite"),
  prixTotal: numeric("prix_total", {
    precision: 12,
    scale: 2,
  }),

  // Bloc commande (brut)
  status: varchar("status", { length: 50 }),
  note: text("note"),

  syncedAt: timestamp("synced_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Clé naturelle d'une commande, cible du upsert au sync.
  unique("easysell_orders_sheet_order_uniq").on(
    table.sheetId,
    table.externalOrderId,
  ),
]);

//
// ======================================================
// APP SETTINGS
// ======================================================
// Réglages applicatifs en clé/valeur, configurables depuis
// l'interface. Ex : google_sheet_id / google_sheet_url
// (la source Google Sheet n'est pas figée dans le .env).
// ======================================================
//

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),

  value: text("value").notNull(),

  updatedAt: timestamp("updated_at")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

//
// ======================================================
// FLUX V1
// ======================================================
//
// Google Sheet
//   → lecture des lignes (CRON 1 / sync)
//   → stockage brut dans easysell_orders
//   → affichage « tel quel » sur le dashboard
//
// Aucune logique métier interne (produits, ventes, stock)
// n'est branchée sur ce flux en V1.
// ======================================================
//

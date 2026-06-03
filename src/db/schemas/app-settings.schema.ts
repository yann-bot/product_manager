import { pgTable, varchar, text, timestamp } from "drizzle-orm/pg-core";

//
// ======================================================
// APP SETTINGS  (transverse / shared)
// ======================================================
// Réglages applicatifs en clé/valeur, configurables depuis
// l'interface. Ex : google_sheet_id / google_sheet_url
// (la source Google Sheet n'est pas figée dans le .env).
//
// Table transverse : ne dépend d'aucun module métier.
// Ré-exportée par le barrel `src/db/schema.ts`.
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

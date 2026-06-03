//
// ======================================================
// SCHÉMA AGRÉGÉ (barrel)
// ======================================================
// Drizzle a besoin d'UN seul point d'entrée pour connaître
// toutes les tables : `drizzle.config.ts` (génération des
// migrations) et `db/client.ts` (`drizzle(..., { schema })`)
// pointent ici.
//
// RÈGLE DE SÉPARATION : ce fichier ne DÉFINIT aucune table.
// Tous les schémas sont centralisés dans `src/db/schemas/`,
// un fichier par module/sujet, jamais mélangés. Pour ajouter
// une table : créer/éditer `src/db/schemas/<sujet>.schema.ts`
// puis le ré-exporter ci-dessous.
// ======================================================
//

export * from "./schemas/easysell-order.schema";
export * from "./schemas/app-settings.schema";
export * from "./schemas/product.schema";

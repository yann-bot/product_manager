// src/script/recalculate-cogs.ts
//
// Lancement manuel du recalcul auditable des COGS : rejoue le journal de
// stock complet, par produit, et met à jour `sales.cogs_recalculated`.
// L'écart avec le snapshot (`sales.cogs`) révèle les ventes faites à
// découvert puis régularisées. Idempotent. Même logique que la route
// POST /costing/recalculate.

import "dotenv/config";
import { db } from "../db/client";
import { CostingService } from "../modules/valuation/costing/core/costing.service";
import { CostingPostgresRepository } from "../modules/valuation/costing/outbound/costing.postgres";

async function main() {
  const costing = new CostingService(new CostingPostgresRepository(db));
  const r = await costing.recalculateAll();
  console.log(
    `Recalcul COGS : ${r.salesUpdated} vente(s) revalorisée(s) ` +
      `sur ${r.products} produit(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

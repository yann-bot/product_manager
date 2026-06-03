// src/script/import-external-orders.ts
//
// Lancement manuel du CRON 1 (Google Sheet -> easysell_orders).
// La logique vit dans EasySellSyncService (partagée avec le cron).

import "dotenv/config";
import { EasySellSyncService } from "../modules/easysell-order/core/sync.service";

async function main() {
  const r = await new EasySellSyncService().sync();
  console.log(
    `${r.upserted} commande(s) synchronisée(s) (insérées ou mises à jour) dans easysell_orders, ${r.skipped} ligne(s) ignorée(s).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

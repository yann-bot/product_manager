import cron from "node-cron";
import { db } from "../db/client";
import { EasySellSyncService } from "../modules/easysell/core/sync.service";
import { EasySellSaleImportService } from "../modules/easysell-sale/core/import-sales.service";
import { StockService } from "../modules/stock/core/stock.service";
import { StockPostgresRepository } from "../modules/stock/outbound/stock.postgres";
import { ProductPostgresRepository } from "../modules/product/outbound/product.postgres";
import { SalesService } from "../modules/sales/core/sales.service";
import { SalesPostgresRepository } from "../modules/sales/outbound/sales.postgres";

//
// ======================================================
// COUCHE D'AUTOMATISATION — pipeline EasySell (1 min)
// ======================================================
// CRON 1 : Google Sheet -> easysell_orders (sync brut)
// CRON 2 : easysell_orders -> easysell_sales (import des ventes livrées)
//
// Les deux étapes sont CHAÎNÉES dans un même job : l'import tourne juste
// après le sync, donc sur des données fraîches, et partage le verrou
// anti-chevauchement (pas de course entre l'écriture du sync et la
// lecture de l'import).
//
// Désactivable via DISABLE_CRONS=true (utile en dev / scripts manuels).
// ======================================================
//

/** Enveloppe un job : log + capture d'erreur + verrou anti-chevauchement. */
function guarded(label: string, job: () => Promise<string>) {
  let running = false;
  return async () => {
    if (running) {
      console.warn(`[${label}] run précédent encore en cours — skip`);
      return;
    }
    running = true;
    try {
      console.log(`[${label}] ${await job()}`);
    } catch (err) {
      console.error(`[${label} ERROR]`, err);
    } finally {
      running = false;
    }
  };
}

export function startCrons(): void {
  if (process.env.DISABLE_CRONS === "true") {
    console.log("⏸️  Crons désactivés (DISABLE_CRONS=true)");
    return;
  }

  const sync = new EasySellSyncService();
  const productRepo = new ProductPostgresRepository(db);
  const stockService = new StockService(new StockPostgresRepository(db), productRepo);
  const salesService = new SalesService(
    new SalesPostgresRepository(db),
    productRepo,
    stockService,
  );
  const importSales = new EasySellSaleImportService(salesService);

  // Pipeline (toutes les minutes) : sync Sheet -> easysell_orders, puis
  // import easysell_orders -> easysell_sales (sur données fraîches).
  cron.schedule(
    "* * * * *",
    guarded("PIPELINE", async () => {
      const s = await sync.sync();
      const i = await importSales.import();
      return (
        `sync upserted=${s.upserted} skipped=${s.skipped} | ` +
        `import imported=${i.imported} (reconciled=${i.reconciled}, pending=${i.pending}) ` +
        `skippedExisting=${i.skippedExisting} skippedNotDelivered=${i.skippedNotDelivered}`
      );
    }),
  );

  console.log("⏱️  Cron démarré — PIPELINE sync→import (* * * * *)");
}

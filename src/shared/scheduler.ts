import cron from "node-cron";
import { EasySellSyncService } from "../modules/easysell-order/core/sync.service";

//
// ======================================================
// COUCHE D'AUTOMATISATION — 1 cron
// ======================================================
// CRON 1 (1 min) : Google Sheet -> easysell_orders (sync brut)
//
// V1 : ingestion brute uniquement, aucun traitement métier en aval.
//
// Désactivable via DISABLE_CRONS=true (utile en dev / scripts manuels).
// Garde anti-chevauchement : un job ne se relance pas s'il tourne encore.
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

  // CRON 1 : import depuis Google Sheet -> easysell_orders (toutes les minutes).
  cron.schedule(
    "* * * * *",
    guarded("SYNC", async () => {
      const r = await sync.sync();
      return `upserted=${r.upserted} skipped=${r.skipped}`;
    }),
  );

  console.log("⏱️  Cron démarré — SYNC (* * * * *)");
}

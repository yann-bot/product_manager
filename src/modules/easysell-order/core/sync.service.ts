import { sql } from "drizzle-orm";
import { sheets } from "../../../lib/google-sheet";
import { db } from "../../../db/client";
import { easysellOrders } from "../../../db/schema";
import { getSheetId } from "../../../shared/settings";

//
// ======================================================
// CRON 1 : Google Sheet -> easysell_orders
// ======================================================
// Lit le Google Sheet (EasySell) et insère les lignes brutes dans la
// table de staging `easysell_orders` (aucune logique métier ici, aucun
// lien avec un produit/vente interne).
//
// On garde la donnée telle qu'elle arrive : pas de valeur par défaut
// imposée (quantité/prix/statut restent nuls si absents ou invalides).
//
// UPSERT sur la clé (sheet_id, external_order_id) : une commande déjà
// importée est RÉACTUALISÉE depuis le Sheet (statut, client, prix…),
// pas seulement les nouvelles. Le Sheet est la source de vérité.
// Les doublons à l'intérieur d'un même lot sont dédoublonnés (la
// dernière occurrence l'emporte) pour éviter un double conflit Postgres.
// ======================================================
//

// Index des colonnes dans le Sheet.
const COL = {
  date: 0,
  orderId: 1,
  customerName: 2,
  phone: 3,
  address: 4,
  noteClient: 5,
  productName: 6,
  unitPrice: 7,
  quantity: 8,
  totalAmount: 9,
  status: 10,
} as const;

// Lignes mal alignées : la colonne produit contient du bruit.
const NOISE_PRODUCTS = new Set(["Dimanche", "Vendredi 22 mai 2026"]);

const cell = (row: string[], i: number): string => (row[i] ?? "").trim();

// "2026-03-24 18:07:23" -> Date ; vide/invalide -> null.
function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Argent en string (jamais de Number, pour éviter la dérive flottante).
// Vide -> null : on n'invente pas de "0".
function money(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, "");
  return cleaned === "" ? null : cleaned;
}

// Quantité brute : null si absente ou invalide (on ne force plus à 1).
function quantity(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "");
  if (cleaned === "") return null;
  const n = parseInt(cleaned, 10);
  return Number.isNaN(n) ? null : n;
}

export interface SyncResult {
  /** Lignes insérées ou mises à jour (upsert). */
  upserted: number;
  /** Lignes ignorées (inexploitables ou bruit). */
  skipped: number;
}

export class EasySellSyncService {
  async sync(): Promise<SyncResult> {
    const spreadsheetId = await getSheetId();
    if (!spreadsheetId) {
      throw new Error(
        "Aucun Google Sheet configuré (via l'interface ou GOOGLE_SHEET_ID).",
      );
    }

    const { data } = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "A:Z",
    });
    const rows = data.values ?? [];

    // Dédoublonnage intra-lot par external_order_id : la dernière
    // occurrence l'emporte (on ne peut pas viser deux fois la même
    // ligne dans un seul ON CONFLICT). Map ordonnée = ordre du Sheet.
    const byOrderId = new Map<string, typeof easysellOrders.$inferInsert>();
    let skipped = 0;

    for (const row of rows.slice(1)) {
      const orderId = cell(row, COL.orderId);
      const productName = cell(row, COL.productName);

      // Lignes inexploitables : pas d'identifiant ou pas de produit.
      if (!orderId || !productName) {
        if (row.length > 0) skipped++;
        continue;
      }
      if (NOISE_PRODUCTS.has(productName)) {
        skipped++;
        continue;
      }

      byOrderId.set(orderId, {
        sheetId: spreadsheetId,
        externalOrderId: orderId,
        dateHeure: parseDate(cell(row, COL.date)),
        nomComplet: cell(row, COL.customerName) || null,
        telephone: cell(row, COL.phone) || null,
        adresse: cell(row, COL.address) || null,
        noteClient: cell(row, COL.noteClient) || null,
        nomProduit: productName,
        prixUnitaire: money(cell(row, COL.unitPrice)),
        quantite: quantity(cell(row, COL.quantity)),
        prixTotal: money(cell(row, COL.totalAmount)),
        status: cell(row, COL.status) || null,
        syncedAt: new Date(),
      });
    }

    const toUpsert = [...byOrderId.values()];

    if (toUpsert.length > 0) {
      // UPSERT : insère les nouvelles commandes, réactualise les
      // existantes depuis le Sheet (statut, client, prix…). createdAt
      // n'est pas touché ; syncedAt repasse à "maintenant".
      await db
        .insert(easysellOrders)
        .values(toUpsert)
        .onConflictDoUpdate({
          target: [easysellOrders.sheetId, easysellOrders.externalOrderId],
          set: {
            dateHeure: sql`excluded.date_heure`,
            nomComplet: sql`excluded.nom_complet`,
            telephone: sql`excluded.telephone`,
            adresse: sql`excluded.adresse`,
            noteClient: sql`excluded.note_client`,
            nomProduit: sql`excluded.nom_produit`,
            prixUnitaire: sql`excluded.prix_unitaire`,
            quantite: sql`excluded.quantite`,
            prixTotal: sql`excluded.prix_total`,
            status: sql`excluded.status`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    return { upserted: toUpsert.length, skipped };
  }
}

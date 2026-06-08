import { sql } from "drizzle-orm";
import { sheets } from "../../../lib/google-sheet";
import { db } from "../../../db/client";
import { easysellOrders } from "../../../db/schemas/easysell-order.schema";
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

// Colonnes du Sheet EasySell — début TOUJOURS stable.
const COL = {
  date: 0,
  orderId: 1,
  customerName: 2,
  phone: 3,
} as const;

const cell = (row: string[], i: number): string => (row[i] ?? "").trim();

const isNumericCell = (raw: string): boolean =>
  raw !== "" && /^\d+([.,]\d+)?$/.test(raw.replace(/\s/g, ""));

// Le Sheet n'est PAS régulier ligne par ligne. La plupart des lignes ont
// une colonne vide "spacer" sans en-tête en index 4 (présente aussi dans
// l'en-tête : DATE, N°, NOM, TEL, "", ADRESSE, NOTE CLIENT, PRODUIT…),
// mais certaines lignes l'omettent et décalent le bloc ADRESSE..TOTAL d'un
// cran à gauche. On détecte le cas PAR LIGNE : en layout normal l'index 7
// est le NOM DU PRODUIT (texte) ; sans le spacer, l'index 7 est le PRIX
// UNITAIRE (numérique).
//
// ATTENTION : seul le bloc adresse..total se décale. EasySell écrit le
// STATUT et la NOTE dans des colonnes FIXES (11 et 12) ; sur une ligne
// décalée, le total tombe en 9 et un TROU apparaît en 10, mais le statut
// reste en 11. Décaler le statut le ferait lire sur la colonne vide (→ null
// → livraison perdue, bug constaté). Donc statut/note sont ANCRÉS.
function resolveCols(row: string[]) {
  const shift = isNumericCell(cell(row, 7)) ? -1 : 0;
  return {
    address: 5 + shift,
    noteClient: 6 + shift,
    productName: 7 + shift,
    unitPrice: 8 + shift,
    quantity: 9 + shift,
    totalAmount: 10 + shift,
    status: 11,
    note: 12,
  };
}

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
      const col = resolveCols(row);
      const productName = cell(row, col.productName);

      // Lignes inexploitables : pas d'identifiant ou pas de produit.
      if (!orderId || !productName) {
        if (row.length > 0) skipped++;
        continue;
      }

      byOrderId.set(orderId, {
        sheetId: spreadsheetId,
        externalOrderId: orderId,
        dateHeure: parseDate(cell(row, COL.date)),
        nomComplet: cell(row, COL.customerName) || null,
        telephone: cell(row, COL.phone) || null,
        adresse: cell(row, col.address) || null,
        noteClient: cell(row, col.noteClient) || null,
        nomProduit: productName,
        prixUnitaire: money(cell(row, col.unitPrice)),
        quantite: quantity(cell(row, col.quantity)),
        prixTotal: money(cell(row, col.totalAmount)),
        status: cell(row, col.status) || null,
        note: cell(row, col.note) || null,
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
            note: sql`excluded.note`,
            syncedAt: sql`excluded.synced_at`,
          },
        });
    }

    return { upserted: toUpsert.length, skipped };
  }
}

import { sql } from "drizzle-orm";
import { sheets } from "../../../../lib/google-sheet";
import { db } from "../../../../db/client";
import { easysellOrders } from "../../../../db/schemas/easysell-order.schema";
import { getEnabledSheetIds } from "../../../../shared/settings";

//
// ======================================================
// CRON 1 : Google Sheet(s) -> easysell_orders
// ======================================================
// Lit chaque Google Sheet EasySell ACTIVÉ et insère les lignes brutes
// dans la table de staging `easysell_orders` (aucune logique métier ici,
// aucun lien avec un produit/vente interne). Plusieurs Sheets peuvent être
// synchronisés à la fois ; un Sheet en échec n'interrompt pas les autres.
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

export interface ResolvedCols {
  address: number;
  noteClient: number;
  productName: number;
  unitPrice: number;
  quantity: number;
  totalAmount: number;
  status: number;
  note: number;
}

// Le Sheet EasySell n'a PAS une disposition fixe : selon le Sheet et la
// ligne, les colonnes optionnelles ADRESSE / NOTE CLIENT et STATUS / NOTE
// sont présentes ou absentes, et une ligne décalée peut laisser un trou.
// Se caler sur des index fixes était la cause d'un double bug en prod :
// le PRIX TOTAL tombait dans `quantite` (total des quantités absurde) et
// le STATUT était lu sur la mauvaise colonne (livraisons perdues).
//
// On n'utilise donc plus d'index fixes pour le bloc produit. Seul le
// début est stable (date=0, N°=1, nom=2, tél=3). On localise ensuite le
// BLOC NUMÉRIQUE prix/quantité : le NOM DU PRODUIT est la cellule TEXTE
// juste avant le PRIX UNITAIRE ; PRIX/QUANTITÉ sont deux cellules
// numériques consécutives ; le STATUT et la NOTE sont les cellules texte
// après le TOTAL (un éventuel trou laissé par une colonne décalée est
// ignoré). `cell(row, -1)` renvoie "" : un index -1 = colonne absente.
export function resolveCols(row: string[]): ResolvedCols | null {
  // PRIX UNITAIRE = 1re position p (>=5, donc p-1>=4, jamais le tél en 3)
  // telle que cell(p) ET cell(p+1) (=QUANTITÉ) soient numériques et
  // cell(p-1) (=PRODUIT) un texte non vide non numérique.
  let p = -1;
  for (let i = 5; i < row.length - 1; i++) {
    const prev = cell(row, i - 1);
    if (
      prev !== "" &&
      !isNumericCell(prev) &&
      isNumericCell(cell(row, i)) &&
      isNumericCell(cell(row, i + 1))
    ) {
      p = i;
      break;
    }
  }

  // Aucun bloc numérique repérable : ligne inexploitable.
  if (p === -1) return null;

  const productName = p - 1;

  // STATUT / NOTE = 1re et 2e cellules NON VIDES après le TOTAL (p+2),
  // en sautant un éventuel trou. On ne lit jamais le total lui-même.
  let status = -1;
  let note = -1;
  for (let i = p + 3; i < row.length; i++) {
    if (cell(row, i) === "") continue;
    if (status === -1) status = i;
    else {
      note = i;
      break;
    }
  }

  return {
    // ADRESSE / NOTE CLIENT = les (au plus deux) cellules entre le tél et
    // le produit : index 4 puis 5 si le produit est assez à droite.
    address: productName > 4 ? 4 : -1,
    noteClient: productName > 5 ? 5 : -1,
    productName,
    unitPrice: p,
    quantity: p + 1,
    totalAmount: p + 2,
    status,
    note,
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
  /** Lignes insérées ou mises à jour (upsert), tous Sheets confondus. */
  upserted: number;
  /** Lignes ignorées (inexploitables ou bruit), tous Sheets confondus. */
  skipped: number;
  /** Nombre de Sheets synchronisés avec succès. */
  sheetsSynced: number;
  /** Nombre de Sheets en échec (accès révoqué, etc.) — n'interrompt pas. */
  sheetsFailed: number;
}

// PostgreSQL borne le nombre de paramètres d'une requête à 65535 (Int16
// du protocole wire). Chaque ligne consomme 14 paramètres (id/created_at
// sont `default`), soit ~4681 lignes max par INSERT. On découpe donc le
// lot en tranches très en dessous de cette limite : sans découpage, le
// cron casse dès que le Sheet dépasse ~4681 commandes (bug constaté en
// prod). 1000 lignes/tranche = 14000 paramètres, large marge de sécurité.
const UPSERT_CHUNK_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class EasySellSyncService {
  /**
   * Synchronise TOUS les Sheets activés (multi-Sheet). Chaque Sheet est
   * synchronisé indépendamment : un Sheet en échec (accès révoqué, Sheet
   * supprimé…) est journalisé et n'interrompt pas les autres.
   */
  async sync(): Promise<SyncResult> {
    const spreadsheetIds = await getEnabledSheetIds();
    if (spreadsheetIds.length === 0) {
      throw new Error(
        "Aucun Google Sheet activé (via l'interface ou GOOGLE_SHEET_ID).",
      );
    }

    const result: SyncResult = {
      upserted: 0,
      skipped: 0,
      sheetsSynced: 0,
      sheetsFailed: 0,
    };

    for (const spreadsheetId of spreadsheetIds) {
      try {
        const { upserted, skipped } = await this.syncOne(spreadsheetId);
        result.upserted += upserted;
        result.skipped += skipped;
        result.sheetsSynced++;
      } catch (err) {
        result.sheetsFailed++;
        console.error(`[SYNC ERROR] Sheet ${spreadsheetId} ignoré :`, err);
      }
    }

    return result;
  }

  /** Synchronise un seul Sheet vers `easysell_orders` (logique d'origine). */
  private async syncOne(
    spreadsheetId: string,
  ): Promise<{ upserted: number; skipped: number }> {
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
      const productName = col ? cell(row, col.productName) : "";

      // Lignes inexploitables : pas d'identifiant, pas de bloc numérique
      // repérable (col === null) ou pas de nom de produit.
      if (!orderId || !col || !productName) {
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
      //
      // Découpage en tranches (voir UPSERT_CHUNK_SIZE) pour ne jamais
      // dépasser la limite de 65535 paramètres de Postgres. Le tout dans
      // une transaction : l'upsert reste atomique (tout ou rien).
      await db.transaction(async (tx) => {
        for (const batch of chunk(toUpsert, UPSERT_CHUNK_SIZE)) {
          await tx
            .insert(easysellOrders)
            .values(batch)
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
      });
    }

    return { upserted: toUpsert.length, skipped };
  }
}

import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { appSettings } from "../db/schemas/app-settings.schema";

//
// Réglages applicatifs (clé/valeur en base), configurables depuis l'UI.
//
// --- Multi-Sheet ---------------------------------------------------------
// Chaque Google Sheet connu est décrit par un trio de clés préfixées :
//   sheet_name:<id>     -> titre lisible
//   sheet_url:<id>      -> lien d'origine collé (optionnel)
//   sheet_disabled:<id> -> "1" si le Sheet est désactivé (absente = activé)
// Le cron d'ingestion synchronise TOUS les Sheets activés. On peut donc
// ajouter plusieurs Sheets et activer/désactiver chacun indépendamment ;
// il n'y a plus de notion de « Sheet actif unique ».
//

// Anciennes clés (mono-Sheet) — conservées pour la migration ascendante.
export const SHEET_ID_KEY = "google_sheet_id";
export const SHEET_URL_KEY = "google_sheet_url";

export const SHEET_NAME_PREFIX = "sheet_name:";
export const SHEET_URL_PREFIX = "sheet_url:";
export const SHEET_DISABLED_PREFIX = "sheet_disabled:";

// Drapeau de migration mono-Sheet -> multi-Sheet (voir ensureMigrated).
const MIGRATED_KEY = "sheets_migrated_v2";

/** Un Google Sheet configuré et son état d'activation. */
export interface SheetConfig {
  id: string;
  title: string;
  url: string | null;
  enabled: boolean;
}

/** Libellé court d'un sheetId brut, pour l'affichage faute de titre connu. */
export function shortSheetId(id: string): string {
  return id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

/**
 * Extrait l'ID d'un Google Sheet depuis un lien collé par l'utilisateur.
 * Gère :
 *   - https://docs.google.com/spreadsheets/d/<ID>/edit#gid=0
 *   - ...?id=<ID>
 *   - un ID brut collé directement
 * Renvoie null si rien d'exploitable.
 */
export function extractSheetId(input: string): string | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  // Forme canonique /spreadsheets/d/<ID>
  const path = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (path?.[1]) return path[1];

  // Paramètre ?id=<ID> ou &id=<ID>
  const param = s.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (param?.[1]) return param[1];

  // ID brut (les IDs Google font ~44 caractères, on tolère >= 20)
  if (/^[a-zA-Z0-9-_]{20,}$/.test(s)) return s;

  return null;
}

export async function getSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, key));
}

// -------------------------------------------------------------------------
// Migration mono-Sheet -> multi-Sheet
// -------------------------------------------------------------------------
// Les installations existantes ont un unique Sheet actif (google_sheet_id)
// + un historique de Sheets « archivés » (sheet_name:<id>). Pour ne pas
// se mettre soudain à re-synchroniser tous les anciens Sheets, on migre
// une seule fois : le Sheet actif reste activé (et récupère son URL), tous
// les autres Sheets connus passent désactivés. L'utilisateur les réactive
// ensuite à volonté. Idempotent et gardé par un drapeau en base + en RAM.
let migrated = false;
async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  if ((await getSetting(MIGRATED_KEY)) === "1") {
    migrated = true;
    return;
  }

  const legacyActive = await getSetting(SHEET_ID_KEY);
  const legacyUrl = await getSetting(SHEET_URL_KEY);
  const rows = await db.select().from(appSettings);

  for (const row of rows) {
    if (!row.key.startsWith(SHEET_NAME_PREFIX)) continue;
    const id = row.key.slice(SHEET_NAME_PREFIX.length);
    if (legacyActive && id === legacyActive) {
      if (legacyUrl) await setSetting(SHEET_URL_PREFIX + id, legacyUrl);
    } else {
      await setSetting(SHEET_DISABLED_PREFIX + id, "1");
    }
  }

  await setSetting(MIGRATED_KEY, "1");
  migrated = true;
}

/** Tous les Sheets configurés (triés par titre), avec leur état d'activation. */
export async function listSheets(): Promise<SheetConfig[]> {
  await ensureMigrated();
  const rows = await db.select().from(appSettings);

  const names = new Map<string, string>();
  const urls = new Map<string, string>();
  const disabled = new Set<string>();

  for (const row of rows) {
    if (row.key.startsWith(SHEET_NAME_PREFIX)) {
      names.set(row.key.slice(SHEET_NAME_PREFIX.length), row.value);
    } else if (row.key.startsWith(SHEET_URL_PREFIX)) {
      urls.set(row.key.slice(SHEET_URL_PREFIX.length), row.value);
    } else if (row.key.startsWith(SHEET_DISABLED_PREFIX)) {
      disabled.add(row.key.slice(SHEET_DISABLED_PREFIX.length));
    }
  }

  return [...names.entries()]
    .map(([id, title]) => ({
      id,
      title,
      url: urls.get(id) ?? null,
      enabled: !disabled.has(id),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * IDs des Sheets que le cron doit synchroniser (tous les Sheets activés).
 * Repli sur GOOGLE_SHEET_ID (.env) uniquement quand AUCUN Sheet n'est
 * configuré en base — sinon, tout désactiver signifie « ne rien synchroniser ».
 */
export async function getEnabledSheetIds(): Promise<string[]> {
  const sheets = await listSheets();
  if (sheets.length === 0) {
    return process.env.GOOGLE_SHEET_ID ? [process.env.GOOGLE_SHEET_ID] : [];
  }
  return sheets.filter((s) => s.enabled).map((s) => s.id);
}

/** Map sheetId -> titre lisible (pratique pour l'affichage). */
export async function getSheetNames(): Promise<Record<string, string>> {
  const sheets = await listSheets();
  return Object.fromEntries(sheets.map((s) => [s.id, s.title]));
}

/** Enregistre (ou met à jour) un Sheet et le marque activé. */
export async function addSheet(
  id: string,
  url: string,
  title: string,
): Promise<void> {
  await setSetting(SHEET_NAME_PREFIX + id, title);
  if (url) await setSetting(SHEET_URL_PREFIX + id, url);
  // Un (ré)ajout réactive toujours le Sheet.
  await deleteSetting(SHEET_DISABLED_PREFIX + id);
}

/** Active ou désactive un Sheet existant. */
export async function setSheetEnabled(
  id: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) await deleteSetting(SHEET_DISABLED_PREFIX + id);
  else await setSetting(SHEET_DISABLED_PREFIX + id, "1");
}

/**
 * Retire un Sheet de la configuration (les commandes déjà importées,
 * clés par leur propre sheet_id, sont conservées).
 */
export async function removeSheet(id: string): Promise<void> {
  await deleteSetting(SHEET_NAME_PREFIX + id);
  await deleteSetting(SHEET_URL_PREFIX + id);
  await deleteSetting(SHEET_DISABLED_PREFIX + id);
}

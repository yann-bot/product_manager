import { eq, like } from "drizzle-orm";
import { db } from "../db/client";
import { appSettings } from "../db/schemas/app-settings.schema";

//
// Réglages applicatifs (clé/valeur en base), configurables depuis l'UI.
//

export const SHEET_ID_KEY = "google_sheet_id";
export const SHEET_URL_KEY = "google_sheet_url";
// Préfixe des libellés par Sheet : "sheet_name:<sheetId>" -> titre lisible.
// Permet d'identifier la source de chaque commande quand plusieurs Sheets
// ont alimenté la base au fil du temps.
export const SHEET_NAME_PREFIX = "sheet_name:";

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

/** ID du Sheet : réglage en base, sinon repli sur GOOGLE_SHEET_ID (.env). */
export async function getSheetId(): Promise<string | null> {
  return (await getSetting(SHEET_ID_KEY)) ?? process.env.GOOGLE_SHEET_ID ?? null;
}

/** Lien d'origine collé par l'utilisateur (pour affichage), si défini. */
export function getSheetUrl(): Promise<string | null> {
  return getSetting(SHEET_URL_KEY);
}

/** Enregistre l'ID extrait + le lien d'origine (+ son titre lisible si connu). */
export async function setSheet(
  id: string,
  url: string,
  name?: string,
): Promise<void> {
  await setSetting(SHEET_ID_KEY, id);
  await setSetting(SHEET_URL_KEY, url);
  if (name) await setSetting(SHEET_NAME_PREFIX + id, name);
}

/** Map sheetId -> titre lisible, pour tous les Sheets déjà configurés. */
export async function getSheetNames(): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(appSettings)
    .where(like(appSettings.key, `${SHEET_NAME_PREFIX}%`));
  return Object.fromEntries(
    rows.map((r) => [r.key.slice(SHEET_NAME_PREFIX.length), r.value]),
  );
}

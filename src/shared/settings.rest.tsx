import { Router } from "express";
import type { Request } from "express";
import { sheets } from "../lib/google-sheet";
import { renderPage } from "./view";
import { SettingsPage } from "./views/SettingsPage";
import {
  extractSheetId,
  setSheet,
  getSheetId,
  getSheetUrl,
  getSheetNames,
} from "./settings";

//
// Configuration de la source Google Sheet depuis l'interface.
// On colle le lien du Sheet ; on en extrait l'ID, on vérifie que le
// compte de service y a bien accès (Sheet partagé), puis on persiste.
//

const SettingsRouter: Router = Router();

/** Construit l'URL de retour : base (page d'origine) + paramètres de bannière. */
const back = (base: string, params: Record<string, string>): string =>
  base +
  "?" +
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

/** Interprète ?sheet=ok|err (+title|msg) en bannière de statut. */
export function parseSheetStatus(
  query: Request["query"],
): { kind: "ok" | "err"; message: string } | null {
  if (query.sheet === "ok") {
    const title = typeof query.title === "string" ? query.title : "Sheet";
    return { kind: "ok", message: `Source connectée : « ${title} ».` };
  }
  if (query.sheet === "err") {
    const msg = typeof query.msg === "string" ? query.msg : "Erreur inconnue.";
    return { kind: "err", message: msg };
  }
  return null;
}

// Page de configuration de l'application.
SettingsRouter.get("/settings/view", async (req, res) => {
  const [sheetId, sheetUrl, sheetNames] = await Promise.all([
    getSheetId(),
    getSheetUrl(),
    getSheetNames(),
  ]);

  renderPage(res, {
    title: "Paramètres",
    subtitle: "Configuration de l'application",
    active: "settings",
    body: (
      <SettingsPage
        sheetId={sheetId}
        sheetUrl={sheetUrl}
        sheetNames={sheetNames}
        serviceAccount={process.env.GOOGLE_CLIENT_EMAIL ?? null}
        cronEnabled={process.env.DISABLE_CRONS !== "true"}
        port={Number(process.env.PORT ?? 3000)}
        status={parseSheetStatus(req.query)}
      />
    ),
  });
});

SettingsRouter.post("/settings/google-sheet", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  // Page sur laquelle revenir (dashboard par défaut, ou la page Paramètres).
  const redirectTo =
    typeof req.body?.redirect === "string" && req.body.redirect
      ? req.body.redirect
      : "/";
  const id = extractSheetId(url);

  if (!id) {
    res.redirect(
      back(redirectTo, {
        sheet: "err",
        msg: "Lien invalide : impossible d'en extraire l'ID du Sheet.",
      }),
    );
    return;
  }

  try {
    // Vérifie l'accès : échoue si le Sheet n'est pas partagé avec le
    // compte de service (403) ou n'existe pas (404).
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const title = meta.data.properties?.title ?? id;

    await setSheet(id, url.trim(), title);
    res.redirect(back(redirectTo, { sheet: "ok", title }));
  } catch (err: unknown) {
    const e = err as { code?: number; response?: { status?: number }; message?: string };
    const status = e.code ?? e.response?.status;
    const account = process.env.GOOGLE_CLIENT_EMAIL ?? "le compte de service";
    const msg =
      status === 403
        ? `Accès refusé. Partage d'abord le Sheet (lecture) avec ${account}, puis réessaie.`
        : status === 404
          ? "Sheet introuvable — vérifie le lien."
          : `Impossible d'accéder au Sheet : ${e.message ?? "erreur inconnue"}.`;
    res.redirect(back(redirectTo, { sheet: "err", msg }));
  }
});

export default SettingsRouter;

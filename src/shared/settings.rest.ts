import { Router } from "express";
import { sheets } from "../lib/google-sheet";
import { extractSheetId, setSheet } from "./settings";

//
// Configuration de la source Google Sheet depuis l'interface.
// On colle le lien du Sheet ; on en extrait l'ID, on vérifie que le
// compte de service y a bien accès (Sheet partagé), puis on persiste.
//

const SettingsRouter: Router = Router();

const back = (params: Record<string, string>): string =>
  "/?" +
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

SettingsRouter.post("/settings/google-sheet", async (req, res) => {
  const url = typeof req.body?.url === "string" ? req.body.url : "";
  const id = extractSheetId(url);

  if (!id) {
    res.redirect(
      back({ sheet: "err", msg: "Lien invalide : impossible d'en extraire l'ID du Sheet." }),
    );
    return;
  }

  try {
    // Vérifie l'accès : échoue si le Sheet n'est pas partagé avec le
    // compte de service (403) ou n'existe pas (404).
    const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
    const title = meta.data.properties?.title ?? id;

    await setSheet(id, url.trim(), title);
    res.redirect(back({ sheet: "ok", title }));
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
    res.redirect(back({ sheet: "err", msg }));
  }
});

export default SettingsRouter;

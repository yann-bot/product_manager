import { Router } from "express";
import type { Request } from "express";
import { sheets } from "../lib/google-sheet";
import { renderPage } from "./view";
import { SettingsPage } from "./views/SettingsPage";
import {
  extractSheetId,
  addSheet,
  setSheetEnabled,
  removeSheet,
  listSheets,
} from "./settings";

//
// Configuration des sources Google Sheet depuis l'interface.
// On colle un ou plusieurs liens (un par ligne) ; on en extrait l'ID, on
// vérifie que le compte de service y a bien accès (Sheet partagé), puis on
// persiste. Chaque Sheet peut ensuite être activé / désactivé / retiré.
//

const SettingsRouter: Router = Router();

/** Construit l'URL de retour : base (page d'origine) + paramètres de bannière. */
const back = (base: string, params: Record<string, string>): string =>
  base +
  "?" +
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

/** Interprète ?sheet=ok|err (+msg) en bannière de statut. */
export function parseSheetStatus(
  query: Request["query"],
): { kind: "ok" | "err"; message: string } | null {
  const msg = typeof query.msg === "string" ? query.msg : null;
  if (query.sheet === "ok") {
    return { kind: "ok", message: msg ?? "Opération effectuée." };
  }
  if (query.sheet === "err") {
    return { kind: "err", message: msg ?? "Erreur inconnue." };
  }
  return null;
}

/** Page sur laquelle revenir après une action (dashboard par défaut). */
function redirectTarget(body: unknown): string {
  const r = (body as { redirect?: unknown })?.redirect;
  return typeof r === "string" && r ? r : "/";
}

// Page de configuration de l'application.
SettingsRouter.get("/settings/view", async (req, res) => {
  const configuredSheets = await listSheets();

  renderPage(res, {
    title: "Paramètres",
    subtitle: "Configuration de l'application",
    active: "settings",
    body: (
      <SettingsPage
        sheets={configuredSheets}
        serviceAccount={process.env.GOOGLE_CLIENT_EMAIL ?? null}
        cronEnabled={process.env.DISABLE_CRONS !== "true"}
        port={Number(process.env.PORT ?? 3000)}
        status={parseSheetStatus(req.query)}
      />
    ),
  });
});

// Ajoute un ou plusieurs Sheets (un lien par ligne). Chaque lien est
// vérifié individuellement ; on rapporte le total ajouté et les échecs.
SettingsRouter.post("/settings/google-sheet", async (req, res) => {
  const redirectTo = redirectTarget(req.body);
  // Compat : champ `links` (textarea multi-lignes) ou ancien champ `url`.
  const raw =
    typeof req.body?.links === "string"
      ? req.body.links
      : typeof req.body?.url === "string"
        ? req.body.url
        : "";

  const lines = raw
    .split(/[\r\n]+/)
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  if (lines.length === 0) {
    res.redirect(
      back(redirectTo, { sheet: "err", msg: "Aucun lien fourni." }),
    );
    return;
  }

  const added: string[] = [];
  const errors: string[] = [];
  const account = process.env.GOOGLE_CLIENT_EMAIL ?? "le compte de service";

  for (const line of lines) {
    const id = extractSheetId(line);
    if (!id) {
      errors.push(`« ${line} » : lien invalide.`);
      continue;
    }
    try {
      // Vérifie l'accès : échoue si le Sheet n'est pas partagé (403) ou
      // n'existe pas (404).
      const meta = await sheets.spreadsheets.get({ spreadsheetId: id });
      const title = meta.data.properties?.title ?? id;
      await addSheet(id, line, title);
      added.push(title);
    } catch (err: unknown) {
      const e = err as { code?: number; response?: { status?: number }; message?: string };
      const status = e.code ?? e.response?.status;
      errors.push(
        status === 403
          ? `« ${line} » : accès refusé (partagez-le avec ${account}).`
          : status === 404
            ? `« ${line} » : Sheet introuvable.`
            : `« ${line} » : ${e.message ?? "erreur inconnue"}.`,
      );
    }
  }

  const parts: string[] = [];
  if (added.length) parts.push(`Connecté(s) : ${added.join(", ")}.`);
  if (errors.length) parts.push(errors.join(" "));

  res.redirect(
    back(redirectTo, {
      sheet: errors.length && !added.length ? "err" : "ok",
      msg: parts.join(" ") || "Aucun changement.",
    }),
  );
});

// Active ou désactive un Sheet existant.
SettingsRouter.post("/settings/sheets/toggle", async (req, res) => {
  const redirectTo = redirectTarget(req.body);
  const id = typeof req.body?.id === "string" ? req.body.id : "";
  const enabled = req.body?.enabled === "1";

  if (!id) {
    res.redirect(back(redirectTo, { sheet: "err", msg: "Sheet inconnu." }));
    return;
  }

  await setSheetEnabled(id, enabled);
  res.redirect(
    back(redirectTo, {
      sheet: "ok",
      msg: enabled ? "Sheet activé." : "Sheet désactivé.",
    }),
  );
});

// Retire un Sheet de la configuration (les commandes déjà importées restent).
SettingsRouter.post("/settings/sheets/remove", async (req, res) => {
  const redirectTo = redirectTarget(req.body);
  const id = typeof req.body?.id === "string" ? req.body.id : "";

  if (!id) {
    res.redirect(back(redirectTo, { sheet: "err", msg: "Sheet inconnu." }));
    return;
  }

  await removeSheet(id);
  res.redirect(back(redirectTo, { sheet: "ok", msg: "Sheet retiré." }));
});

export default SettingsRouter;

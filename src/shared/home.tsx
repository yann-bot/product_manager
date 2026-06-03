import { Router } from "express";
import { renderPage } from "./view";
import { DashboardPage } from "./views/DashboardPage";
import { getSheetId, getSheetUrl } from "./settings";

//
// Route de la page principale du dashboard ("/").
//
const HomeRouter: Router = Router();

HomeRouter.get("/", async (req, res) => {
  const [sheetId, sheetUrl] = await Promise.all([getSheetId(), getSheetUrl()]);

  // Bannière de retour après configuration (?sheet=ok|err).
  const sheet = req.query.sheet;
  let status: { kind: "ok" | "err"; message: string } | null = null;
  if (sheet === "ok") {
    const title =
      typeof req.query.title === "string" ? req.query.title : "Sheet";
    status = { kind: "ok", message: `Source connectée : « ${title} ».` };
  } else if (sheet === "err") {
    const msg =
      typeof req.query.msg === "string" ? req.query.msg : "Erreur inconnue.";
    status = { kind: "err", message: msg };
  }

  renderPage(res, {
    title: "Tableau de bord",
    subtitle: "Vue d'ensemble du système",
    body: (
      <DashboardPage
        sheetId={sheetId}
        sheetUrl={sheetUrl}
        serviceAccount={process.env.GOOGLE_CLIENT_EMAIL ?? null}
        status={status}
      />
    ),
  });
});

export default HomeRouter;

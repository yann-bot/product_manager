import { Router } from "express";
import { renderPage } from "./view";
import { DashboardPage } from "./views/DashboardPage";
import { loadDashboard } from "./dashboard.read";

//
// Route de la page principale du dashboard ("/").
// La configuration de la source Google Sheet vit désormais dans /settings/view.
//
const HomeRouter: Router = Router();

HomeRouter.get("/", async (_req, res) => {
  const data = await loadDashboard();

  renderPage(res, {
    title: "Tableau de bord",
    subtitle: "Inventory Management — vue d'ensemble du système",
    active: "dashboard",
    body: <DashboardPage data={data} />,
  });
});

export default HomeRouter;

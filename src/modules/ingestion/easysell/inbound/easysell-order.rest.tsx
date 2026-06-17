import { Router } from "express";
import { EasySellOrderService } from "../core/easysell-order.service";
import { renderPage } from "../../../../shared/view";
import { getSheetId, getSheetNames } from "../../../../shared/settings";
import { resolveDateScope } from "../../../../shared/date-scope";
import { EasySellOrdersPage } from "./views/EasySellOrdersPage";

export default function EasySellOrderController(
  service: EasySellOrderService,
): Router {
  const router = Router();

  // Vue HTML : commandes EasySell brutes (telles qu'importées du Sheet),
  // restreintes à la fenêtre temporelle choisie (filtre par date_heure).
  router.get("/easysell-orders/view", async (req, res) => {
    try {
      const { scope, range } = resolveDateScope(req.query, "Toutes les commandes");
      const [orders, sheetNames, activeSheetId] = await Promise.all([
        service.findAll(),
        getSheetNames(),
        getSheetId(),
      ]);

      // Fenêtre [from, to) sur date_heure. « Tout » (deux bornes nulles) =
      // tout, y compris les commandes sans date ; sinon ces dernières, non
      // datées, sont hors de toute fenêtre.
      const inWindow = (d: Date | null): boolean => {
        if (range.from === null && range.to === null) return true;
        if (d === null) return false;
        return (
          (range.from === null || d >= range.from) &&
          (range.to === null || d < range.to)
        );
      };
      const scoped = orders.filter((o) => inWindow(o.dateHeure));

      renderPage(res, {
        title: "Commandes EasySell",
        subtitle: "Données brutes importées du Google Sheet, affichées telles quelles",
        active: "easysell-orders",
        body: (
          <EasySellOrdersPage
            orders={scoped}
            sheetNames={sheetNames}
            activeSheetId={activeSheetId}
            scope={scope}
          />
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Failed to render EasySell orders view");
    }
  });

  router.get("/easysell-orders", async (_req, res) => {
    try {
      res.json(await service.findAll());
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch EasySell orders" });
    }
  });

  return router;
}

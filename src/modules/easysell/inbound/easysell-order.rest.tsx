import { Router } from "express";
import { EasySellOrderService } from "../core/easysell-order.service";
import { renderPage } from "../../../shared/view";
import { getSheetId, getSheetNames } from "../../../shared/settings";
import { EasySellOrdersPage } from "./views/EasySellOrdersPage";

export default function EasySellOrderController(
  service: EasySellOrderService,
): Router {
  const router = Router();

  // Vue HTML : commandes EasySell brutes (telles qu'importées du Sheet).
  router.get("/easysell-orders/view", async (_req, res) => {
    try {
      const [orders, sheetNames, activeSheetId] = await Promise.all([
        service.findAll(),
        getSheetNames(),
        getSheetId(),
      ]);
      renderPage(res, {
        title: "Commandes EasySell",
        subtitle: "Données brutes importées du Google Sheet, affichées telles quelles",
        active: "easysell-orders",
        body: (
          <EasySellOrdersPage
            orders={orders}
            sheetNames={sheetNames}
            activeSheetId={activeSheetId}
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

import { Router } from "express";
import { EasySellOrderService } from "../core/easysell-order.service";
import { renderPage } from "../../../../shared/view";
import { listSheets, shortSheetId } from "../../../../shared/settings";
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
      const [orders, configuredSheets] = await Promise.all([
        service.findAll(),
        listSheets(),
      ]);
      const sheetNames = Object.fromEntries(
        configuredSheets.map((s) => [s.id, s.title]),
      );
      const enabledSheetIds = configuredSheets
        .filter((s) => s.enabled)
        .map((s) => s.id);
      const enabledSet = new Set(enabledSheetIds);

      // Un onglet par Sheet : tous les Sheets configurés (même désactivés,
      // pour pouvoir consulter leurs données) + les Sheets présents dans les
      // données mais plus configurés (retirés). Les configurés d'abord (déjà
      // triés par titre), puis les éventuels orphelins dans l'ordre des données.
      const tabIds: string[] = configuredSheets.map((s) => s.id);
      for (const id of orders.map((o) => o.sheetId)) {
        if (!tabIds.includes(id)) tabIds.push(id);
      }

      // Onglet sélectionné via ?sheetId= ; sinon « Toutes les sources ».
      const requested =
        typeof req.query.sheetId === "string" ? req.query.sheetId : "";
      const selectedSheetId = tabIds.includes(requested) ? requested : null;

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
      // Filtre temporel d'abord (compteurs par onglet sur la fenêtre), puis
      // restriction à l'onglet sélectionné.
      const dated = orders.filter((o) => inWindow(o.dateHeure));
      const countBySheet = new Map<string, number>();
      for (const o of dated) {
        countBySheet.set(o.sheetId, (countBySheet.get(o.sheetId) ?? 0) + 1);
      }
      const tabs = tabIds.map((id) => ({
        id,
        label: sheetNames[id] ?? shortSheetId(id),
        enabled: enabledSet.has(id),
        count: countBySheet.get(id) ?? 0,
      }));
      const scoped = selectedSheetId
        ? dated.filter((o) => o.sheetId === selectedSheetId)
        : dated;

      renderPage(res, {
        title: "Commandes EasySell",
        subtitle: "Données brutes importées du Google Sheet, affichées telles quelles",
        active: "easysell-orders",
        body: (
          <EasySellOrdersPage
            orders={scoped}
            sheetNames={sheetNames}
            enabledSheetIds={enabledSheetIds}
            tabs={tabs}
            selectedSheetId={selectedSheetId}
            totalCount={dated.length}
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

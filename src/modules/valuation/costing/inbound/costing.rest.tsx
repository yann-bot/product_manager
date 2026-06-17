import { Router } from "express";
import { CostingService } from "../core/costing.service";
import type { SalesRepository } from "../../../operations/sales/core/sales.entities";
import type { ProductRepository } from "../../../catalog/product/core/product.entities";
import { renderPage } from "../../../../shared/view";
import { CostingAuditPage, type CostingAuditRow } from "./views/CostingAuditPage";

//
// Couche inbound du module Costing : l'écran d'audit (valorisation, découverts,
// écarts) et le déclencheur de recalcul. Lit les ventes (avec leur cogs figé)
// via le SalesRepository ; le calcul, lui, vit dans le CostingService.
//

export default function CostingController(
  costing: CostingService,
  salesRepo: SalesRepository,
  productRepo: ProductRepository,
): Router {
  const router = Router();

  // Écran d'audit : ventes complétées valorisées (les annulées sont hors CA).
  router.get("/costing/view", async (_req, res) => {
    try {
      const [sales, products] = await Promise.all([
        salesRepo.findAll(),
        productRepo.findAll(),
      ]);
      const nameById: Record<string, string> = {};
      for (const p of products) nameById[p.id] = p.name;

      const rows: CostingAuditRow[] = sales
        .filter((s) => s.status === "completed")
        .map((s) => ({
          saleId: s.id,
          date: s.saleDate,
          productName: nameById[s.productId] ?? "—",
          quantity: s.quantity,
          totalAmount: s.totalAmount,
          cogs: s.cogs,
          cogsRecalculated: s.cogsRecalculated,
          shortfallQuantity: s.shortfallQuantity,
        }));

      const summary = {
        valued: rows.filter((r) => r.cogs !== null).length,
        shortfall: rows.filter((r) => r.shortfallQuantity > 0).length,
        variance: rows.filter(
          (r) =>
            r.cogsRecalculated !== null &&
            r.cogs !== null &&
            r.cogsRecalculated !== r.cogs,
        ).length,
        totalMargin: rows.reduce((sum, r) => {
          const c = r.cogsRecalculated ?? r.cogs;
          return c !== null ? sum + (r.totalAmount - c) : sum;
        }, 0),
      };

      renderPage(res, {
        title: "Audit COGS",
        subtitle: "Valorisation FIFO des ventes — découverts & écarts",
        active: "costing",
        body: <CostingAuditPage rows={rows} summary={summary} />,
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du rendu de l'audit COGS.");
    }
  });

  // Recalcul auditable : rejoue le journal complet et met à jour cogs_recalculated.
  router.post("/costing/recalculate", async (_req, res) => {
    try {
      await costing.recalculateAll();
      res.redirect("/costing/view");
    } catch (err) {
      console.error(err);
      res.status(500).send("Échec du recalcul des COGS.");
    }
  });

  return router;
}

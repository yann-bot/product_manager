import { Router } from "express";
import type { AnalyticsService } from "../core/analytics.service";
import type { AnalyticsFilter } from "../core/analytics.entities";
import { renderPage } from "../../../shared/view";
import { AnalyticsPage } from "./views/AnalyticsPage";

//
// Controller Analytics. Tout est calculé À LA LECTURE (aucune table
// d'agrégat). Filtre optionnel ?sheetId= pour restreindre à un Sheet.
//

export default function AnalyticsController(service: AnalyticsService): Router {
  const router = Router();

  // Vue HTML : tableau de bord analytique.
  router.get("/analytics/view", async (req, res) => {
    try {
      const filter = filterOf(req.query);
      const monthStart = startOfCurrentMonth();

      const [indicators, monthIndicators, breakdown, daily] = await Promise.all([
        service.getIndicators(filter),
        service.getIndicators({ ...filter, from: monthStart }),
        service.getStatusBreakdown(filter),
        service.getDailySeries(filter),
      ]);

      renderPage(res, {
        title: "Analytics EasySell",
        subtitle: "Indicateurs calculés en temps réel à partir des commandes",
        active: "analytics",
        body: (
          <AnalyticsPage
            indicators={indicators}
            monthRevenue={monthIndicators.revenue}
            breakdown={breakdown}
            daily={daily}
          />
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Failed to render analytics view");
    }
  });

  // API JSON : indicateurs consolidés.
  router.get("/analytics", async (req, res) => {
    try {
      res.json(await service.getIndicators(filterOf(req.query)));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to compute analytics" });
    }
  });

  return router;
}

function filterOf(query: unknown): AnalyticsFilter {
  const q = query as Record<string, unknown>;
  return typeof q.sheetId === "string" ? { sheetId: q.sheetId } : {};
}

// 1er jour du mois calendaire en cours, à minuit (heure locale serveur).
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

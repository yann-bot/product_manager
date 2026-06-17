import { Router } from "express";
import type { AnalyticsService } from "../core/analytics.service";
import type { AnalyticsFilter } from "../core/analytics.entities";
import { renderPage } from "../../../../shared/view";
import { resolveDateScope, type DateRange } from "../../../../shared/date-scope";
import { AnalyticsPage } from "./views/AnalyticsPage";

//
// Controller Analytics. Tout est calculé À LA LECTURE (aucune table
// d'agrégat). Filtres optionnels : ?sheetId= (par Sheet) et fenêtre
// temporelle (?period / ?month / ?from+?to), mutualisée avec les Ventes
// via shared/date-scope.
//

export default function AnalyticsController(service: AnalyticsService): Router {
  const router = Router();

  // Vue HTML : tableau de bord analytique.
  router.get("/analytics/view", async (req, res) => {
    try {
      const { scope, range } = resolveDateScope(req.query, "Toutes les commandes");
      const sheetId = sheetIdOf(req.query);
      const sheetFilter: AnalyticsFilter = sheetId ? { sheetId } : {};
      // Indicateurs restreints à la fenêtre sélectionnée.
      const windowFilter = withRange(sheetFilter, range);

      const [indicators, monthIndicators, breakdown, daily] = await Promise.all([
        service.getIndicators(windowFilter),
        // « CA du mois » : toujours le mois calendaire en cours (hors fenêtre).
        service.getIndicators({ ...sheetFilter, from: startOfCurrentMonth() }),
        service.getStatusBreakdown(windowFilter),
        service.getDailySeries(windowFilter),
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
            scope={scope}
            sheetId={sheetId}
          />
        ),
      });
    } catch (err) {
      console.error(err);
      res.status(500).send("Failed to render analytics view");
    }
  });

  // API JSON : indicateurs consolidés (mêmes filtres que la vue).
  router.get("/analytics", async (req, res) => {
    try {
      const { range } = resolveDateScope(req.query);
      const sheetId = sheetIdOf(req.query);
      const filter = withRange(sheetId ? { sheetId } : {}, range);
      res.json(await service.getIndicators(filter));
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to compute analytics" });
    }
  });

  return router;
}

function sheetIdOf(query: unknown): string | null {
  const q = query as Record<string, unknown>;
  return typeof q.sheetId === "string" ? q.sheetId : null;
}

/** Ajoute les bornes [from, to) résolues au filtre (omises si ouvertes). */
function withRange(base: AnalyticsFilter, range: DateRange): AnalyticsFilter {
  const filter: AnalyticsFilter = { ...base };
  if (range.from) filter.from = range.from;
  if (range.to) filter.to = range.to;
  return filter;
}

// 1er jour du mois calendaire en cours, à minuit (heure locale serveur).
function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

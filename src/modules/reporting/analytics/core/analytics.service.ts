import { classifyStatus } from "./classify-status";
import type { StatusBucket } from "./classify-status";
import type {
  AnalyticsFilter,
  AnalyticsRepository,
  DailyPoint,
  Indicators,
  StatusBreakdownItem,
} from "./analytics.entities";

//
// Use-cases Analytics : on récupère les agrégats bruts (groupés par statut
// texte) et on les replie par bucket canonique via classifyStatus. NOISE et
// UNKNOWN sont systématiquement exclus des indicateurs (RM-04) : ce ne sont
// pas des commandes commercialement exploitables.
//

// Buckets affichés dans la répartition, dans un ordre stable. NOISE seul est
// hors-commande (texte qui a fui dans la colonne statut) ; "sans statut"
// (UNKNOWN) reste une vraie commande, pas encore traitée.
const BREAKDOWN_BUCKETS: StatusBucket[] = [
  "DELIVERED",
  "PENDING",
  "UNREACHABLE",
  "REJECTED",
  "UNKNOWN",
];

export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  async getIndicators(filter: AnalyticsFilter = {}): Promise<Indicators> {
    const aggs = await this.repo.aggregateByStatus(filter);

    let revenue = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    let unreachableCount = 0;
    let rejectedCount = 0;
    let unknownCount = 0;
    let deliveredMissingAmount = 0;

    for (const a of aggs) {
      switch (classifyStatus(a.status)) {
        case "DELIVERED":
          deliveredCount += a.count;
          revenue += a.revenue;
          deliveredMissingAmount += a.missingAmount;
          break;
        case "PENDING":
          pendingCount += a.count;
          break;
        case "UNREACHABLE":
          unreachableCount += a.count;
          break;
        case "REJECTED":
          rejectedCount += a.count;
          break;
        case "UNKNOWN":
          unknownCount += a.count;
          break;
        // NOISE : ignoré (ce n'est pas une commande).
      }
    }

    // Toutes les commandes réelles = tout sauf le bruit.
    const ordersCount =
      deliveredCount + pendingCount + unreachableCount + rejectedCount + unknownCount;
    // Décision : dénominateur = toutes les commandes synchronisées.
    const deliveryRate = ordersCount > 0 ? deliveredCount / ordersCount : 0;
    // Panier moyen calculé sur les livrées AVEC montant (le CA exclut déjà
    // les livrées sans prix_total) pour éviter un panier sous-évalué.
    const billable = deliveredCount - deliveredMissingAmount;
    const avgBasket = billable > 0 ? revenue / billable : 0;

    return {
      revenue,
      ordersCount,
      deliveredCount,
      pendingCount,
      unreachableCount,
      rejectedCount,
      unknownCount,
      deliveryRate,
      avgBasket,
      deliveredMissingAmount,
    };
  }

  async getStatusBreakdown(
    filter: AnalyticsFilter = {},
  ): Promise<StatusBreakdownItem[]> {
    const aggs = await this.repo.aggregateByStatus(filter);
    const counts = new Map<StatusBucket, number>();
    for (const a of aggs) {
      const bucket = classifyStatus(a.status);
      counts.set(bucket, (counts.get(bucket) ?? 0) + a.count);
    }
    return BREAKDOWN_BUCKETS.map((bucket) => ({
      bucket,
      count: counts.get(bucket) ?? 0,
    }));
  }

  async getDailySeries(filter: AnalyticsFilter = {}): Promise<DailyPoint[]> {
    const aggs = await this.repo.aggregateByDay(filter);
    const byDay = new Map<string, { revenue: number; ordersCount: number }>();

    for (const a of aggs) {
      const bucket = classifyStatus(a.status);
      if (bucket === "NOISE") continue; // pas une commande
      const point = byDay.get(a.day) ?? { revenue: 0, ordersCount: 0 };
      point.ordersCount += a.count;
      if (bucket === "DELIVERED") point.revenue += a.revenue;
      byDay.set(a.day, point);
    }

    return [...byDay.entries()]
      .sort(([x], [y]) => x.localeCompare(y))
      .map(([day, v]) => ({ day, revenue: v.revenue, ordersCount: v.ordersCount }));
  }
}

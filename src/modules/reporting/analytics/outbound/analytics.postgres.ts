import { and, eq, gte, lt, isNotNull, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { DB } from "../../../../db/client";
import { easysellOrders } from "../../../../db/schemas/easysell-order.schema";
import type {
  AnalyticsFilter,
  AnalyticsRepository,
  DayStatusAggregate,
  StatusAggregate,
} from "../core/analytics.entities";

//
// Adaptateur Postgres : pures agrégations en LECTURE sur easysell_orders.
// On groupe par la valeur de statut TEXTE (≈ une douzaine de valeurs
// distinctes) ; la classification en buckets est faite en TS pur côté
// service (testable), pas en SQL. Casts ::int / ::float8 pour récupérer
// des nombres JS (et pas des strings) côté node-postgres.
//

// Expression réutilisée : tronque date_heure au jour, format ISO.
const dayExpr = sql<string>`to_char(date_trunc('day', ${easysellOrders.dateHeure}), 'YYYY-MM-DD')`;

export class AnalyticsPostgresRepository implements AnalyticsRepository {
  constructor(private readonly db: DB) {}

  async aggregateByStatus(filter: AnalyticsFilter): Promise<StatusAggregate[]> {
    return this.db
      .select({
        status: easysellOrders.status,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${easysellOrders.prixTotal}), 0)::float8`,
        missingAmount: sql<number>`count(*) filter (where ${easysellOrders.prixTotal} is null)::int`,
      })
      .from(easysellOrders)
      .where(whereOf(filter))
      .groupBy(easysellOrders.status);
  }

  async aggregateByDay(filter: AnalyticsFilter): Promise<DayStatusAggregate[]> {
    // Les lignes sans date ne peuvent pas figurer dans une série temporelle.
    const conds: SQL[] = [isNotNull(easysellOrders.dateHeure)];
    const base = whereOf(filter);
    if (base) conds.push(base);

    return this.db
      .select({
        day: dayExpr,
        status: easysellOrders.status,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${easysellOrders.prixTotal}), 0)::float8`,
      })
      .from(easysellOrders)
      .where(and(...conds))
      .groupBy(dayExpr, easysellOrders.status);
  }
}

// Construit le filtre WHERE (sheet/période) commun, ou undefined si vide.
function whereOf(filter: AnalyticsFilter): SQL | undefined {
  const conds: SQL[] = [];
  if (filter.sheetId) conds.push(eq(easysellOrders.sheetId, filter.sheetId));
  if (filter.from) conds.push(gte(easysellOrders.dateHeure, filter.from));
  if (filter.to) conds.push(lt(easysellOrders.dateHeure, filter.to));
  return conds.length > 0 ? and(...conds) : undefined;
}

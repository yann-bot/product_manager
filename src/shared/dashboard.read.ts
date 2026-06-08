import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { classifyStatus } from "../modules/analytics/core/classify-status";

//
// ======================================================
// LECTURE DASHBOARD (compute-on-read, multi-contextes)
// ======================================================
// Vue de synthèse transverse de la page d'accueil. Comme l'Analytics,
// AUCUN agrégat n'est stocké : tout est recalculé par SQL à la lecture.
// On interroge directement les tables (concern de reporting en lecture
// seule) plutôt que de traverser chaque module.
//
// Règle « uniquement le réel » : seuls les blocs adossés à de vraies
// données sont calculés (produits, stock, commandes, ventes). Pas de
// clients/finance fabriqués.
// ======================================================
//

export interface DashboardData {
  kpi: {
    /** Produits actifs au catalogue. */
    totalProducts: number;
    /** Commandes EasySell synchronisées (staging brut). */
    ordersCount: number;
    /** Stock total = SUM(stock_movements.quantity). */
    totalStock: number;
    /** Produits actifs dont le stock dérivé est ≤ 0. */
    outOfStock: number;
  };
  /** Donut « valeurs d'inventaire » : unités sorties vs encore en stock. */
  inventory: { soldUnits: number; inStockUnits: number };
  /** Top produits par CA (ventes internes + ventes EasySell réconciliées). */
  topProducts: { name: string; revenue: number }[];
  /** CA des commandes EasySell livrées, 6 derniers mois calendaires. */
  monthlyRevenue: { key: string; label: string; revenue: number }[];
}

/** Les N derniers mois calendaires (courant inclus), du plus ancien au plus récent. */
function lastNMonths(n: number): { key: string; label: string; start: Date }[] {
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth(), 1);
  const fmt = new Intl.DateTimeFormat("fr-FR", { month: "short" });
  const out: { key: string; label: string; start: Date }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: fmt.format(d), start: d });
  }
  return out;
}

export async function loadDashboard(): Promise<DashboardData> {
  // 1. KPIs scalaires + unités du donut, en un seul aller-retour.
  const kpiRes = await db.execute(sql`
    select
      (select count(*)::int from products where status = 'active') as total_products,
      (select count(*)::int from easysell_orders) as orders_count,
      (select coalesce(sum(quantity), 0)::int from stock_movements) as total_stock,
      (select coalesce(sum(case when type = 'out' then -quantity else 0 end), 0)::int
         from stock_movements) as sold_units,
      (select count(*)::int from products p
         where p.status = 'active'
           and coalesce((select sum(quantity) from stock_movements m
                         where m.product_id = p.id), 0) <= 0) as out_of_stock
  `);
  const k = (kpiRes.rows[0] ?? {}) as Record<string, number | null>;
  const totalStock = Number(k.total_stock ?? 0);
  const soldUnits = Number(k.sold_units ?? 0);

  // 2. Top 10 produits par chiffre d'affaires : ventes internes complétées
  //    UNIQUEMENT. Les ventes EasySell réconciliées sont déjà matérialisées
  //    en ventes internes (provenance easysell_sale_id) → pas de double compte.
  const topRes = await db.execute(sql`
    select p.name as name, sum(s.total_amount)::float8 as revenue
    from sales s
    join products p on p.id = s.product_id
    where s.status = 'completed'
    group by p.id, p.name
    order by revenue desc
    limit 10
  `);
  const topProducts = topRes.rows.map((r) => {
    const row = r as Record<string, unknown>;
    return { name: String(row.name), revenue: Number(row.revenue ?? 0) };
  });

  // 3. CA mensuel des commandes LIVRÉES (6 mois). On agrège par mois + statut
  //    texte, puis on ne garde que le bucket DELIVERED (classification TS pure).
  const months = lastNMonths(6);
  const from = months[0]?.start ?? new Date();
  const revRes = await db.execute(sql`
    select to_char(date_trunc('month', date_heure), 'YYYY-MM') as month,
           status as status,
           coalesce(sum(prix_total), 0)::float8 as revenue
    from easysell_orders
    where date_heure >= ${from}
    group by 1, 2
  `);
  const revByMonth = new Map<string, number>();
  for (const r of revRes.rows) {
    const row = r as Record<string, unknown>;
    if (classifyStatus((row.status as string | null) ?? null) !== "DELIVERED") continue;
    const month = String(row.month);
    revByMonth.set(month, (revByMonth.get(month) ?? 0) + Number(row.revenue ?? 0));
  }
  const monthlyRevenue = months.map((m) => ({
    key: m.key,
    label: m.label,
    revenue: revByMonth.get(m.key) ?? 0,
  }));

  return {
    kpi: {
      totalProducts: Number(k.total_products ?? 0),
      ordersCount: Number(k.orders_count ?? 0),
      totalStock,
      outOfStock: Number(k.out_of_stock ?? 0),
    },
    inventory: { soldUnits, inStockUnits: Math.max(0, totalStock) },
    topProducts,
    monthlyRevenue,
  };
}

import type { CSSProperties } from "react";
import { money, percent } from "../../../../shared/format";
import type { StatusBucket } from "../../core/classify-status";
import type {
  DailyPoint,
  Indicators,
  StatusBreakdownItem,
} from "../../core/analytics.entities";

//
// Vue Analytics (SSR React -> HTML statique, aucun JS client). Les
// « graphiques » sont rendus en barres CSS côté serveur, cohérent avec
// la règle no-hydratation du projet.
//

interface Props {
  indicators: Indicators;
  /** CA du mois courant (mois calendaire en cours). */
  monthRevenue: number;
  breakdown: StatusBreakdownItem[];
  daily: DailyPoint[];
}

const BUCKET_LABEL: Record<StatusBucket, string> = {
  DELIVERED: "Livrées",
  PENDING: "En attente",
  UNREACHABLE: "Injoignables",
  REJECTED: "Rejetées",
  NOISE: "Bruit",
  UNKNOWN: "Sans statut",
};

const BUCKET_COLOR: Record<StatusBucket, string> = {
  DELIVERED: "#34d399",
  PENDING: "#38bdf8",
  UNREACHABLE: "#f87171",
  REJECTED: "#fbbf24",
  NOISE: "#64748b",
  UNKNOWN: "#64748b",
};

const sectionTitle: CSSProperties = {
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: ".04em",
  color: "#94a3b8",
  margin: "28px 0 12px",
};

const track: CSSProperties = {
  flex: 1,
  height: 10,
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 999,
  overflow: "hidden",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "6px 0",
};

export function AnalyticsPage({ indicators, monthRevenue, breakdown, daily }: Props) {
  const i = indicators;
  const totalBreakdown = breakdown.reduce((s, b) => s + b.count, 0);
  const maxRevenue = Math.max(1, ...daily.map((d) => d.revenue));

  return (
    <>
      <div className="cards">
        <Card k="Chiffre d'affaires" v={money(i.revenue)} accent />
        <Card k="CA du mois" v={money(monthRevenue)} />
        <Card k="Commandes" v={String(i.ordersCount)} />
        <Card k="Livrées" v={String(i.deliveredCount)} />
        <Card k="Rejetées" v={String(i.rejectedCount)} />
        <Card k="Taux de livraison" v={percent(i.deliveryRate)} accent />
        <Card k="Panier moyen" v={money(i.avgBasket)} />
      </div>

      <div className="wrap">
        {i.deliveredMissingAmount > 0 && (
          <div className="sub" style={{ margin: "4px 0 8px" }}>
            ⚠️ {i.deliveredMissingAmount} commande
            {i.deliveredMissingAmount > 1 ? "s" : ""} livrée
            {i.deliveredMissingAmount > 1 ? "s" : ""} sans montant — exclue
            {i.deliveredMissingAmount > 1 ? "s" : ""} du CA, à corriger dans le
            Sheet.
          </div>
        )}

        <div style={sectionTitle}>Répartition des commandes</div>
        {totalBreakdown === 0 ? (
          <div className="muted">Aucune commande exploitable.</div>
        ) : (
          breakdown.map((b) => {
            const ratio = b.count / totalBreakdown;
            return (
              <div key={b.bucket} style={rowStyle}>
                <span style={{ flex: "0 0 110px" }}>{BUCKET_LABEL[b.bucket]}</span>
                <span style={track}>
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${ratio * 100}%`,
                      background: BUCKET_COLOR[b.bucket],
                    }}
                  />
                </span>
                <span
                  className="num"
                  style={{ flex: "0 0 130px", textAlign: "right" }}
                >
                  {b.count} · {percent(ratio)}
                </span>
              </div>
            );
          })
        )}

        <div style={sectionTitle}>Évolution quotidienne du CA</div>
        {daily.length === 0 ? (
          <div className="muted">
            Aucune commande datée (les lignes sans date sont exclues).
          </div>
        ) : (
          daily.map((d) => (
            <div key={d.day} style={rowStyle}>
              <span style={{ flex: "0 0 110px" }} className="muted">
                {d.day}
              </span>
              <span style={track}>
                <span
                  style={{
                    display: "block",
                    height: "100%",
                    width: `${(d.revenue / maxRevenue) * 100}%`,
                    background: "#38bdf8",
                  }}
                />
              </span>
              <span
                className="num"
                style={{ flex: "0 0 160px", textAlign: "right" }}
              >
                {money(d.revenue)}{" "}
                <span className="muted">· {d.ordersCount} cmd</span>
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Card({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="card">
      <div className="k">{k}</div>
      <div className={accent ? "v accent" : "v"}>{v}</div>
    </div>
  );
}

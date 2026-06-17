import { FiArrowLeft, FiRefreshCw } from "react-icons/fi";
import { money, formatDateTime } from "../../../../../shared/format";

// Ligne d'audit (jointures produit + sélection des ventes complétées faites
// côté controller ; la vue reste pure).
export interface CostingAuditRow {
  saleId: string;
  date: Date;
  productName: string;
  quantity: number;
  totalAmount: number;
  cogs: number | null;
  cogsRecalculated: number | null;
  shortfallQuantity: number;
}

interface CostingAuditPageProps {
  rows: CostingAuditRow[];
  summary: {
    valued: number;
    shortfall: number;
    variance: number;
    totalMargin: number;
  };
}

// COGS de référence pour la marge : le recalculé (vérité d'audit) s'il existe,
// sinon le snapshot.
const effectiveCogs = (r: CostingAuditRow): number | null =>
  r.cogsRecalculated ?? r.cogs;

const variance = (r: CostingAuditRow): number | null =>
  r.cogsRecalculated !== null && r.cogs !== null
    ? r.cogsRecalculated - r.cogs
    : null;

const margin = (r: CostingAuditRow): number | null => {
  const c = effectiveCogs(r);
  return c !== null ? r.totalAmount - c : null;
};

/** Audit COGS : valorisation des ventes, découverts et écarts snapshot↔recalcul. */
export function CostingAuditPage({ rows, summary }: CostingAuditPageProps) {
  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Marge cumulée</div>
          <div className="v accent">{money(summary.totalMargin)}</div>
        </div>
        <div className="card">
          <div className="k">Ventes valorisées</div>
          <div className="v">{summary.valued}</div>
        </div>
        <div className="card">
          <div className="k">À découvert</div>
          <div className="v">{summary.shortfall}</div>
        </div>
        <div className="card">
          <div className="k">Écarts détectés</div>
          <div className="v">{summary.variance}</div>
        </div>
      </div>

      <div className="wrap">
        <div className="toolbar">
          <div className="nav">
            <a href="/sales/view">
              <FiArrowLeft style={{ verticalAlign: "-2px" }} /> Ventes
            </a>
          </div>
          {/* Recalcul auditable : rejoue le journal complet (résorbe les découverts). */}
          <form method="post" action="/costing/recalculate">
            <button className="btn btn-primary" type="submit">
              <FiRefreshCw style={{ verticalAlign: "-2px" }} /> Recalculer les COGS
            </button>
          </form>
        </div>

        <input
          className="filter"
          type="search"
          data-filter="#costing-table"
          placeholder="Filtrer (produit…)"
          autoComplete="off"
        />
        <table id="costing-table" data-page-size="10">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th className="num">Qté</th>
              <th className="num">Montant</th>
              <th className="num">COGS</th>
              <th className="num">COGS recalculé</th>
              <th className="num">Écart</th>
              <th className="num">Marge</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((r) => {
                const v = variance(r);
                const m = margin(r);
                const hasShortfall = r.shortfallQuantity > 0;
                const hasVariance = v !== null && v !== 0;
                return (
                  <tr key={r.saleId}>
                    <td>{formatDateTime(r.date)}</td>
                    <td className="strong">{r.productName}</td>
                    <td className="num">{r.quantity}</td>
                    <td className="num">{money(r.totalAmount)}</td>
                    <td className="num">{r.cogs !== null ? money(r.cogs) : "—"}</td>
                    <td className="num">
                      {r.cogsRecalculated !== null ? money(r.cogsRecalculated) : "—"}
                    </td>
                    <td className="num">
                      {v !== null ? (
                        <span style={v !== 0 ? { color: "#c98a16" } : undefined}>
                          {v > 0 ? `+${money(v)}` : money(v)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="num">{m !== null ? money(m) : "—"}</td>
                    <td>
                      {hasShortfall ? (
                        <span className="tag" title={`${r.shortfallQuantity} à découvert`}>
                          Découvert
                        </span>
                      ) : null}
                      {hasVariance ? <span className="tag">Régularisé</span> : null}
                      {!hasShortfall && !hasVariance ? (
                        <span className="muted">OK</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={9} className="empty">
                  Aucune vente valorisée. Enregistrez des entrées de stock (avec
                  prix de revient) puis des ventes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

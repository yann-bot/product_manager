import type { Sale } from "../../core/sales.entities";
import { money, formatDateTime } from "../../../../../shared/format";
import { dateScopeQuery, type DateScope } from "../../../../../shared/date-scope";
import { DateFilterBar } from "../../../../../shared/views/DateFilterBar";

export type SaleStatusFilter = "all" | "completed" | "cancelled";

interface SalesPageProps {
  sales: Sale[];
  /** Filtre de statut courant (onglet « Toutes / Complétées / Annulées »). */
  filter: SaleStatusFilter;
  /** Fenêtre temporelle active (préréglage, mois précis ou intervalle). */
  scope: DateScope;
  /** Compteurs sur la fenêtre sélectionnée (indépendants du filtre statut). */
  counts: { all: number; completed: number; cancelled: number };
  /** Chiffre d'affaires de la fenêtre = Σ montants des ventes complétées (RM-06). */
  revenue: number;
  /** Nom produit par id (jointure faite côté controller, vue pure). */
  productNameById: Record<string, string>;
}

const TABS: { key: SaleStatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "completed", label: "Complétées" },
  { key: "cancelled", label: "Annulées" },
];

/** UC-02 — Liste des ventes (CA, filtre statut, recherche, pagination). */
export function SalesPage({ sales, filter, scope, counts, revenue, productNameById }: SalesPageProps) {
  // Lien d'un onglet de statut : conserve la fenêtre temporelle courante
  // (statut et fenêtre sont orthogonaux).
  const statusHref = (s: SaleStatusFilter) =>
    `/sales/view?status=${s}&${dateScopeQuery(scope)}`;

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Chiffre d'affaires</div>
          <div className="v accent">{money(revenue)}</div>
        </div>
        <div className="card">
          <div className="k">Ventes</div>
          <div className="v">{counts.all}</div>
        </div>
        <div className="card">
          <div className="k">Complétées</div>
          <div className="v">{counts.completed}</div>
        </div>
        <div className="card">
          <div className="k">Annulées</div>
          <div className="v">{counts.cancelled}</div>
        </div>
      </div>

      <div className="wrap">
        <DateFilterBar scope={scope} action="/sales/view" hidden={{ status: filter }} />

        <div className="toolbar">
          <div className="nav">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={statusHref(t.key)}
                className={filter === t.key ? "active" : ""}
              >
                {t.label}
              </a>
            ))}
          </div>
          <a className="btn btn-primary" href="/sales/new">
            + Nouvelle vente
          </a>
        </div>

        <input
          className="filter"
          type="search"
          data-filter="#sales-table"
          placeholder="Filtrer (produit, statut…)"
          autoComplete="off"
        />
        <table id="sales-table" data-page-size="10">
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th className="num">Quantité</th>
              <th className="num">Montant</th>
              <th className="num">Marge</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.map((s) => {
                const isCompleted = s.status === "completed";
                // Marge = montant − COGS (recalculé si dispo, sinon snapshot),
                // sur les ventes complétées et valorisées seulement.
                const effectiveCogs = s.cogsRecalculated ?? s.cogs;
                const marginVal =
                  isCompleted && effectiveCogs !== null
                    ? s.totalAmount - effectiveCogs
                    : null;
                return (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.saleDate)}</td>
                    <td className="strong">{productNameById[s.productId] ?? "—"}</td>
                    <td className="num">{s.quantity}</td>
                    <td className="num">{money(s.totalAmount)}</td>
                    <td className="num">{marginVal !== null ? money(marginVal) : "—"}</td>
                    <td>
                      <span className={`tag ${isCompleted ? "tag-active" : ""}`}>
                        {isCompleted ? "Complété" : "Annulé"}
                      </span>
                    </td>
                    <td>
                      <a className="link" href={`/sales/${s.id}/view`}>
                        Détail
                      </a>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="empty">
                  Aucune vente dans cette vue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

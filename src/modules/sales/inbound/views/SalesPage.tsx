import type { Sale } from "../../core/sales.entities";
import { money, formatDateTime } from "../../../../shared/format";

export type SaleStatusFilter = "all" | "completed" | "cancelled";

interface SalesPageProps {
  sales: Sale[];
  /** Filtre de statut courant (onglet « Toutes / Complétées / Annulées »). */
  filter: SaleStatusFilter;
  /** Compteurs tous statuts confondus (indépendants du filtre). */
  counts: { all: number; completed: number; cancelled: number };
  /** Chiffre d'affaires = Σ montants des ventes complétées (RM-06). */
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
export function SalesPage({ sales, filter, counts, revenue, productNameById }: SalesPageProps) {
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
        <div className="toolbar">
          <div className="nav">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={`/sales/view?status=${t.key}`}
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
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sales.length > 0 ? (
              sales.map((s) => {
                const isCompleted = s.status === "completed";
                return (
                  <tr key={s.id}>
                    <td>{formatDateTime(s.saleDate)}</td>
                    <td className="strong">{productNameById[s.productId] ?? "—"}</td>
                    <td className="num">{s.quantity}</td>
                    <td className="num">{money(s.totalAmount)}</td>
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
                <td colSpan={6} className="empty">
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

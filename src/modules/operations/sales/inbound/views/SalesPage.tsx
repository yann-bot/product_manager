import type { Sale } from "../../core/sales.entities";
import { money, formatDateTime } from "../../../../../shared/format";

export type SaleStatusFilter = "all" | "completed" | "cancelled";

// Préréglage calendaire (heure locale serveur) : « Tout » (pas de borne),
// le mois en cours, la semaine en cours (lundi→) ou aujourd'hui.
export type SalePeriod = "all" | "day" | "week" | "month";

// Comment la fenêtre temporelle a été choisie : un préréglage (onglets),
// un mois précis (sélecteur), ou un intervalle de dates personnalisé.
export type DateMode = "preset" | "month" | "interval";

/**
 * Fenêtre temporelle active de la page, déjà résolue côté controller. La
 * vue n'en lit que des chaînes (pré-remplissage des champs + surlignage) ;
 * le calcul des bornes Date et le filtrage restent côté controller.
 */
export interface DateScope {
  mode: DateMode;
  /** Préréglage actif quand mode === "preset". */
  period: SalePeriod;
  /** « YYYY-MM » pré-rempli du sélecteur de mois (mode "month"). */
  month: string;
  /** « YYYY-MM-DD » pré-remplis de l'intervalle (mode "interval"). */
  from: string;
  to: string;
  /** Libellé lisible de la fenêtre affichée (ex. « mars 2026 »). */
  label: string;
}

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

const PERIODS: { key: SalePeriod; label: string }[] = [
  { key: "all", label: "Tout" },
  { key: "month", label: "Ce mois-ci" },
  { key: "week", label: "Cette semaine" },
  { key: "day", label: "Aujourd'hui" },
];

/** UC-02 — Liste des ventes (CA, filtre statut, recherche, pagination). */
export function SalesPage({ sales, filter, scope, counts, revenue, productNameById }: SalesPageProps) {
  // Query string de la fenêtre temporelle active : on la reconduit sur les
  // liens de statut pour ne pas perdre la sélection de dates (statut et
  // fenêtre sont orthogonaux). Seuls les params du mode actif sont émis.
  const dateQuery = () => {
    const p = new URLSearchParams();
    if (scope.mode === "month") p.set("month", scope.month);
    else if (scope.mode === "interval") {
      if (scope.from) p.set("from", scope.from);
      if (scope.to) p.set("to", scope.to);
    } else p.set("period", scope.period);
    return p.toString();
  };
  // Lien d'un onglet de statut : conserve la fenêtre temporelle courante.
  const statusHref = (s: SaleStatusFilter) => `/sales/view?status=${s}&${dateQuery()}`;
  // Lien d'un préréglage : conserve le statut, repasse en mode "preset".
  const presetHref = (per: SalePeriod) => `/sales/view?status=${filter}&period=${per}`;
  const isPreset = scope.mode === "preset";

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
        <div className="datebar">
          <div className="nav">
            {PERIODS.map((p) => (
              <a
                key={p.key}
                href={presetHref(p.key)}
                className={isPreset && scope.period === p.key ? "active" : ""}
              >
                {p.label}
              </a>
            ))}
          </div>

          {/* Mois précis : ?month=YYYY-MM. */}
          <form className="datefilter" method="get" action="/sales/view">
            <input type="hidden" name="status" defaultValue={filter} />
            <label>
              Mois
              <input type="month" name="month" defaultValue={scope.month} />
            </label>
            <button className="btn" type="submit">Voir</button>
          </form>

          {/* Intervalle personnalisé : ?from=YYYY-MM-DD&to=YYYY-MM-DD. */}
          <form className="datefilter" method="get" action="/sales/view">
            <input type="hidden" name="status" defaultValue={filter} />
            <label>
              Du
              <input type="date" name="from" defaultValue={scope.from} />
            </label>
            <label>
              au
              <input type="date" name="to" defaultValue={scope.to} />
            </label>
            <button className="btn" type="submit">Appliquer</button>
          </form>
        </div>

        <div className="datebar-label muted">
          Fenêtre affichée : <strong>{scope.label}</strong>
        </div>

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

import { FiCheckCircle } from "react-icons/fi";
import type {
  PendingGroup,
  ReconciliationCounts,
} from "../../core/reconciliation.service";
import { money } from "../../../../../shared/format";

/** Produit interne proposé au mapping (actif). */
export interface ProductOption {
  id: string;
  name: string;
}

interface ReconciliationPageProps {
  groups: PendingGroup[];
  counts: ReconciliationCounts;
  /** Produits internes actifs (cible du mapping). */
  products: ProductOption[];
  /** Message d'erreur éventuel (validation). */
  error?: string;
}

/**
 * Écran de réconciliation manuelle. Chaque ligne = un NOM de produit
 * EasySell encore en attente : on lui choisit un produit interne et on
 * réconcilie toutes ses ventes d'un coup (+ mapping mémorisé).
 */
export function ReconciliationPage({ groups, counts, products, error }: ReconciliationPageProps) {
  const noProducts = products.length === 0;

  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Ventes à réconcilier</div>
          <div className="v accent">{counts.pendingSales}</div>
        </div>
        <div className="card">
          <div className="k">Noms à mapper</div>
          <div className="v">{counts.pendingNames}</div>
        </div>
        <div className="card">
          <div className="k">Réconciliées</div>
          <div className="v">{counts.reconciledSales}</div>
        </div>
      </div>

      <div className="wrap">
        {error ? <div className="alert">{error}</div> : null}

        {noProducts ? (
          <div className="alert">
            Aucun produit interne actif. Créez d'abord un produit pour pouvoir
            réconcilier. <a className="link" href="/products/new">+ Ajouter un produit</a>
          </div>
        ) : null}

        {groups.length === 0 ? (
          <div className="detail">
            <div className="row">
              <span className="val" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <FiCheckCircle style={{ flex: "0 0 auto", color: "#2f9e5b" }} />
                Toutes les ventes EasySell sont réconciliées.
              </span>
            </div>
          </div>
        ) : (
          <>
            <input
              className="filter"
              type="search"
              data-filter="#reconcile-table"
              placeholder="Filtrer (nom de produit EasySell…)"
              autoComplete="off"
            />
            <table id="reconcile-table" data-page-size="15">
              <thead>
                <tr>
                  <th>Produit EasySell</th>
                  <th className="num">Ventes</th>
                  <th className="num">Montant</th>
                  <th>Produit interne</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.productName}>
                    <td className="strong">{g.productName}</td>
                    <td className="num">{g.count}</td>
                    <td className="num">{money(g.totalAmount)}</td>
                    <td>
                      <form
                        method="post"
                        action="/reconciliation/reconcile"
                        style={{ display: "flex", gap: "8px", margin: 0, alignItems: "center" }}
                      >
                        <input type="hidden" name="productName" value={g.productName} />
                        <select name="productId" defaultValue="" required disabled={noProducts}>
                          <option value="" disabled>
                            — Choisir —
                          </option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-primary" type="submit" disabled={noProducts}>
                          Réconcilier
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

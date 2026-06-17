import type { Product } from "../../core/product.entities";
import { money } from "../../../../../shared/format";

type StatusFilter = "all" | "active" | "archived";

interface ProductsPageProps {
  products: Product[];
  /** Filtre de statut courant (onglet « Actif / Archivé »). */
  filter: StatusFilter;
  /** Compteurs tous statuts confondus (indépendants du filtre). */
  counts: { all: number; active: number; archived: number };
}

const margin = (p: Product): number | null =>
  p.sellingPrice !== null && p.defaultCostPrice !== null
    ? p.sellingPrice - p.defaultCostPrice
    : null;

const TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "archived", label: "Archivés" },
];

/** UC-02 — Liste du catalogue produit (recherche, filtre statut, pagination). */
export function ProductsPage({ products, filter, counts }: ProductsPageProps) {
  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Produits</div>
          <div className="v">{counts.all}</div>
        </div>
        <div className="card">
          <div className="k">Actifs</div>
          <div className="v accent">{counts.active}</div>
        </div>
        <div className="card">
          <div className="k">Archivés</div>
          <div className="v">{counts.archived}</div>
        </div>
      </div>

      <div className="wrap">
        <div className="toolbar">
          <div className="nav">
            {TABS.map((t) => (
              <a
                key={t.key}
                href={`/products/view?status=${t.key}`}
                className={filter === t.key ? "active" : ""}
              >
                {t.label}
              </a>
            ))}
          </div>
          <a className="btn btn-primary" href="/products/new">
            + Ajouter
          </a>
        </div>

        <input
          className="filter"
          type="search"
          data-filter="#products-table"
          placeholder="Filtrer (nom, description…)"
          autoComplete="off"
        />
        <table id="products-table" data-page-size="10">
          <thead>
            <tr>
              <th>Nom</th>
              <th className="num">Prix de vente</th>
              <th className="num">Prix de revient (défaut)</th>
              <th className="num">Marge brute</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length > 0 ? (
              products.map((p) => {
                const m = margin(p);
                return (
                  <tr key={p.id}>
                    <td className="strong">{p.name}</td>
                    <td className="num">
                      {p.sellingPrice !== null ? money(p.sellingPrice) : "—"}
                    </td>
                    <td className="num">
                      {p.defaultCostPrice !== null ? money(p.defaultCostPrice) : "—"}
                    </td>
                    <td className="num">{m !== null ? money(m) : "—"}</td>
                    <td>
                      <span
                        className={`tag ${p.status === "active" ? "tag-active" : ""}`}
                      >
                        {p.status === "active" ? "Actif" : "Archivé"}
                      </span>
                    </td>
                    <td>
                      <a className="link" href={`/products/${p.id}/view`}>
                        Détail
                      </a>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="empty">
                  Aucun produit dans cette vue.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

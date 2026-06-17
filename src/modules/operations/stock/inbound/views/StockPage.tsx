import type { ProductStock } from "../../core/stock.entities";

interface StockPageProps {
  stocks: ProductStock[];
  summary: { trackedProducts: number; totalUnits: number; outOfStock: number };
}

/** Stock courant par produit (dérivé). Badge « rupture » si ≤ 0. */
export function StockPage({ stocks, summary }: StockPageProps) {
  return (
    <>
      <div className="cards">
        <div className="card">
          <div className="k">Produits suivis</div>
          <div className="v">{summary.trackedProducts}</div>
        </div>
        <div className="card">
          <div className="k">Unités en stock</div>
          <div className="v accent">{summary.totalUnits}</div>
        </div>
        <div className="card">
          <div className="k">Ruptures</div>
          <div className="v">{summary.outOfStock}</div>
        </div>
      </div>

      <div className="wrap">
        <div className="toolbar">
          <div className="nav">
            <a href="/stock/movements">Historique des mouvements</a>
          </div>
          <a className="btn btn-primary" href="/stock/movements/new">
            + Mouvement
          </a>
        </div>

        <input
          className="filter"
          type="search"
          data-filter="#stock-table"
          placeholder="Filtrer (produit…)"
          autoComplete="off"
        />
        <table id="stock-table" data-page-size="10">
          <thead>
            <tr>
              <th>Produit</th>
              <th>Statut</th>
              <th className="num">Stock courant</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {stocks.length > 0 ? (
              stocks.map((s) => {
                const low = s.quantity <= 0;
                return (
                  <tr key={s.productId}>
                    <td className="strong">{s.productName}</td>
                    <td>
                      <span className={`tag ${s.status === "active" ? "tag-active" : ""}`}>
                        {s.status === "active" ? "Actif" : "Archivé"}
                      </span>
                    </td>
                    <td className="num">
                      <span style={low ? { color: "#f87171", fontWeight: 600 } : undefined}>
                        {s.quantity}
                      </span>
                      {low ? <span className="tag" style={{ marginLeft: 8, borderColor: "#f87171", color: "#fca5a5" }}>rupture</span> : null}
                    </td>
                    <td>
                      <a className="link" href={`/stock/${s.productId}/view`}>
                        Détail
                      </a>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="empty">
                  Aucun produit. <a className="link" href="/products/new">Ajouter un produit</a>.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

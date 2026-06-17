import { FiArrowLeft } from "react-icons/fi";
import type { StockMovement, StockMovementType } from "../../core/stock.entities";
import { formatDateTime } from "../../../../../shared/format";

interface StockMovementsPageProps {
  movements: StockMovement[];
  productNameById: Record<string, string>;
}

const TYPE_LABEL: Record<StockMovementType, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
};

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Historique global des mouvements de stock (tous produits). */
export function StockMovementsPage({ movements, productNameById }: StockMovementsPageProps) {
  return (
    <div className="wrap">
      <div className="toolbar">
        <div className="nav">
          <a href="/stock/view"><FiArrowLeft style={{ verticalAlign: "-2px" }} /> Niveaux de stock</a>
        </div>
        <a className="btn btn-primary" href="/stock/movements/new">+ Mouvement</a>
      </div>

      <input
        className="filter"
        type="search"
        data-filter="#movements-table"
        placeholder="Filtrer (produit, type, note…)"
        autoComplete="off"
      />
      <table id="movements-table" data-page-size="20">
        <thead>
          <tr>
            <th>Date</th>
            <th>Produit</th>
            <th>Type</th>
            <th className="num">Quantité</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {movements.length > 0 ? (
            movements.map((m) => (
              <tr key={m.id}>
                <td>{formatDateTime(m.createdAt)}</td>
                <td className="strong">{productNameById[m.productId] ?? "—"}</td>
                <td>{TYPE_LABEL[m.type]}</td>
                <td className="num">
                  <span style={m.quantity < 0 ? { color: "#f87171" } : undefined}>
                    {signed(m.quantity)}
                  </span>
                </td>
                <td className="muted">{m.note ? m.note : "—"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} className="empty">Aucun mouvement enregistré.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

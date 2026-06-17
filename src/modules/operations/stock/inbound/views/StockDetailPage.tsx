import type { StockMovement, StockMovementType } from "../../core/stock.entities";
import { formatDateTime } from "../../../../../shared/format";

interface StockDetailPageProps {
  productId: string;
  productName: string;
  currentStock: number;
  movements: StockMovement[];
}

const TYPE_LABEL: Record<StockMovementType, string> = {
  in: "Entrée",
  out: "Sortie",
  adjustment: "Ajustement",
};

/** Delta signé lisible : +10, −3, 0. */
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** UC — Détail du stock d'un produit + historique de ses mouvements. */
export function StockDetailPage({ productId, productName, currentStock, movements }: StockDetailPageProps) {
  const low = currentStock <= 0;

  return (
    <div className="wrap">
      <div className="nav">
        <a href="/stock/view">← Retour au stock</a>
      </div>

      <div className="cards">
        <div className="card">
          <div className="k">{productName}</div>
          <div className="v" style={low ? { color: "#f87171" } : { color: "#38bdf8" }}>
            {currentStock}
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div />
        <a className="btn btn-primary" href={`/stock/movements/new?productId=${productId}`}>
          + Mouvement
        </a>
      </div>

      <table>
        <thead>
          <tr>
            <th>Date</th>
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
              <td colSpan={4} className="empty">Aucun mouvement pour ce produit.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

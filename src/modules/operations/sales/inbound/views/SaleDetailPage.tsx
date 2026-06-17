import { FiArrowLeft } from "react-icons/fi";
import type { Sale } from "../../core/sales.entities";
import { money, formatDateTime } from "../../../../../shared/format";

interface SaleDetailPageProps {
  sale: Sale;
  /** Nom du produit vendu (jointure faite côté controller). */
  productName: string;
}

/** UC-03 — Détail d'une vente + action d'annulation (UC-04). */
export function SaleDetailPage({ sale: s, productName }: SaleDetailPageProps) {
  const isCompleted = s.status === "completed";
  // COGS de référence : le recalculé (audit) s'il existe, sinon le snapshot.
  const effectiveCogs = s.cogsRecalculated ?? s.cogs;
  const margin = effectiveCogs !== null ? s.totalAmount - effectiveCogs : null;

  return (
    <div className="wrap">
      <div className="nav">
        <a href="/sales/view"><FiArrowLeft style={{ verticalAlign: "-2px" }} /> Retour aux ventes</a>
      </div>

      <div className="detail">
        <div className="row">
          <span className="lbl">Date</span>
          <span className="val">{formatDateTime(s.saleDate)}</span>
        </div>
        <div className="row">
          <span className="lbl">Statut</span>
          <span className="val">
            <span className={`tag ${isCompleted ? "tag-active" : ""}`}>
              {isCompleted ? "Complété" : "Annulé"}
            </span>
          </span>
        </div>
        <div className="row">
          <span className="lbl">Produit</span>
          <span className="val strong">{productName}</span>
        </div>
        <div className="row">
          <span className="lbl">Quantité</span>
          <span className="val">{s.quantity}</span>
        </div>
        <div className="row">
          <span className="lbl">Prix unitaire</span>
          <span className="val">{money(s.unitPrice)}</span>
        </div>
        <div className="row">
          <span className="lbl">Montant total</span>
          <span className="val strong">{money(s.totalAmount)}</span>
        </div>
        <div className="row">
          <span className="lbl">Coût (COGS)</span>
          <span className="val">
            {effectiveCogs !== null ? money(effectiveCogs) : "— (non valorisé)"}
            {s.shortfallQuantity > 0 ? (
              <span className="tag" style={{ marginLeft: 8 }}>
                {s.shortfallQuantity} à découvert
              </span>
            ) : null}
          </span>
        </div>
        <div className="row">
          <span className="lbl">Marge</span>
          <span className="val strong">
            {margin !== null ? money(margin) : "—"}
          </span>
        </div>
        <div className="row">
          <span className="lbl">Notes</span>
          <span className="val muted">{s.notes ? s.notes : "—"}</span>
        </div>
        <div className="row">
          <span className="lbl">Créé le</span>
          <span className="val muted">{formatDateTime(s.createdAt)}</span>
        </div>
        <div className="row">
          <span className="lbl">Modifié le</span>
          <span className="val muted">{formatDateTime(s.updatedAt)}</span>
        </div>
      </div>

      {isCompleted ? (
        // UC-04 / RM-06 : annuler retire la vente du chiffre d'affaires.
        <div className="actions">
          <form method="post" action={`/sales/${s.id}/cancel`}>
            <button className="btn btn-danger" type="submit">
              Annuler la vente
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

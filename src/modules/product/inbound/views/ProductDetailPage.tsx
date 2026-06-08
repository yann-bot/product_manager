import type { Product } from "../../core/product.entities";
import { money, formatDateTime } from "../../../../shared/format";

interface ProductDetailPageProps {
  product: Product;
}

const margin = (p: Product): number | null =>
  p.sellingPrice !== null && p.costPrice !== null
    ? p.sellingPrice - p.costPrice
    : null;

/** UC-03 — Détail d'un produit + actions (modifier, archiver). */
export function ProductDetailPage({ product: p }: ProductDetailPageProps) {
  const m = margin(p);
  const isActive = p.status === "active";

  return (
    <div className="wrap">
      <div className="nav">
        <a href="/products/view">← Retour au catalogue</a>
      </div>

      <div className="detail">
        <div className="row">
          <span className="lbl">Nom</span>
          <span className="val strong">{p.name}</span>
        </div>
        <div className="row">
          <span className="lbl">Statut</span>
          <span className="val">
            <span className={`tag ${isActive ? "tag-active" : ""}`}>
              {isActive ? "Actif" : "Archivé"}
            </span>
          </span>
        </div>
        <div className="row">
          <span className="lbl">Prix de vente</span>
          <span className="val">{p.sellingPrice !== null ? money(p.sellingPrice) : "—"}</span>
        </div>
        <div className="row">
          <span className="lbl">Prix d'achat</span>
          <span className="val">{p.costPrice !== null ? money(p.costPrice) : "—"}</span>
        </div>
        <div className="row">
          <span className="lbl">Marge brute</span>
          <span className="val">{m !== null ? money(m) : "—"}</span>
        </div>
        <div className="row">
          <span className="lbl">Description</span>
          <span className="val muted">{p.description ? p.description : "—"}</span>
        </div>
        <div className="row">
          <span className="lbl">Créé le</span>
          <span className="val muted">{formatDateTime(p.createdAt)}</span>
        </div>
        <div className="row">
          <span className="lbl">Modifié le</span>
          <span className="val muted">{formatDateTime(p.updatedAt)}</span>
        </div>
      </div>

      <div className="actions">
        <a className="btn btn-primary" href={`/products/${p.id}/edit`}>
          Modifier
        </a>
        {isActive ? (
          // RM-05 : archiver retire du catalogue actif sans suppression.
          <form method="post" action={`/products/${p.id}/archive`}>
            <button className="btn btn-danger" type="submit">
              Archiver
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

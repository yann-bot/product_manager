import { money } from "../../../../shared/format";

/** Produit vendable (actif + prix de vente défini) proposé au choix. */
export interface SellableProduct {
  id: string;
  name: string;
  sellingPrice: number;
}

interface SalesFormValues {
  productId?: string;
  quantity?: number | string | null;
  notes?: string | null;
}

interface SalesFormPageProps {
  /** Cible du POST (formulaire HTML, méthode=post). */
  action: string;
  /** Produits sélectionnables (déjà filtrés : actifs avec prix). */
  products: SellableProduct[];
  /** Valeurs ressaisies après une erreur de validation. */
  values?: SalesFormValues;
  /** Message d'erreur à afficher en tête de formulaire. */
  error?: string;
}

const str = (v: string | null | undefined) => (v === null || v === undefined ? "" : v);
const numStr = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** UC-01 — Formulaire de création d'une vente. */
export function SalesFormPage({ action, products, values, error }: SalesFormPageProps) {
  const v = values ?? {};

  // Sans produit vendable, la vente est impossible (RM-03) : on guide
  // le marchand vers la création d'un produit plutôt qu'un form vide.
  if (products.length === 0) {
    return (
      <div className="wrap">
        <div className="alert">
          Aucun produit vendable. Ajoutez d'abord un produit avec un prix de vente.
        </div>
        <div className="actions">
          <a className="btn btn-primary" href="/products/new">
            + Ajouter un produit
          </a>
          <a className="btn" href="/sales/view">
            Retour aux ventes
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <form className="form" method="post" action={action}>
        {error ? <div className="alert">{error}</div> : null}

        <div className="field">
          <label htmlFor="productId">Produit *</label>
          <select id="productId" name="productId" defaultValue={str(v.productId)} required>
            <option value="" disabled>
              — Choisir un produit —
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.sellingPrice)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantité *</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue={numStr(v.quantity)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} defaultValue={str(v.notes)} />
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit">
            Créer la vente
          </button>
          <a className="btn" href="/sales/view">
            Annuler
          </a>
        </div>
      </form>
    </div>
  );
}

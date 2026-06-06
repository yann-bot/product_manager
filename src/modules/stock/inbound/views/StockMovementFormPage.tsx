import type { StockMovementType } from "../../core/stock.entities";

export interface StockProductOption {
  id: string;
  name: string;
}

interface FormValues {
  productId?: string;
  type?: StockMovementType;
  quantity?: number | string | null;
  note?: string | null;
}

interface StockMovementFormPageProps {
  action: string;
  products: StockProductOption[];
  /** Produit présélectionné (depuis la page détail). */
  defaultProductId?: string;
  values?: FormValues;
  error?: string;
}

const str = (v: string | null | undefined) => (v ?? "");
const numStr = (v: number | string | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

const TYPE_OPTIONS: { value: StockMovementType; label: string }[] = [
  { value: "in", label: "Entrée (réapprovisionnement)" },
  { value: "out", label: "Sortie (perte, casse, manuel)" },
  { value: "adjustment", label: "Ajustement (nouveau stock compté)" },
];

/** Formulaire d'enregistrement d'un mouvement de stock. */
export function StockMovementFormPage({
  action,
  products,
  defaultProductId,
  values,
  error,
}: StockMovementFormPageProps) {
  const v = values ?? {};
  const selectedProduct = v.productId ?? defaultProductId ?? "";

  if (products.length === 0) {
    return (
      <div className="wrap">
        <div className="alert">
          Aucun produit. Créez d'abord un produit pour enregistrer un mouvement.
        </div>
        <div className="actions">
          <a className="btn btn-primary" href="/products/new">+ Ajouter un produit</a>
          <a className="btn" href="/stock/view">Retour au stock</a>
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
          <select id="productId" name="productId" defaultValue={selectedProduct} required>
            <option value="" disabled>— Choisir un produit —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="type">Type de mouvement *</label>
          <select id="type" name="type" defaultValue={v.type ?? "in"} required>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="quantity">Quantité *</label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min="0"
            step="1"
            defaultValue={numStr(v.quantity)}
            required
          />
          <span className="sub" style={{ marginTop: 4 }}>
            Entrée / Sortie : quantité à ajouter / retirer. Ajustement : nouveau stock compté.
          </span>
        </div>

        <div className="field">
          <label htmlFor="note">Note</label>
          <textarea id="note" name="note" rows={2} defaultValue={str(v.note)} />
        </div>

        <div className="actions">
          <button className="btn btn-primary" type="submit">Enregistrer</button>
          <a className="btn" href="/stock/view">Annuler</a>
        </div>
      </form>
    </div>
  );
}

interface ProductFormValues {
  name?: string;
  description?: string | null;
  sellingPrice?: number | null;
  costPrice?: number | null;
  status?: "active" | "archived";
}

interface ProductFormPageProps {
  mode: "create" | "edit";
  /** Cible du POST (formulaire HTML, méthode=post). */
  action: string;
  /** Valeurs pré-remplies (édition) ou ressaisies après erreur. */
  values?: ProductFormValues;
  /** Message d'erreur de validation à afficher en tête de formulaire. */
  error?: string;
}

const str = (v: string | null | undefined) => (v === null || v === undefined ? "" : v);
const num = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

/** UC-01 / UC-04 — Formulaire de création / édition d'un produit. */
export function ProductFormPage({ mode, action, values, error }: ProductFormPageProps) {
  const v = values ?? {};
  return (
    <div className="wrap">
      <form className="form" method="post" action={action}>
        {error ? <div className="alert">{error}</div> : null}

        <div className="field">
          <label htmlFor="name">Nom *</label>
          <input id="name" name="name" type="text" defaultValue={str(v.name)} required />
        </div>

        <div className="field">
          <label htmlFor="sellingPrice">Prix de vente (FCFA) *</label>
          <input
            id="sellingPrice"
            name="sellingPrice"
            type="number"
            min="1"
            step="1"
            defaultValue={num(v.sellingPrice)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="costPrice">Prix d'achat (FCFA)</label>
          <input
            id="costPrice"
            name="costPrice"
            type="number"
            min="0"
            step="1"
            defaultValue={num(v.costPrice)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={3} defaultValue={str(v.description)} />
        </div>

        {mode === "edit" ? (
          <div className="field">
            <label htmlFor="status">Statut</label>
            <select id="status" name="status" defaultValue={v.status ?? "active"}>
              <option value="active">Actif</option>
              <option value="archived">Archivé</option>
            </select>
          </div>
        ) : null}

        <div className="actions">
          <button className="btn btn-primary" type="submit">
            {mode === "create" ? "Créer le produit" : "Enregistrer"}
          </button>
          <a className="btn" href="/products/view">
            Annuler
          </a>
        </div>
      </form>
    </div>
  );
}

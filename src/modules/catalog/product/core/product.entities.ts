

export type Product = {
  id: string;
  name: string;
  description: string | null;
  sellingPrice: number | null;
  // Coût de revient PAR DÉFAUT (repli), pas le prix d'achat de référence :
  // le vrai coût d'un produit vit par lot sur stock_movements.unit_cost et
  // est rejoué en FIFO (module costing). Ce champ ne sert que de repli — coût
  // d'une vente à découvert (aucun lot) et pré-remplissage d'une entrée de
  // stock sans coût saisi. Mappé sur la colonne `cost_price` (inchangée).
  defaultCostPrice: number | null;
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
};


// Statut par défaut d'un produit à la création (laisser `status`
// absent du DTO => "active"). Source unique de vérité, à réutiliser
// côté schéma (default colonne) et service.
export const DEFAULT_PRODUCT_STATUS: Product["status"] = "active";

export type CreateProductDTO = {
  name: string;
  description?: string;
  sellingPrice?: number;
  defaultCostPrice?: number;
  // Optionnel : si absent, vaut DEFAULT_PRODUCT_STATUS ("active").
  status?: "active" | "archived";
};

export type UpdateProductDTO = Partial<CreateProductDTO>;

export interface ProductRepository {
  findAll(): Promise<Product[]>;
  findById(id: string): Promise<Product | null>;
  create(product: CreateProductDTO): Promise<Product>;
  update( id: string, updates: UpdateProductDTO, ): Promise<Product>;
  // Archivage : passe le produit au statut "archived" sans
  // supprimer son historique (RM-04). Retourne le produit archivé.
  archive(id: string): Promise<Product>;
}
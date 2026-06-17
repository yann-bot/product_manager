import { NotFoundError, ValidationError } from "../../../../shared/errors";
import {
  DEFAULT_PRODUCT_STATUS,
  type CreateProductDTO,
  type Product,
  type ProductRepository,
  type UpdateProductDTO,
} from "./product.entities";

//
// ======================================================
// Use-cases du contexte PRODUCT (catalogue produit).
// ======================================================
// Source de vérité des règles métier (canvas « Module Produit »):
//   RM-01 : le nom est obligatoire.
//   RM-02 : le prix de vente doit être > 0.
//   RM-04 : l'archivage ne supprime jamais l'historique.
// Les invariants vivent ici (core), indépendamment du transport
// (REST/HTML) et de la persistance (Drizzle).
// ======================================================
//

export class ProductService {
  constructor(private readonly repo: ProductRepository) {}

  findAll(): Promise<Product[]> {
    return this.repo.findAll();
  }

  /** Détail d'un produit. Lève NotFoundError si l'id n'existe pas. */
  async findById(id: string): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new NotFoundError(`Produit introuvable : ${id}`);
    return product;
  }

  /** UC-01 — Crée un produit. Applique le statut par défaut ("active"). */
  create(input: CreateProductDTO): Promise<Product> {
    const name = requireName(input.name);
    const sellingPrice = requireSellingPrice(input.sellingPrice);
    const costPrice = checkCostPrice(input.costPrice);

    return this.repo.create({
      name,
      description: input.description?.trim() || undefined,
      sellingPrice,
      costPrice,
      status: input.status ?? DEFAULT_PRODUCT_STATUS,
    });
  }

  /** UC-04 — Met à jour un produit. Ne valide que les champs fournis. */
  update(id: string, updates: UpdateProductDTO): Promise<Product> {
    const clean: UpdateProductDTO = { ...updates };

    if (updates.name !== undefined) clean.name = requireName(updates.name);
    if (updates.sellingPrice !== undefined)
      clean.sellingPrice = requireSellingPrice(updates.sellingPrice);
    if (updates.costPrice !== undefined)
      clean.costPrice = checkCostPrice(updates.costPrice);
    if (updates.description !== undefined)
      clean.description = updates.description?.trim() || undefined;

    return this.repo.update(id, clean);
  }

  /** UC-05 — Archive un produit (statut "archived"), sans perte d'historique (RM-04). */
  archive(id: string): Promise<Product> {
    return this.repo.archive(id);
  }
}

// --- Invariants métier (réutilisés par create/update) ---

function requireName(name: string | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) throw new ValidationError("Le nom du produit est obligatoire."); // RM-01
  return trimmed;
}

function requireSellingPrice(price: number | undefined): number {
  if (price === undefined || Number.isNaN(price))
    throw new ValidationError("Le prix de vente est obligatoire.");
  if (price <= 0)
    throw new ValidationError("Le prix de vente doit être supérieur à zéro."); // RM-02
  return price;
}

function checkCostPrice(price: number | undefined): number | undefined {
  if (price === undefined) return undefined;
  if (Number.isNaN(price) || price < 0)
    throw new ValidationError("Le prix de revient ne peut pas être négatif.");
  return price;
}

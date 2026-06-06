import { NotFoundError, ValidationError } from "../../../shared/errors";
import type { Product, ProductRepository } from "../../product/core/product.entities";
import {
  DEFAULT_SALE_STATUS,
  type CreateSaleDTO,
  type Sale,
  type SalesRepository,
  type StockLedger,
} from "./sales.entities";

//
// ======================================================
// Use-cases du contexte SALES (ventes internes).
// ======================================================
// Source de vérité des règles métier (canvas « Module Sales ») :
//   RM-01 : une vente porte sur un produit (obligatoire).
//   RM-02 : la quantité doit être > 0.
//   RM-03 : le prix unitaire est lu sur le produit AU MOMENT de la vente.
//   RM-04 : total ligne = quantité × prix unitaire.
//   RM-05 : montant total de la vente = somme (ici, l'unique ligne).
//   RM-06 : une vente annulée ne participe plus au chiffre d'affaires.
// Le service dépend du port ProductRepository (catalogue) pour résoudre
// le prix : la dépendance Sale -> Product est inhérente (RM-03).
// ======================================================
//

export class SalesService {
  constructor(
    private readonly repo: SalesRepository,
    private readonly products: ProductRepository,
    private readonly stock: StockLedger,
  ) {}

  findAll(): Promise<Sale[]> {
    return this.repo.findAll();
  }

  /** UC-03 — Détail d'une vente. Lève NotFoundError si l'id n'existe pas. */
  async findById(id: string): Promise<Sale> {
    const sale = await this.repo.findById(id);
    if (!sale) throw new NotFoundError(`Vente introuvable : ${id}`);
    return sale;
  }

  /**
   * UC-01 — Crée une vente. Lit le prix sur le produit (RM-03), calcule
   * les totaux (RM-04/RM-05) et applique le statut par défaut ("completed").
   */
  async create(input: CreateSaleDTO): Promise<Sale> {
    const quantity = requireQuantity(input.quantity);

    const product = await this.products.findById(input.productId); // RM-01
    if (!product)
      throw new NotFoundError(`Produit introuvable : ${input.productId}`);

    const unitPrice = requireSellablePrice(product); // RM-03
    const totalAmount = quantity * unitPrice; // RM-04/RM-05

    const sale = await this.repo.create({
      productId: product.id,
      quantity,
      unitPrice,
      totalAmount,
      notes: input.notes?.trim() || undefined,
      status: DEFAULT_SALE_STATUS,
      saleDate: new Date(),
    });

    // Intégration Stock : une vente sort le produit du stock (best-effort
    // séquentiel — la vente est déjà persistée).
    await this.stock.recordSaleOut({
      productId: sale.productId,
      quantity: sale.quantity,
      saleId: sale.id,
    });

    return sale;
  }

  /** UC-04 — Annule une vente (RM-06). Idempotence refusée : double annulation = erreur. */
  async cancel(id: string): Promise<Sale> {
    const sale = await this.findById(id); // NotFoundError si absent
    if (sale.status === "cancelled")
      throw new ValidationError("Cette vente est déjà annulée.");

    const cancelled = await this.repo.cancel(id);

    // Intégration Stock : l'annulation restitue le stock (entrée compensatoire).
    await this.stock.reverseSale({
      productId: sale.productId,
      quantity: sale.quantity,
      saleId: sale.id,
    });

    return cancelled;
  }
}

// --- Invariants métier ---

function requireQuantity(quantity: number | undefined): number {
  if (quantity === undefined || Number.isNaN(quantity))
    throw new ValidationError("La quantité est obligatoire.");
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new ValidationError("La quantité doit être un entier supérieur à zéro."); // RM-02
  return quantity;
}

/** RM-03 — Le prix de vente est lu sur le produit ; il doit être défini et > 0. */
function requireSellablePrice(product: Product): number {
  const price = product.sellingPrice;
  if (price === null || price === undefined || Number.isNaN(price) || price <= 0)
    throw new ValidationError(
      `Le produit « ${product.name} » n'a pas de prix de vente : impossible de le vendre.`,
    );
  return price;
}

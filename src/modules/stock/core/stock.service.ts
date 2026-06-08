import { NotFoundError } from "../../../shared/errors";
import type { ProductRepository } from "../../product/core/product.entities";
import { computeDelta } from "./movement";
import type {
  CreateMovementDTO,
  ProductStock,
  StockMovement,
  StockMovementRepository,
} from "./stock.entities";

//
// ======================================================
// Use-cases du contexte STOCK.
// ======================================================
// Le stock est DÉRIVÉ : on n'écrit que des mouvements (delta signé), le
// niveau se lit via SUM. `record` valide la saisie (movement.ts) et résout
// le delta ; pour un ajustement, on lit le stock courant (cible − courant).
//
// `recordSaleOut` / `reverseSale` sont la surface utilisée par le module
// Sales (sortie auto à la vente, entrée compensatoire à l'annulation).
// Aucun blocage de stock négatif : une vente doit toujours aboutir.
// ======================================================
//

export class StockService {
  constructor(
    private readonly repo: StockMovementRepository,
    private readonly products: ProductRepository,
  ) {}

  /** Stock courant de tous les produits (dérivé). */
  stockByProduct(): Promise<ProductStock[]> {
    return this.repo.stockByProduct();
  }

  /** Stock courant d'un produit. */
  currentStockOf(productId: string): Promise<number> {
    return this.repo.currentStockOf(productId);
  }

  /** Historique des mouvements (optionnellement filtré par produit). */
  movements(productId?: string): Promise<StockMovement[]> {
    return this.repo.findAll(productId);
  }

  /** Enregistre un mouvement manuel (entrée / sortie / ajustement). */
  async record(input: CreateMovementDTO): Promise<StockMovement> {
    const product = await this.products.findById(input.productId);
    if (!product)
      throw new NotFoundError(`Produit introuvable : ${input.productId}`);

    // Le stock courant n'est nécessaire que pour l'ajustement (cible − courant).
    const current =
      input.type === "adjustment"
        ? await this.repo.currentStockOf(input.productId)
        : 0;
    const delta = computeDelta(input.type, input.quantity, current);

    return this.repo.create({
      productId: input.productId,
      type: input.type,
      quantity: delta,
      note: input.note?.trim() || undefined,
    });
  }

  /** Sortie automatique liée à une vente (qty vendue). Pas de blocage négatif. */
  async recordSaleOut(input: {
    productId: string;
    quantity: number;
    saleId: string;
  }): Promise<void> {
    const delta = computeDelta("out", input.quantity, 0); // −quantity
    await this.repo.create({
      productId: input.productId,
      type: "out",
      quantity: delta,
      note: "Vente",
      saleId: input.saleId,
    });
  }

  /** Entrée compensatoire quand une vente est annulée (restitue le stock). */
  async reverseSale(input: {
    productId: string;
    quantity: number;
    saleId: string;
  }): Promise<void> {
    const delta = computeDelta("in", input.quantity, 0); // +quantity
    await this.repo.create({
      productId: input.productId,
      type: "in",
      quantity: delta,
      note: "Annulation vente",
      saleId: input.saleId,
    });
  }
}

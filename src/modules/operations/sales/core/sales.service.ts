import { NotFoundError, ValidationError } from "../../../../shared/errors";
import type { Product, ProductRepository } from "../../../catalog/product/core/product.entities";
import {
  DEFAULT_SALE_STATUS,
  type CostingLedger,
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
    private readonly costing: CostingLedger,
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

    // Valorisation : fige le COGS FIFO (APRÈS la sortie, qui doit exister
    // pour être imputée aux lots).
    await this.costing.costSale({ saleId: sale.id, productId: sale.productId });

    return sale;
  }

  /**
   * UC-02 — Matérialise une vente interne à partir d'une vente EasySell
   * RÉCONCILIÉE. La vraie transaction a déjà eu lieu sur EasySell : on
   * privilégie donc le MONTANT EASYSELL réel (argent encaissé), avec repli
   * sur le prix catalogue, puis 0 en dernier recours (la vente doit exister
   * pour décrémenter le stock). Comme `create`, génère la sortie de stock.
   * La provenance `easysellSaleId` (UNIQUE en base) garantit l'idempotence.
   */
  async createFromEasySell(input: {
    productId: string;
    quantity: number;
    easysellSaleId: string;
    unitPrice: number | null;
    totalPrice: number | null;
    saleDate: Date | null;
  }): Promise<void> {
    const quantity = requireQuantity(input.quantity);

    const product = await this.products.findById(input.productId);
    if (!product)
      throw new NotFoundError(`Produit introuvable : ${input.productId}`);

    const { unitPrice, totalAmount } = resolveEasySellPricing(
      input,
      quantity,
      product,
    );

    const sale = await this.repo.create({
      productId: product.id,
      quantity,
      unitPrice,
      totalAmount,
      status: DEFAULT_SALE_STATUS,
      easysellSaleId: input.easysellSaleId,
      saleDate: input.saleDate ?? new Date(),
    });

    await this.stock.recordSaleOut({
      productId: sale.productId,
      quantity: sale.quantity,
      saleId: sale.id,
    });

    await this.costing.costSale({ saleId: sale.id, productId: sale.productId });
  }

  /** UC-04 — Annule une vente (RM-06). Idempotence refusée : double annulation = erreur. */
  async cancel(id: string): Promise<Sale> {
    const sale = await this.findById(id); // NotFoundError si absent
    if (sale.status === "cancelled")
      throw new ValidationError("Cette vente est déjà annulée.");

    const cancelled = await this.repo.cancel(id);

    // Intégration Stock : l'annulation restitue le stock (entrée compensatoire),
    // datée de l'annulation. On la cote au coût unitaire snapshot de la vente
    // (cogs/quantité) pour conserver la valeur sortie ; le costing la reprend
    // en FIFO au recalcul. Pas de re-valorisation de la vente annulée (hors CA).
    const reverseUnitCost =
      sale.cogs !== null && sale.quantity > 0
        ? sale.cogs / sale.quantity
        : undefined;
    await this.stock.reverseSale({
      productId: sale.productId,
      quantity: sale.quantity,
      saleId: sale.id,
      unitCost: reverseUnitCost,
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

/**
 * Prix d'une vente issue d'EasySell : montant réel EasySell d'abord (total,
 * sinon unitaire × qté), repli sur le prix catalogue, 0 en dernier recours.
 */
function resolveEasySellPricing(
  input: { unitPrice: number | null; totalPrice: number | null },
  quantity: number,
  product: Product,
): { unitPrice: number; totalAmount: number } {
  if (input.totalPrice != null && input.totalPrice > 0) {
    return { totalAmount: input.totalPrice, unitPrice: input.totalPrice / quantity };
  }
  if (input.unitPrice != null && input.unitPrice > 0) {
    return { unitPrice: input.unitPrice, totalAmount: input.unitPrice * quantity };
  }
  const p = product.sellingPrice;
  const unit = p != null && p > 0 ? p : 0;
  return { unitPrice: unit, totalAmount: unit * quantity };
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

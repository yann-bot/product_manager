import { replayFifo } from "./fifo";
import type { CostingRepository } from "./costing.entities";

//
// ======================================================
// Use-cases du contexte COSTING.
// ======================================================
// Deux usages du même moteur pur (`replayFifo`) :
//   - costSale   : SNAPSHOT figé à la vente (appelé par Sales après la sortie
//                  de stock). Satisfait structurellement le port CostingLedger.
//   - recalculate: RECALCUL auditable, rejeu du journal complet par produit.
// ======================================================
//

export class CostingService {
  constructor(private readonly repo: CostingRepository) {}

  /**
   * Fige le COGS d'une vente : rejeu FIFO du journal du produit jusqu'au
   * mouvement de sortie de la vente (inclus). Écrit cogs + découvert + la
   * ventilation par lot. À appeler APRÈS la sortie de stock (le 'out' doit
   * exister pour être imputé).
   */
  async costSale(input: { saleId: string; productId: string }): Promise<void> {
    const [events, fallbackCost] = await Promise.all([
      this.repo.eventsForProductUpToSale(input.productId, input.saleId),
      this.repo.fallbackCostOf(input.productId),
    ]);
    const result = replayFifo(events, { fallbackCost });
    const costing = result.perSale.get(input.saleId);
    if (!costing) return; // sortie de la vente introuvable : rien à figer.
    await this.repo.saveSnapshot({
      saleId: input.saleId,
      cogs: costing.cogs,
      shortfallQuantity: costing.shortfallQuantity,
      allocations: costing.allocations,
    });
  }

  /**
   * Recalcul auditable : rejoue le journal complet de chaque produit et écrit
   * le COGS recalculé de chaque vente. L'écart avec le snapshot (cogs) révèle
   * les découverts régularisés depuis. Idempotent.
   */
  async recalculateAll(): Promise<{ products: number; salesUpdated: number }> {
    const productIds = await this.repo.distinctProductIds();
    let salesUpdated = 0;
    for (const productId of productIds) {
      const [events, fallbackCost] = await Promise.all([
        this.repo.eventsForProduct(productId),
        this.repo.fallbackCostOf(productId),
      ]);
      const result = replayFifo(events, { fallbackCost });
      for (const costing of result.perSale.values()) {
        await this.repo.saveRecalculated(costing.saleId, costing.cogs);
        salesUpdated++;
      }
    }
    return { products: productIds.length, salesUpdated };
  }
}

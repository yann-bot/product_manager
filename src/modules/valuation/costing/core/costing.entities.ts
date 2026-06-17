//
// ======================================================
// CONTEXTE : COSTING (valorisation COGS en FIFO par lots)
// ======================================================
// Le coût des marchandises vendues (COGS) se DÉRIVE du journal de stock :
// chaque entrée 'in' porte le coût figé d'un lot (`unit_cost`), chaque vente
// 'out' consomme les lots du plus ancien au plus récent (FIFO). Le module ne
// stocke aucun coût propre : il rejoue le journal (cf. `fifo.ts`).
//
// Deux usages du MÊME moteur :
//   - snapshot : rejeu jusqu'à la vente -> COGS figé, immuable (à la vente).
//   - recalcul : rejeu du journal complet -> COGS d'audit (à la demande).
// ======================================================
//

// Un mouvement du journal d'UN produit, prêt pour le rejeu. `signedQty` est le
// delta tel que stocké (+ disponibilité, − consommation).
export interface LedgerEvent {
  movementId: string;
  saleId: string | null;
  kind: "in" | "out" | "adjustment";
  signedQty: number;
  unitCost: number | null;
  createdAt: Date;
}

export interface FifoConfig {
  /** Coût de repli d'une part à découvert sur produit sans lot connu. */
  fallbackCost: number;
}

// Imputation d'une vente sur un lot. `lotMovementId` null = part à découvert
// (cotée provisoirement, régularisée au recalcul).
export interface SaleAllocation {
  lotMovementId: string | null;
  quantity: number;
  unitCost: number;
}

// Valorisation d'une vente issue du rejeu.
export interface SaleCosting {
  saleId: string;
  quantity: number;
  cogs: number;
  shortfallQuantity: number;
  allocations: SaleAllocation[];
}

export interface LotRemainder {
  movementId: string;
  remaining: number;
  unitCost: number;
}

export interface FifoResult {
  perSale: Map<string, SaleCosting>;
  lotRemainders: LotRemainder[];
  /** Déficit global non résorbé en fin de parcours (somme des créances ouvertes). */
  residualShortfall: number;
}

// Snapshot persistable d'une vente (cogs + ventilation figés).
export interface SaleSnapshot {
  saleId: string;
  cogs: number;
  shortfallQuantity: number;
  allocations: SaleAllocation[];
}

// Port outbound : lecture du journal + coût de repli + écriture des valorisations.
export interface CostingRepository {
  /** Journal complet d'un produit, trié (created_at, id) croissant. */
  eventsForProduct(productId: string): Promise<LedgerEvent[]>;
  /** Journal d'un produit jusqu'au mouvement 'out' d'une vente (inclus). */
  eventsForProductUpToSale(productId: string,saleId: string,): Promise<LedgerEvent[]>;
  /** Produits ayant au moins un mouvement (pour le recalcul global). */
  distinctProductIds(): Promise<string[]>;
  /** Coût de repli (products.cost_price ?? 0) d'un produit. */
  fallbackCostOf(productId: string): Promise<number>;
  /** Fige le snapshot d'une vente (cogs + shortfall + ventilation). Immuable. */
  saveSnapshot(snapshot: SaleSnapshot): Promise<void>;
  /** Écrit le COGS recalculé (audit) d'une vente. */
  saveRecalculated(saleId: string, cogsRecalculated: number): Promise<void>;
}

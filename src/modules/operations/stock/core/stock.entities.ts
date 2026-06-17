//
// ======================================================
// CONTEXTE : STOCK (mouvements + niveau dérivé)
// ======================================================
// Le stock n'est jamais stocké comme une colonne : il se DÉRIVE des
// mouvements (SUM des deltas), comme les indicateurs Analytics. Les
// mouvements (`stock_movements`) sont l'unique source de vérité.
// ======================================================
//

export type StockMovementType = "in" | "out" | "adjustment";

// Source unique pour la validation (zod) et l'UI (select du formulaire).
export const MOVEMENT_TYPES: StockMovementType[] = ["in", "out", "adjustment"];

export type StockMovement = {
  id: string;
  productId: string;
  type: StockMovementType;
  /** Delta SIGNÉ appliqué au stock (in: +, out: −, adjustment: ±). */
  quantity: number;
  /**
   * Prix de revient unitaire du LOT (coût figé), sur les mouvements de
   * disponibilité (entrée / entrée compensatoire d'annulation) ; null sur une
   * consommation pure. Rejoué en FIFO par le module costing (cf. COGS).
   */
  unitCost: number | null;
  note: string | null;
  /** Vente interne à l'origine du mouvement (auto), sinon null. */
  saleId: string | null;
  /** Vente EasySell réconciliée à l'origine du mouvement, sinon null. */
  easysellSaleId: string | null;
  createdAt: Date;
};

// Entrée inbound (mouvement manuel). `quantity` = saisie du marchand :
//   - in / out    : quantité à ajouter / retirer (> 0)
//   - adjustment  : nouveau stock compté (cible, ≥ 0)
export type CreateMovementDTO = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  /** Prix de revient unitaire saisi (entrée 'in'). Absent => repli sur le
   *  coût du produit côté service. Ignoré pour 'out'. */
  unitCost?: number;
  note?: string;
};

// Ce que le repo persiste : delta déjà calculé (signé) + lien vente éventuel.
export type NewMovement = {
  productId: string;
  type: StockMovementType;
  quantity: number;
  /** Coût unitaire du lot (disponibilités). Null/absent sur une sortie. */
  unitCost?: number | null;
  note?: string;
  saleId?: string;
  easysellSaleId?: string;
};

// Read model dérivé : stock courant d'un produit.
export type ProductStock = {
  productId: string;
  productName: string;
  status: "active" | "archived";
  /** SUM des deltas des mouvements du produit. */
  quantity: number;
};

export interface StockMovementRepository {
  create(movement: NewMovement): Promise<StockMovement>;
  /** Historique, le plus récent d'abord ; filtrable par produit. */
  findAll(productId?: string): Promise<StockMovement[]>;
  /** Stock courant de TOUS les produits (LEFT JOIN, 0 si aucun mouvement). */
  stockByProduct(): Promise<ProductStock[]>;
  /** Stock courant d'un produit (SUM des deltas, 0 si aucun). */
  currentStockOf(productId: string): Promise<number>;
}

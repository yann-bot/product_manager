import { ValidationError } from "../../../shared/errors";
import type { StockMovementType } from "./stock.entities";

//
// ======================================================
// Cœur PUR du stock : la quantité saisie -> delta signé à stocker.
// ======================================================
// Testable sans DB. Le service appelle computeDelta puis insère le delta ;
// le stock courant = SUM des deltas.
//   - in         : +quantity        (quantity entier ≥ 1)
//   - out        : −quantity        (quantity entier ≥ 1)
//   - adjustment : cible − courant   (quantity = nouveau stock compté, ≥ 0)
// ======================================================
//

export function computeDelta(
  type: StockMovementType,
  quantity: number,
  currentStock: number,
): number {
  if (type === "adjustment") {
    const target = requireCount(quantity, { allowZero: true });
    return target - currentStock;
  }
  const qty = requireCount(quantity, { allowZero: false });
  return type === "in" ? qty : -qty;
}

function requireCount(quantity: number, opts: { allowZero: boolean }): number {
  if (quantity === undefined || Number.isNaN(quantity))
    throw new ValidationError("La quantité est obligatoire.");
  if (!Number.isInteger(quantity))
    throw new ValidationError("La quantité doit être un entier.");
  if (quantity < (opts.allowZero ? 0 : 1))
    throw new ValidationError(
      opts.allowZero
        ? "Le stock compté ne peut pas être négatif."
        : "La quantité doit être supérieure à zéro.",
    );
  return quantity;
}

import type {
  FifoConfig,
  FifoResult,
  LedgerEvent,
  LotRemainder,
  SaleAllocation,
  SaleCosting,
} from "./costing.entities";

//
// ======================================================
// Cœur PUR du costing : rejeu FIFO du journal -> COGS par vente.
// ======================================================
// Testable sans DB. Parcourt les mouvements d'UN produit DANS L'ORDRE
// chronologique stable (created_at, id) en maintenant deux files FIFO :
//   - `lots`       : restants de lots positifs (disponibilité), du + ancien ;
//   - `shortfalls` : créances à découvert (ventes non couvertes), du + ancien.
//
// Règle de résorption (spec §6) : une DISPONIBILITÉ éponge d'abord les
// créances à découvert les plus anciennes — en leur attribuant rétroactivement
// le coût RÉEL du lot — puis son reliquat devient un restant de lot. Une
// CONSOMMATION-vente épuise les lots FIFO ; sa part non couverte ouvre une
// créance cotée au dernier coût connu (sinon repli produit).
//
// Le COGS d'une vente n'est jamais lu sur un lot : c'est la somme de ses
// imputations (consolidation finale). Le prix de vente, lui, vit sur le
// produit (figé sur la vente côté module sales).
// ======================================================
//

// Créance à découvert ouverte. Référence l'allocation provisoire à régulariser
// (null pour une perte anonyme non rattachée à une vente).
interface ShortfallClaim {
  qty: number;
  costing: SaleCosting | null;
  provisional: SaleAllocation | null;
}

const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100;

export function replayFifo(
  events: LedgerEvent[],
  config: FifoConfig,
): FifoResult {
  const lots: LotRemainder[] = [];
  const shortfalls: ShortfallClaim[] = [];
  const perSale = new Map<string, SaleCosting>();
  let lastKnownCost: number | null = null;

  for (const ev of events) {
    if (ev.signedQty > 0) {
      // -------- DISPONIBILITÉ (entrée 'in', compensation d'annulation, ajust. +)
      // Annotation explicite : rompt l'inférence circulaire cost <-> lastKnownCost.
      const cost: number = ev.unitCost ?? lastKnownCost ?? config.fallbackCost;
      lastKnownCost = cost;
      let avail = ev.signedQty;

      // 1) Résorber d'abord les créances à découvert les plus anciennes.
      while (avail > 0 && shortfalls.length > 0) {
        const claim = shortfalls[0]!;
        const take = Math.min(avail, claim.qty);
        if (claim.costing && claim.provisional) {
          claim.provisional.quantity -= take; // réduit la part provisoire
          claim.costing.allocations.push({
            lotMovementId: ev.movementId, // attribue la part réelle (coût du lot)
            quantity: take,
            unitCost: cost,
          });
        }
        claim.qty -= take;
        avail -= take;
        if (claim.qty === 0) shortfalls.shift();
      }

      // 2) Le reliquat devient un restant de lot disponible pour le futur.
      if (avail > 0) {
        lots.push({ movementId: ev.movementId, remaining: avail, unitCost: cost });
      }
    } else if (ev.kind === "out" && ev.saleId !== null) {
      // -------- CONSOMMATION-VENTE : produit un COGS + une ventilation.
      const costing = getOrCreate(perSale, ev.saleId, -ev.signedQty);
      let need = -ev.signedQty;

      // 1) Consommer les restants de lots, du plus ancien au plus récent.
      while (need > 0 && lots.length > 0) {
        const lot = lots[0]!;
        const take = Math.min(need, lot.remaining);
        costing.allocations.push({
          lotMovementId: lot.movementId,
          quantity: take,
          unitCost: lot.unitCost,
        });
        lot.remaining -= take;
        need -= take;
        if (lot.remaining === 0) lots.shift();
      }

      // 2) Part non couverte : créance à découvert au coût PROVISOIRE.
      if (need > 0) {
        const provisional: SaleAllocation = {
          lotMovementId: null,
          quantity: need,
          unitCost: lastKnownCost ?? config.fallbackCost,
        };
        costing.allocations.push(provisional);
        shortfalls.push({ qty: need, costing, provisional });
      }
    } else if (ev.signedQty < 0) {
      // -------- DÉMARQUE (perte/casse : sortie manuelle ou ajustement −).
      // Déplète les lots SANS produire de COGS de vente.
      let need = -ev.signedQty;
      while (need > 0 && lots.length > 0) {
        const lot = lots[0]!;
        const take = Math.min(need, lot.remaining);
        lot.remaining -= take;
        need -= take;
        if (lot.remaining === 0) lots.shift();
      }
      if (need > 0) {
        // Déficit anonyme : épongé par la prochaine disponibilité.
        shortfalls.push({ qty: need, costing: null, provisional: null });
      }
    }
    // ev.signedQty === 0 (ajustement neutre) : aucun effet.
  }

  // -------- FINALISATION : consolider chaque vente depuis ses allocations.
  for (const costing of perSale.values()) finalize(costing);

  return {
    perSale,
    lotRemainders: lots.filter((l) => l.remaining > 0),
    residualShortfall: shortfalls.reduce((s, c) => s + c.qty, 0),
  };
}

function getOrCreate(
  perSale: Map<string, SaleCosting>,
  saleId: string,
  quantity: number,
): SaleCosting {
  let c = perSale.get(saleId);
  if (!c) {
    c = { saleId, quantity, cogs: 0, shortfallQuantity: 0, allocations: [] };
    perSale.set(saleId, c);
  }
  return c;
}

// COGS, découvert et quantité = somme des allocations (les parts provisoires
// résorbées sont à 0 et retirées). Garantit l'invariant de conservation :
// Σ quantité d'allocations = quantité vendue.
function finalize(costing: SaleCosting): void {
  costing.allocations = costing.allocations.filter((a) => a.quantity > 0);
  costing.cogs = round2(
    costing.allocations.reduce((s, a) => s + a.quantity * a.unitCost, 0),
  );
  costing.shortfallQuantity = costing.allocations
    .filter((a) => a.lotMovementId === null)
    .reduce((s, a) => s + a.quantity, 0);
  costing.quantity = costing.allocations.reduce((s, a) => s + a.quantity, 0);
}

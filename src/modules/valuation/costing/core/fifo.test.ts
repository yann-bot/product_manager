import { test, expect } from "bun:test";
import { replayFifo } from "./fifo";
import type { LedgerEvent } from "./costing.entities";

//
// Tests du moteur FIFO pur (sans DB). Le moteur traite les événements DANS
// L'ORDRE du tableau (le tri (created_at, id) est la responsabilité de
// l'adaptateur) : les tests fournissent donc des journaux déjà ordonnés.
//

let seq = 0;
function ev(
  p: Partial<LedgerEvent> & { kind: LedgerEvent["kind"]; signedQty: number },
): LedgerEvent {
  seq++;
  return {
    movementId: p.movementId ?? `m${seq}`,
    saleId: p.saleId ?? null,
    kind: p.kind,
    signedQty: p.signedQty,
    unitCost: p.unitCost ?? null,
    createdAt: p.createdAt ?? new Date(2026, 0, 1, 0, 0, seq),
  };
}
const lotIn = (id: string, qty: number, unitCost: number) =>
  ev({ movementId: id, kind: "in", signedQty: qty, unitCost });
const saleOut = (saleId: string, qty: number) =>
  ev({ saleId, kind: "out", signedQty: -qty });

const NO_FALLBACK = { fallbackCost: 0 };

test("cas spec : 20 du lot Mai @1750 + 30 du lot Juin @2250 -> COGS 102 500", () => {
  const events = [
    lotIn("mai", 40, 1750),
    saleOut("A", 20), // épuise 20 de Mai (reste 20)
    lotIn("juin", 30, 2250),
    saleOut("B", 50), // 20 Mai @1750 + 30 Juin @2250
  ];
  const r = replayFifo(events, NO_FALLBACK);

  const a = r.perSale.get("A")!;
  expect(a.cogs).toBe(35000);

  const b = r.perSale.get("B")!;
  expect(b.cogs).toBe(102500);
  expect(b.shortfallQuantity).toBe(0);
  expect(b.quantity).toBe(50);
  expect(b.allocations).toEqual([
    { lotMovementId: "mai", quantity: 20, unitCost: 1750 },
    { lotMovementId: "juin", quantity: 30, unitCost: 2250 },
  ]);
  expect(r.lotRemainders).toEqual([]); // tout consommé
});

test("découvert puis régularisation : snapshot provisoire, recalcul convergent, écart quantifié", () => {
  const base = [lotIn("L1", 10, 100), saleOut("X", 30)];

  // Snapshot (rejeu jusqu'à la vente) : 10 réels + 20 à découvert au coût connu.
  const snap = replayFifo(base, NO_FALLBACK).perSale.get("X")!;
  expect(snap.cogs).toBe(3000);
  expect(snap.shortfallQuantity).toBe(20);
  expect(snap.quantity).toBe(30);

  // Recalcul (journal complet) : la régularisation @150 éponge le découvert.
  const full = [...base, lotIn("L2", 50, 150)];
  const recalc = replayFifo(full, NO_FALLBACK);
  const x = recalc.perSale.get("X")!;
  expect(x.cogs).toBe(4000); // 10×100 + 20×150
  expect(x.shortfallQuantity).toBe(0);
  expect(x.cogs - snap.cogs).toBe(1000); // 20×(150−100)
  expect(recalc.lotRemainders).toEqual([
    { movementId: "L2", remaining: 30, unitCost: 150 },
  ]);
});

test("découvert sur produit sans aucun lot : coté au coût de repli", () => {
  const r = replayFifo([saleOut("Y", 5)], { fallbackCost: 800 });
  const y = r.perSale.get("Y")!;
  expect(y.cogs).toBe(4000); // 5 × 800
  expect(y.shortfallQuantity).toBe(5);
  expect(y.allocations).toEqual([
    { lotMovementId: null, quantity: 5, unitCost: 800 },
  ]);
});

test("annulation datée : la restitution est une disponibilité nouvelle (pas une réouverture du lot)", () => {
  const events = [
    lotIn("L1", 10, 100),
    saleOut("A", 5), // A consomme 5 de L1 (reste 5)
    ev({ movementId: "rev", kind: "in", signedQty: 5, unitCost: 100, saleId: "A" }), // compensation
    saleOut("B", 5),
  ];
  const r = replayFifo(events, NO_FALLBACK);

  // La vente annulée garde son snapshot (historique).
  expect(r.perSale.get("A")!.cogs).toBe(500);
  // B consomme le RESTANT de L1 (plus ancien), pas la restitution.
  expect(r.perSale.get("B")!.allocations).toEqual([
    { lotMovementId: "L1", quantity: 5, unitCost: 100 },
  ]);
  // La restitution reste disponible (datée à l'annulation, en fin de file FIFO).
  expect(r.lotRemainders).toEqual([
    { movementId: "rev", remaining: 5, unitCost: 100 },
  ]);
});

test("concordance hors découvert : un réappro postérieur ne change pas une vente déjà couverte", () => {
  const covered = [
    lotIn("mai", 40, 1750),
    saleOut("A", 20),
    lotIn("juin", 30, 2250),
    saleOut("B", 50),
  ];
  const snap = replayFifo(covered, NO_FALLBACK).perSale.get("B")!;
  const recalc = replayFifo(
    [...covered, lotIn("juil", 100, 3000)],
    NO_FALLBACK,
  ).perSale.get("B")!;
  expect(recalc.cogs).toBe(snap.cogs); // variance nulle
});

test("conservation des quantités : Σ allocations = quantité vendue", () => {
  const r = replayFifo(
    [lotIn("L1", 4, 100), saleOut("A", 10), lotIn("L2", 20, 130)],
    NO_FALLBACK,
  );
  for (const c of r.perSale.values()) {
    const sum = c.allocations.reduce((s, a) => s + a.quantity, 0);
    expect(sum).toBe(c.quantity);
  }
});

test("ordre stable : rejeu déterministe, le plus ancien 'out' prend le plus ancien lot", () => {
  const events = [
    lotIn("L1", 5, 100),
    lotIn("L2", 5, 200),
    saleOut("A", 5),
    saleOut("B", 5),
  ];
  const r1 = replayFifo(events, NO_FALLBACK);
  const r2 = replayFifo(events, NO_FALLBACK);
  expect(r1.perSale.get("A")!.allocations).toEqual([
    { lotMovementId: "L1", quantity: 5, unitCost: 100 },
  ]);
  expect(r1.perSale.get("B")!.allocations).toEqual([
    { lotMovementId: "L2", quantity: 5, unitCost: 200 },
  ]);
  expect(r2.perSale.get("A")!.cogs).toBe(r1.perSale.get("A")!.cogs);
  expect(r2.perSale.get("B")!.cogs).toBe(r1.perSale.get("B")!.cogs);
});

test("démarque (ajustement négatif) : déplète les lots sans produire de COGS de vente", () => {
  const r = replayFifo(
    [
      lotIn("L1", 10, 100),
      ev({ movementId: "adj", kind: "adjustment", signedQty: -3 }), // perte
      saleOut("S", 5),
    ],
    NO_FALLBACK,
  );
  expect(r.perSale.size).toBe(1); // pas d'entrée pour la perte
  expect(r.perSale.get("S")!.cogs).toBe(500);
  expect(r.lotRemainders).toEqual([
    { movementId: "L1", remaining: 2, unitCost: 100 }, // 10 − 3 − 5
  ]);
});

test("ajustement positif sans coût explicite : repli sur le dernier coût connu", () => {
  const r = replayFifo(
    [
      lotIn("L1", 5, 100),
      ev({ movementId: "adj", kind: "adjustment", signedQty: 5 }), // +5 sans coût
      saleOut("S", 8),
    ],
    NO_FALLBACK,
  );
  const s = r.perSale.get("S")!;
  expect(s.cogs).toBe(800); // 5×100 (L1) + 3×100 (ajust. au dernier coût connu)
  expect(s.allocations).toEqual([
    { lotMovementId: "L1", quantity: 5, unitCost: 100 },
    { lotMovementId: "adj", quantity: 3, unitCost: 100 },
  ]);
});

import { describe, expect, it } from "bun:test";
import { resolveCols } from "./sync.service";

// Données réelles tirées du Sheet de prod (1KLf4…). Le parseur doit gérer
// les variantes : NOTE CLIENT présente ou absente, STATUS présent/absent,
// trou laissé par une colonne décalée. Le bug d'origine mettait le PRIX
// TOTAL dans `quantite` et lisait le STATUT sur la mauvaise colonne.
describe("resolveCols", () => {
  // Helper : reconstruit l'objet parsé comme le fait sync().
  const parse = (row: string[]) => {
    const c = resolveCols(row);
    if (!c) return null;
    const at = (i: number) => (row[i] ?? "").trim() || null;
    return {
      productName: at(c.productName),
      unitPrice: at(c.unitPrice),
      quantity: at(c.quantity),
      totalAmount: at(c.totalAmount),
      status: at(c.status),
      note: at(c.note),
    };
  };

  it("ligne SANS note client ni statut (NOTE CLIENT omise → produit en index 5)", () => {
    const row = [
      "2026-06-05 14:10:43",
      "2714",
      "Ichamo service",
      "23670559116",
      "Tout moment",
      "MAX MAN ULTRA - Augmentez Votre Volume",
      "12500",
      "1",
      "12500",
    ];
    expect(parse(row)).toEqual({
      productName: "MAX MAN ULTRA - Augmentez Votre Volume",
      unitPrice: "12500",
      quantity: "1",
      totalAmount: "12500",
      status: null,
      note: null,
    });
  });

  it("ligne décalée AVEC statut et un trou avant le statut", () => {
    const row = [
      "2026-06-05 17:45:12",
      "2717",
      "Coles Daouda",
      "23672202699",
      "Aujoud'hui",
      "Capsules Anti Diabète et Hypertension",
      "14900",
      "1",
      "14900",
      "", // trou laissé par la colonne décalée
      "A - Livré",
    ];
    expect(parse(row)).toEqual({
      productName: "Capsules Anti Diabète et Hypertension",
      unitPrice: "14900",
      quantity: "1",
      totalAmount: "14900",
      status: "A - Livré",
      note: null,
    });
  });

  it("ligne complète : ADRESSE + NOTE CLIENT + STATUS + NOTE (produit en index 6)", () => {
    const row = [
      "2026-03-24 18:07:23",
      "1002",
      "Kistore -",
      "74113900",
      "Combattant",
      "Aujourd'hui",
      "Café Minceur 20X au Collagène",
      "14900",
      "1",
      "14900",
      "A - Livré",
      "rappeler demain",
    ];
    expect(parse(row)).toEqual({
      productName: "Café Minceur 20X au Collagène",
      unitPrice: "14900",
      quantity: "1",
      totalAmount: "14900",
      status: "A - Livré",
      note: "rappeler demain",
    });
  });

  it("ne confond pas un téléphone numérique avec le bloc prix", () => {
    const c = resolveCols([
      "2026-06-05 14:10:43",
      "2714",
      "Ichamo service",
      "23670559116",
      "Tout moment",
      "MAX MAN ULTRA",
      "12500",
      "1",
      "12500",
    ]);
    expect(c?.unitPrice).toBe(6); // pas l'index 3 (le tél)
    expect(c?.productName).toBe(5);
  });

  it("ligne sans bloc numérique repérable → null (inexploitable)", () => {
    expect(resolveCols(["2026-01-01", "9999", "Nom", "770000000"])).toBeNull();
  });
});

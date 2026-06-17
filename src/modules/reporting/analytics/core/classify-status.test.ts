import { test, expect } from "bun:test";
import { classifyStatus } from "./classify-status";

// Statuts réels observés en base (backup EasySell).
test("statuts EasySell canoniques", () => {
  expect(classifyStatus("A - Livré")).toBe("DELIVERED");
  expect(classifyStatus("B - Programmé")).toBe("PENDING");
  expect(classifyStatus("C - Je vous rappelle")).toBe("PENDING");
  expect(classifyStatus("D - Injoignable")).toBe("UNREACHABLE");
  expect(classifyStatus("E - Rejeté")).toBe("REJECTED");
});

test("rejet / annulation", () => {
  expect(classifyStatus("Rejeté")).toBe("REJECTED");
  expect(classifyStatus("E - rejetée")).toBe("REJECTED");
  expect(classifyStatus("Annulé")).toBe("REJECTED");
});

test("insensible à la casse, aux accents et aux espaces", () => {
  expect(classifyStatus("  a - livre  ")).toBe("DELIVERED");
  expect(classifyStatus("LIVRÉ")).toBe("DELIVERED");
  expect(classifyStatus("Injoignable")).toBe("UNREACHABLE");
  expect(classifyStatus("b – Programme")).toBe("PENDING"); // tiret long
});

test("variantes de livraison", () => {
  expect(classifyStatus("A - Livrée")).toBe("DELIVERED");
  expect(classifyStatus("A - Livrés")).toBe("DELIVERED");
});

test("bruit : noms de produits qui ont fui dans la colonne statut", () => {
  expect(classifyStatus("X - Retrouvez votre puissance masculine")).toBe("NOISE");
  expect(classifyStatus("E - Réveillez Votre Puissance Naturelle")).toBe("NOISE");
  expect(classifyStatus("i - Centrafrique")).toBe("NOISE");
});

test("null / vide -> UNKNOWN", () => {
  expect(classifyStatus(null)).toBe("UNKNOWN");
  expect(classifyStatus("")).toBe("UNKNOWN");
  expect(classifyStatus("   ")).toBe("UNKNOWN");
});

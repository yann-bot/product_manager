import { test, expect } from "bun:test";
import {
  isDeliveredSale,
  buildEasySellSaleInsert,
  type SourceOrder,
} from "./build-easysell-sale";

const order: SourceOrder = {
  externalOrderId: "GS-1001",
  productName: "Samsung Galaxy A15",
  quantity: 2,
  unitPrice: "120000",
  totalPrice: "240000",
  saleDate: new Date("2026-03-24T18:07:23"),
};

test("isDeliveredSale : seules les commandes livrées passent", () => {
  expect(isDeliveredSale("A - Livré")).toBe(true);
  expect(isDeliveredSale("A - Livrée")).toBe(true);
  expect(isDeliveredSale("B - Programmé")).toBe(false);
  expect(isDeliveredSale("D - Injoignable")).toBe(false);
  expect(isDeliveredSale("E - Rejeté")).toBe(false);
  expect(isDeliveredSale(null)).toBe(false);
  expect(isDeliveredSale("X - Retrouvez votre puissance")).toBe(false); // bruit
});

test("build : produit trouvé -> réconcilié + product_id posé", () => {
  const row = buildEasySellSaleInsert(order, "prod-uuid-123");
  expect(row.productId).toBe("prod-uuid-123");
  expect(row.reconciliationStatus).toBe("reconciled");
});

test("build : pas de mapping -> pending + product_id null", () => {
  const row = buildEasySellSaleInsert(order, null);
  expect(row.productId).toBeNull();
  expect(row.reconciliationStatus).toBe("pending");
});

test("build : copie montants (string), quantité et date", () => {
  const row = buildEasySellSaleInsert(order, null);
  expect(row.externalOrderId).toBe("GS-1001");
  expect(row.productName).toBe("Samsung Galaxy A15");
  expect(row.quantity).toBe(2);
  expect(row.unitPrice).toBe("120000"); // reste une string (pas de float)
  expect(row.totalPrice).toBe("240000");
  expect(row.saleDate).toEqual(new Date("2026-03-24T18:07:23"));
});

test("build : conserve les nulls (source incomplète)", () => {
  const incomplete: SourceOrder = {
    externalOrderId: "GS-1003",
    productName: "Thé au Ginseng",
    quantity: null,
    unitPrice: null,
    totalPrice: null,
    saleDate: null,
  };
  const row = buildEasySellSaleInsert(incomplete, null);
  expect(row.quantity).toBeNull();
  expect(row.unitPrice).toBeNull();
  expect(row.totalPrice).toBeNull();
  expect(row.saleDate).toBeNull();
});

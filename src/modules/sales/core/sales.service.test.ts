import { test, expect } from "bun:test";
import { SalesService } from "./sales.service";
import { NotFoundError, ValidationError } from "../../../shared/errors";
import type { NewSale, Sale, SalesRepository, StockLedger } from "./sales.entities";
import type {
  CreateProductDTO,
  Product,
  ProductRepository,
  UpdateProductDTO,
} from "../../product/core/product.entities";

//
// Tests unitaires du SalesService avec des repos en mémoire (fakes) :
// la logique métier (RM-02..RM-06) + l'intégration Stock (sortie à la vente,
// entrée à l'annulation) sont validées sans DB.
//

function makeProduct(over: Partial<Product> = {}): Product {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    name: "Produit test",
    description: null,
    sellingPrice: 1000,
    costPrice: null,
    status: "active",
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

class FakeProductRepository implements ProductRepository {
  private items = new Map<string, Product>();
  constructor(products: Product[] = []) {
    for (const p of products) this.items.set(p.id, p);
  }
  async findAll(): Promise<Product[]> {
    return [...this.items.values()];
  }
  async findById(id: string): Promise<Product | null> {
    return this.items.get(id) ?? null;
  }
  async create(_p: CreateProductDTO): Promise<Product> {
    throw new Error("non utilisé dans ces tests");
  }
  async update(_id: string, _u: UpdateProductDTO): Promise<Product> {
    throw new Error("non utilisé dans ces tests");
  }
  async archive(_id: string): Promise<Product> {
    throw new Error("non utilisé dans ces tests");
  }
}

class FakeSalesRepository implements SalesRepository {
  items = new Map<string, Sale>();
  async findAll(): Promise<Sale[]> {
    return [...this.items.values()];
  }
  async findById(id: string): Promise<Sale | null> {
    return this.items.get(id) ?? null;
  }
  async create(sale: NewSale): Promise<Sale> {
    const now = new Date();
    const created: Sale = {
      id: crypto.randomUUID(),
      productId: sale.productId,
      quantity: sale.quantity,
      unitPrice: sale.unitPrice,
      totalAmount: sale.totalAmount,
      status: sale.status,
      notes: sale.notes ?? null,
      easysellSaleId: sale.easysellSaleId ?? null,
      saleDate: sale.saleDate,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(created.id, created);
    return created;
  }
  async cancel(id: string): Promise<Sale> {
    const current = this.items.get(id);
    if (!current) throw new NotFoundError(`Vente introuvable : ${id}`);
    const updated: Sale = { ...current, status: "cancelled", updatedAt: new Date() };
    this.items.set(id, updated);
    return updated;
  }
}

type LedgerCall = { productId: string; quantity: number; saleId: string };

class FakeStockLedger implements StockLedger {
  outs: LedgerCall[] = [];
  reversals: LedgerCall[] = [];
  async recordSaleOut(input: LedgerCall): Promise<void> {
    this.outs.push(input);
  }
  async reverseSale(input: LedgerCall): Promise<void> {
    this.reversals.push(input);
  }
}

test("create : fige le prix, calcule le total (RM-03/04/05) et sort le stock", async () => {
  const product = makeProduct({ sellingPrice: 120_000 });
  const sales = new FakeSalesRepository();
  const stock = new FakeStockLedger();
  const service = new SalesService(sales, new FakeProductRepository([product]), stock);

  const sale = await service.create({ productId: product.id, quantity: 2 });

  expect(sale.unitPrice).toBe(120_000);
  expect(sale.totalAmount).toBe(240_000);
  expect(sale.status).toBe("completed");
  expect(sale.productId).toBe(product.id);
  // Intégration Stock : une sortie de la quantité vendue est enregistrée.
  expect(stock.outs).toEqual([{ productId: product.id, quantity: 2, saleId: sale.id }]);
});

test("create : produit introuvable -> NotFoundError (RM-01), pas de mouvement", async () => {
  const stock = new FakeStockLedger();
  const service = new SalesService(
    new FakeSalesRepository(),
    new FakeProductRepository(),
    stock,
  );
  await expect(
    service.create({ productId: crypto.randomUUID(), quantity: 1 }),
  ).rejects.toBeInstanceOf(NotFoundError);
  expect(stock.outs).toHaveLength(0);
});

test("create : produit sans prix de vente -> ValidationError (RM-03)", async () => {
  const product = makeProduct({ sellingPrice: null });
  const service = new SalesService(
    new FakeSalesRepository(),
    new FakeProductRepository([product]),
    new FakeStockLedger(),
  );
  await expect(
    service.create({ productId: product.id, quantity: 1 }),
  ).rejects.toBeInstanceOf(ValidationError);
});

test("create : quantité nulle ou non entière -> ValidationError (RM-02)", async () => {
  const product = makeProduct();
  const service = new SalesService(
    new FakeSalesRepository(),
    new FakeProductRepository([product]),
    new FakeStockLedger(),
  );
  await expect(
    service.create({ productId: product.id, quantity: 0 }),
  ).rejects.toBeInstanceOf(ValidationError);
  await expect(
    service.create({ productId: product.id, quantity: 1.5 }),
  ).rejects.toBeInstanceOf(ValidationError);
});

test("cancel : passe à cancelled (RM-06) et restitue le stock (entrée)", async () => {
  const product = makeProduct();
  const sales = new FakeSalesRepository();
  const stock = new FakeStockLedger();
  const service = new SalesService(sales, new FakeProductRepository([product]), stock);
  const sale = await service.create({ productId: product.id, quantity: 1 });

  const cancelled = await service.cancel(sale.id);

  expect(cancelled.status).toBe("cancelled");
  expect((await sales.findById(sale.id))?.status).toBe("cancelled");
  // Intégration Stock : une entrée compensatoire est enregistrée.
  expect(stock.reversals).toEqual([{ productId: product.id, quantity: 1, saleId: sale.id }]);
});

test("cancel : double annulation -> ValidationError (une seule restitution)", async () => {
  const product = makeProduct();
  const sales = new FakeSalesRepository();
  const stock = new FakeStockLedger();
  const service = new SalesService(sales, new FakeProductRepository([product]), stock);
  const sale = await service.create({ productId: product.id, quantity: 1 });
  await service.cancel(sale.id);
  await expect(service.cancel(sale.id)).rejects.toBeInstanceOf(ValidationError);
  expect(stock.reversals).toHaveLength(1);
});

test("cancel : vente introuvable -> NotFoundError", async () => {
  const service = new SalesService(
    new FakeSalesRepository(),
    new FakeProductRepository(),
    new FakeStockLedger(),
  );
  await expect(service.cancel(crypto.randomUUID())).rejects.toBeInstanceOf(NotFoundError);
});

test("createFromEasySell : utilise le MONTANT EasySell réel + sort le stock + trace la provenance", async () => {
  const product = makeProduct({ sellingPrice: 1000 }); // prix catalogue ignoré ici
  const sales = new FakeSalesRepository();
  const stock = new FakeStockLedger();
  const service = new SalesService(sales, new FakeProductRepository([product]), stock);
  const esId = crypto.randomUUID();
  const saleDate = new Date("2026-05-01T10:00:00Z");

  await service.createFromEasySell({
    productId: product.id,
    quantity: 3,
    easysellSaleId: esId,
    unitPrice: null,
    totalPrice: 9000, // montant EasySell réel (≠ 3 × 1000 catalogue)
    saleDate,
  });

  const [sale] = [...sales.items.values()];
  expect(sale).toBeDefined();
  expect(sale!.totalAmount).toBe(9000); // montant EasySell, pas le catalogue
  expect(sale!.unitPrice).toBe(3000);
  expect(sale!.status).toBe("completed");
  expect(sale!.easysellSaleId).toBe(esId);
  expect(sale!.saleDate).toEqual(saleDate);
  expect(stock.outs).toEqual([{ productId: product.id, quantity: 3, saleId: sale!.id }]);
});

test("createFromEasySell : repli sur le prix catalogue quand le montant EasySell est absent", async () => {
  const product = makeProduct({ sellingPrice: 1500 });
  const sales = new FakeSalesRepository();
  const service = new SalesService(sales, new FakeProductRepository([product]), new FakeStockLedger());

  await service.createFromEasySell({
    productId: product.id,
    quantity: 2,
    easysellSaleId: crypto.randomUUID(),
    unitPrice: null,
    totalPrice: null, // source EasySell incomplète -> repli prix produit
    saleDate: null,
  });

  const [sale] = [...sales.items.values()];
  expect(sale!.unitPrice).toBe(1500);
  expect(sale!.totalAmount).toBe(3000);
});

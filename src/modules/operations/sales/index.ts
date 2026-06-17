import { db } from "../../../db/client";
import { SalesService } from "./core/sales.service";
import SalesController from "./inbound/sales.rest";
import { SalesPostgresRepository } from "./outbound/sales.postgres";
import { ProductService } from "../../catalog/product/core/product.service";
import { ProductPostgresRepository } from "../../catalog/product/outbound/product.postgres";
import { StockService } from "../stock/core/stock.service";
import { StockPostgresRepository } from "../stock/outbound/stock.postgres";
import { CostingService } from "../../valuation/costing/core/costing.service";
import { CostingPostgresRepository } from "../../valuation/costing/outbound/costing.postgres";

// Câblage manuel : repo (outbound) -> service (core) -> controller (inbound).
// Sales dépend du catalogue produit (RM-03 : prix lu sur le produit), donc
// on injecte aussi le ProductRepository (pricing) et le ProductService
// (lecture pour le formulaire et l'affichage des noms).
//
// Intégration Stock : StockService expose recordSaleOut/reverseSale, donc il
// satisfait structurellement le port StockLedger — injecté tel quel (la vente
// génère une sortie de stock, l'annulation une entrée).
const salesRepo = new SalesPostgresRepository(db);
const productRepo = new ProductPostgresRepository(db);
const productService = new ProductService(productRepo);
const stockService = new StockService(new StockPostgresRepository(db), productRepo);
const costingService = new CostingService(new CostingPostgresRepository(db));
const salesService = new SalesService(salesRepo, productRepo, stockService, costingService);
const SalesRouter = SalesController(salesService, productService);

export default SalesRouter;

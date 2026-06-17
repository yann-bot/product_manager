import { db } from "../../../db/client";
import { StockService } from "./core/stock.service";
import { StockPostgresRepository } from "./outbound/stock.postgres";
import { ProductService } from "../../catalog/product/core/product.service";
import { ProductPostgresRepository } from "../../catalog/product/outbound/product.postgres";
import StockController from "./inbound/stock.rest";

// Câblage manuel : repo (outbound) -> service (core) -> controller (inbound).
// Le service a besoin du catalogue produit (validation + noms / niveaux).
const productRepo = new ProductPostgresRepository(db);
const stockService = new StockService(new StockPostgresRepository(db), productRepo);
const productService = new ProductService(productRepo);
const StockRouter = StockController(stockService, productService);

export default StockRouter;

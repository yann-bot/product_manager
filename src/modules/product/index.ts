import { db } from "../../db/client";
import { ProductService } from "./core/product.service";
import ProductController from "./inbound/product.rest";
import { ProductPostgresRepository } from "./outbound/product.postgres";

// Câblage manuel : repo (outbound) -> service (core) -> controller (inbound).
const repo = new ProductPostgresRepository(db);
const service = new ProductService(repo);
const ProductRouter = ProductController(service);

export default ProductRouter;

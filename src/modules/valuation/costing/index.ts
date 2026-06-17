import { db } from "../../../db/client";
import { CostingService } from "./core/costing.service";
import { CostingPostgresRepository } from "./outbound/costing.postgres";
import CostingController from "./inbound/costing.rest";
import { SalesPostgresRepository } from "../../operations/sales/outbound/sales.postgres";
import { ProductPostgresRepository } from "../../catalog/product/outbound/product.postgres";

// Câblage manuel : repo (outbound) -> service (core) -> controller (inbound).
// L'écran d'audit lit les ventes (avec leur cogs figé) et les noms produit ;
// le recalcul, lui, passe par le CostingService.
const costingRepo = new CostingPostgresRepository(db);
const costingService = new CostingService(costingRepo);
const CostingRouter = CostingController(
  costingService,
  new SalesPostgresRepository(db),
  new ProductPostgresRepository(db),
);

export default CostingRouter;

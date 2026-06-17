import { db } from "../../../db/client";
import { EasySellOrderService } from "./core/easysell-order.service";
import EasySellOrderController from "./inbound/easysell-order.rest";
import { EasySellOrderPostgresRepository } from "./outbound/easysell-order.postgres";

const repo = new EasySellOrderPostgresRepository(db);
const service = new EasySellOrderService(repo);
const EasySellOrderRouter = EasySellOrderController(service);

export default EasySellOrderRouter;

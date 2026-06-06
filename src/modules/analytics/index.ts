import { db } from "../../db/client";
import { AnalyticsService } from "./core/analytics.service";
import AnalyticsController from "./inbound/analytics.rest";
import { AnalyticsPostgresRepository } from "./outbound/analytics.postgres";

const repo = new AnalyticsPostgresRepository(db);
const service = new AnalyticsService(repo);
const AnalyticsRouter = AnalyticsController(service);

export default AnalyticsRouter;

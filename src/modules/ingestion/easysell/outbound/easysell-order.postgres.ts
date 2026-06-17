import { desc } from "drizzle-orm";
import type { DB } from "../../../../db/client";
import { easysellOrders } from "../../../../db/schemas/easysell-order.schema";
import type { EasySellOrder, EasySellOrderRepository } from "../core/entities";

type Row = typeof easysellOrders.$inferSelect;

const toNumber = (value: string | null): number | null =>
  value !== null ? Number(value) : null;

function toEntity(row: Row): EasySellOrder {
  return {
    id: row.id,
    sheetId: row.sheetId,
    externalOrderId: row.externalOrderId,
    dateHeure: row.dateHeure,
    nomComplet: row.nomComplet,
    telephone: row.telephone,
    adresse: row.adresse,
    noteClient: row.noteClient,
    nomProduit: row.nomProduit,
    prixUnitaire: toNumber(row.prixUnitaire),
    quantite: row.quantite,
    prixTotal: toNumber(row.prixTotal),
    status: row.status,
    note: row.note,
    syncedAt: row.syncedAt,
  };
}

export class EasySellOrderPostgresRepository
  implements EasySellOrderRepository
{
  constructor(private readonly db: DB) {}

  async findAll(): Promise<EasySellOrder[]> {
    const rows = await this.db
      .select()
      .from(easysellOrders)
      .orderBy(desc(easysellOrders.dateHeure));
    return rows.map(toEntity);
  }
}

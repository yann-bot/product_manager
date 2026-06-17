import type { EasySellOrder, EasySellOrderRepository } from "./entities";

/**
 * Use-cases du contexte EasySellOrder (lecture seule).
 */
export class EasySellOrderService {
  constructor(private readonly repo: EasySellOrderRepository) {}

  findAll(): Promise<EasySellOrder[]> {
    return this.repo.findAll();
  }
}

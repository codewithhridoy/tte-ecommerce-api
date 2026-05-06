import { db } from "@infra/db/client";
import { DrizzleInventoryRepository } from "./infrastructure/repositories/DrizzleInventoryRepository";
import type { InventoryRepository } from "./domain/repositories/InventoryRepository";

export interface InventoryModule {
  inventoryRepository: InventoryRepository;
}

export const buildInventoryModule = (): InventoryModule => ({
  inventoryRepository: new DrizzleInventoryRepository(db),
});

export type {
  InventoryRepository,
  ReservationLine,
} from "./domain/repositories/InventoryRepository";
export type { InventoryRecord } from "./domain/entities/Inventory";

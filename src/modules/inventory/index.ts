import { db } from '@infra/db/client.js'
import { DrizzleInventoryRepository } from './infrastructure/repositories/DrizzleInventoryRepository.js'
import type { InventoryRepository } from './domain/repositories/InventoryRepository.js'

export interface InventoryModule {
  inventoryRepository: InventoryRepository
}

export const buildInventoryModule = (): InventoryModule => ({
  inventoryRepository: new DrizzleInventoryRepository(db),
})

export type { InventoryRepository, ReservationLine } from './domain/repositories/InventoryRepository.js'
export type { InventoryRecord } from './domain/entities/Inventory.js'

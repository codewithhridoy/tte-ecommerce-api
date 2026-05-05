import type { DbExecutor } from '@infra/db/client.js'
import type { InventoryRecord } from '../entities/Inventory.js'

export interface ReservationLine {
  variantId: string
  quantity: number
}

export interface InventoryRepository {
  upsertOnHand(variantId: string, onHand: number): Promise<InventoryRecord>
  findByVariantIds(variantIds: string[]): Promise<InventoryRecord[]>
  // Locks variant rows with SELECT FOR UPDATE and deducts onHand atomically.
  // Throws PreconditionFailedError on insufficient stock. Must run inside tx.
  lockAndDeduct(tx: DbExecutor, lines: ReservationLine[], reason: string, reasonRef?: string): Promise<void>
}

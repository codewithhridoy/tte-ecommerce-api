export interface InventoryRecord {
  id: string
  variantId: string
  onHand: number
  reserved: number
  version: number
  createdAt: Date
  updatedAt: Date
}

export const availableQuantity = (record: InventoryRecord): number =>
  Math.max(0, record.onHand - record.reserved)

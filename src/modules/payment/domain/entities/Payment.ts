export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded'

export interface Payment {
  id: string
  orderId: string
  provider: string
  providerRef: string | null
  status: PaymentStatus
  amountMinor: number
  currency: string
  rawResponse: Record<string, unknown> | null
  failureReason: string | null
  createdAt: Date
  updatedAt: Date
}

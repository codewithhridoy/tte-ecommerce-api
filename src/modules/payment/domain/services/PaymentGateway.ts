export interface ChargeRequest {
  orderId: string
  amountMinor: number
  currency: string
  idempotencyKey: string
  metadata?: Record<string, unknown>
}

export interface ChargeResult {
  providerRef: string
  status: 'authorized' | 'captured' | 'failed'
  raw: Record<string, unknown>
  failureReason?: string
}

export interface PaymentGateway {
  readonly name: string
  charge(req: ChargeRequest): Promise<ChargeResult>
}

export class MockPaymentGateway implements PaymentGateway {
  readonly name = 'mock'

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    // Deterministically succeed unless amount === 0.
    if (req.amountMinor === 0) {
      return {
        providerRef: `mock_${req.idempotencyKey}`,
        status: 'failed',
        raw: { reason: 'zero_amount' },
        failureReason: 'Zero-amount charge',
      }
    }
    return {
      providerRef: `mock_${req.idempotencyKey}`,
      status: 'captured',
      raw: { simulated: true, amountMinor: req.amountMinor, currency: req.currency },
    }
  }
}

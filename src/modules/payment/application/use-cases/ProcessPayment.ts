import { newId } from '@shared/id.js'
import { logger } from '@shared/logger.js'
import type { OrderRepository } from '@modules/order/domain/repositories/OrderRepository.js'
import type { Payment } from '../../domain/entities/Payment.js'
import type { PaymentRepository } from '../../domain/repositories/PaymentRepository.js'
import type { PaymentGateway } from '../../domain/services/PaymentGateway.js'

export interface ProcessPaymentInput {
  orderId: string
  amountMinor: number
  currency: string
  idempotencyKey: string
}

export interface ProcessPaymentOutput {
  payment: Payment
}

export class ProcessPayment {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: OrderRepository,
    private readonly gateway: PaymentGateway,
  ) {}

  async execute(input: ProcessPaymentInput): Promise<ProcessPaymentOutput> {
    const result = await this.gateway.charge({
      orderId: input.orderId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
    })

    const payment = await this.payments.create({
      id: newId(),
      orderId: input.orderId,
      provider: this.gateway.name,
      providerRef: result.providerRef,
      status: result.status,
      amountMinor: input.amountMinor,
      currency: input.currency,
      rawResponse: result.raw,
      failureReason: result.failureReason ?? null,
    })

    if (result.status === 'captured') {
      try {
        await this.orders.setStatus(input.orderId, 'paid')
      } catch (err) {
        logger.error({ err, orderId: input.orderId }, 'failed to mark order paid')
      }
    }

    return { payment }
  }
}

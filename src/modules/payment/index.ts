import { db } from '@infra/db/client.js'
import { loadEnv } from '@shared/env.js'
import type { OrderRepository } from '@modules/order/domain/repositories/OrderRepository.js'
import { DrizzlePaymentRepository } from './infrastructure/repositories/DrizzlePaymentRepository.js'
import { MockPaymentGateway, type PaymentGateway } from './domain/services/PaymentGateway.js'
import { ProcessPayment } from './application/use-cases/ProcessPayment.js'

export interface PaymentModuleDeps {
  orderRepository: OrderRepository
}

export interface PaymentModule {
  processPayment: ProcessPayment
  gateway: PaymentGateway
}

export const buildPaymentModule = (deps: PaymentModuleDeps): PaymentModule => {
  const env = loadEnv()
  if (env.PAYMENT_PROVIDER !== 'mock') {
    throw new Error(`Payment provider '${env.PAYMENT_PROVIDER}' is not wired up yet`)
  }
  const gateway: PaymentGateway = new MockPaymentGateway()
  const repo = new DrizzlePaymentRepository(db)
  return {
    gateway,
    processPayment: new ProcessPayment(repo, deps.orderRepository, gateway),
  }
}

export type { Payment, PaymentStatus } from './domain/entities/Payment.js'
export type { PaymentGateway } from './domain/services/PaymentGateway.js'

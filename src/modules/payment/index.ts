import { db } from "@infra/db/client";
import { ENV } from "@shared/env";
import type { OrderRepository } from "@modules/order/domain/repositories/OrderRepository";
import { DrizzlePaymentRepository } from "./infrastructure/repositories/DrizzlePaymentRepository";
import {
  MockPaymentGateway,
  type PaymentGateway,
} from "./domain/services/PaymentGateway";
import { ProcessPayment } from "./application/use-cases/ProcessPayment";

export interface PaymentModuleDeps {
  orderRepository: OrderRepository;
}

export interface PaymentModule {
  processPayment: ProcessPayment;
  gateway: PaymentGateway;
}

export const buildPaymentModule = (deps: PaymentModuleDeps): PaymentModule => {
  if (ENV.PAYMENT_PROVIDER !== "mock") {
    throw new Error(
      `Payment provider '${ENV.PAYMENT_PROVIDER}' is not wired up yet`,
    );
  }
  const gateway: PaymentGateway = new MockPaymentGateway();
  const repo = new DrizzlePaymentRepository(db);
  return {
    gateway,
    processPayment: new ProcessPayment(repo, deps.orderRepository, gateway),
  };
};

export type { Payment, PaymentStatus } from "./domain/entities/Payment";
export type { PaymentGateway } from "./domain/services/PaymentGateway";

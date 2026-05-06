import { logger } from "@shared/logger";
import { newId } from "@shared/id";
import type { EventSubscriber } from "./types";
import type { ProcessPayment } from "@modules/payment/application/use-cases/ProcessPayment";

interface OrderCreatedPayload {
  orderId: string;
  totalMinor: number;
  currency: string;
}

export const wireDomainEventHandlers = (
  bus: EventSubscriber,
  deps: { processPayment: ProcessPayment },
): void => {
  bus.subscribe("order.created", async (event) => {
    const p = event.payload as unknown as OrderCreatedPayload;
    logger.info(
      { orderId: p.orderId },
      "handling order.created → ProcessPayment",
    );
    await deps.processPayment.execute({
      orderId: p.orderId,
      amountMinor: p.totalMinor,
      currency: p.currency,
      idempotencyKey: `pay:${p.orderId}:${newId()}`,
    });
  });
};

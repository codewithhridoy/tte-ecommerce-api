import type { Payment, PaymentStatus } from "../entities/Payment";

export interface CreatePaymentDto {
  id: string;
  orderId: string;
  provider: string;
  providerRef: string | null;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  rawResponse?: Record<string, unknown> | null;
  failureReason?: string | null;
}

export interface PaymentRepository {
  create(dto: CreatePaymentDto): Promise<Payment>;
  findByOrder(orderId: string): Promise<Payment[]>;
  setStatus(
    id: string,
    status: PaymentStatus,
    raw?: Record<string, unknown>,
  ): Promise<void>;
}

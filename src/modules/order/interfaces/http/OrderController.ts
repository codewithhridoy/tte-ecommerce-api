import type { Request, Response } from "express";
import { ConflictError, ValidationError } from "@shared/errors";
import { ok } from "@shared/http/response";
import {
  CreateOrderInput,
  type CreateOrder,
} from "../../application/use-cases/CreateOrder";

export class OrderController {
  constructor(private readonly createOrder: CreateOrder) {}

  // POST /api/v1/orders   (header: Idempotency-Key)
  create = async (req: Request, res: Response): Promise<void> => {
    const idempotencyKey = req.header("idempotency-key");
    if (!idempotencyKey)
      throw new ValidationError("Idempotency-Key header is required");

    const input = CreateOrderInput.parse({
      cartId: req.body.cartId,
      userId: req.auth?.userId ?? null,
      idempotencyKey,
      shippingAddress: req.body.shippingAddress,
      billingAddress: req.body.billingAddress,
      taxMinor: req.body.taxMinor ?? 0,
      shippingMinor: req.body.shippingMinor ?? 0,
    });

    try {
      const result = await this.createOrder.execute(input);
      const status = result.replayed ? 200 : 201;
      res
        .status(status)
        .setHeader("Idempotent-Replayed", String(result.replayed))
        .json(ok(result.order));
    } catch (err) {
      if (err instanceof Error && err.message === "IDEMPOTENCY_KEY_CONFLICT") {
        throw new ConflictError(
          "Idempotency key reused with a different payload",
        );
      }
      if (err instanceof Error && err.message === "IDEMPOTENCY_KEY_IN_FLIGHT") {
        throw new ConflictError(
          "A request with this idempotency key is already in flight",
        );
      }
      throw err;
    }
  };
}

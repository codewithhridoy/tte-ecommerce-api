import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  ConflictError,
  NotFoundError,
  PreconditionFailedError,
} from "@shared/errors";
import { newId } from "@shared/id";
import { db } from "@infra/db/client";
import { carts } from "@infra/db/schema/index";
import { enqueueOutbox } from "@infra/events/outbox-publisher";
import type { CartRepository } from "@modules/cart/domain/repositories/CartRepository";
import { subtotalMinor } from "@modules/cart/domain/entities/Cart";
import type { ProductRepository } from "@modules/product/domain/repositories/ProductRepository";
import type { InventoryRepository } from "@modules/inventory/domain/repositories/InventoryRepository";
import type { ValidateCoupon } from "@modules/discount/index";
import type { Order } from "../../domain/entities/Order";
import type { OrderRepository } from "../../domain/repositories/OrderRepository";
import {
  DrizzleIdempotencyRepository,
  orderIdempotencyScope,
} from "../../infrastructure/repositories/DrizzleIdempotencyRepository";

export const CreateOrderInput = z.object({
  cartId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  idempotencyKey: z.string().min(8).max(128),
  shippingAddress: z.record(z.string()).optional(),
  billingAddress: z.record(z.string()).optional(),
  taxMinor: z.number().int().nonnegative().default(0),
  shippingMinor: z.number().int().nonnegative().default(0),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;

export interface CreateOrderOutput {
  order: Order;
  replayed: boolean;
}

const ORDER_CREATED_EVENT = "order.created";

export class CreateOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly carts: CartRepository,
    private readonly products: ProductRepository,
    private readonly inventory: InventoryRepository,
    private readonly idempotency: DrizzleIdempotencyRepository,
    private readonly validateCoupon: ValidateCoupon,
  ) {}

  async execute(input: CreateOrderInput): Promise<CreateOrderOutput> {
    const requestHash = this.idempotency.hashRequest({
      cartId: input.cartId,
      userId: input.userId,
      taxMinor: input.taxMinor,
      shippingMinor: input.shippingMinor,
      shippingAddress: input.shippingAddress ?? null,
      billingAddress: input.billingAddress ?? null,
    });

    return await db.transaction(async (tx) => {
      // 1. Idempotency: replay or claim a slot.
      const lookup = await this.idempotency.beginOrReplay<Order>(tx, {
        key: input.idempotencyKey,
        scope: orderIdempotencyScope,
        userId: input.userId,
        requestHash,
      });
      if (lookup.hit) return { order: lookup.body, replayed: true };

      // 2. Load cart and validate.
      const cart = await this.carts.findById(input.cartId);
      if (!cart) throw new NotFoundError("Cart");
      if (cart.status !== "active")
        throw new ConflictError("Cart is not active");
      if (cart.items.length === 0)
        throw new PreconditionFailedError("Cart is empty");

      // 3. Re-fetch variants to authoritative current price.
      const variants = await this.products.findVariantsByIds(
        cart.items.map((i) => i.variantId),
      );
      const variantById = new Map(variants.map((v) => [v.id, v]));
      for (const item of cart.items) {
        const v = variantById.get(item.variantId);
        if (!v || !v.isActive)
          throw new PreconditionFailedError(
            `Variant unavailable: ${item.variantId}`,
          );
        if (v.currency !== cart.currency)
          throw new ConflictError("Currency mismatch on variant");
      }

      // 4. Recompute money figures from variants (don't trust cart prices).
      const itemsForOrder = cart.items.map((item) => {
        const v = variantById.get(item.variantId)!;
        const totalMinor = v.priceMinor * item.quantity;
        return {
          variantId: v.id,
          sku: v.sku,
          name: v.name,
          quantity: item.quantity,
          unitPriceMinor: v.priceMinor,
          totalMinor,
        };
      });
      const computedSubtotal = itemsForOrder.reduce(
        (acc, i) => acc + i.totalMinor,
        0,
      );
      if (computedSubtotal !== subtotalMinor(cart)) {
        // Prices changed since cart was created; surface explicitly.
        throw new ConflictError("Cart prices have changed; please refresh");
      }

      // 5. Apply coupon if present.
      let discountMinor = 0;
      let couponCode: string | null = null;
      if (cart.couponCode) {
        const result = await this.validateCoupon.execute({
          code: cart.couponCode,
          subtotalMinor: computedSubtotal,
        });
        discountMinor = result.discount.discountMinor;
        couponCode = result.coupon.code;
      }

      const totalMinor = Math.max(
        0,
        computedSubtotal - discountMinor + input.taxMinor + input.shippingMinor,
      );

      // 6. Lock inventory and deduct atomically.
      const orderId = newId();
      await this.inventory.lockAndDeduct(
        tx,
        cart.items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity,
        })),
        "order_creation",
        orderId,
      );

      // 7. Persist order.
      const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${orderId.slice(0, 6)}`;
      const order = await this.orders.createInTx(tx, {
        id: orderId,
        orderNumber,
        userId: input.userId,
        currency: cart.currency,
        subtotalMinor: computedSubtotal,
        discountMinor,
        taxMinor: input.taxMinor,
        shippingMinor: input.shippingMinor,
        totalMinor,
        couponCode,
        shippingAddress: input.shippingAddress ?? null,
        billingAddress: input.billingAddress ?? null,
        items: itemsForOrder,
      });

      // 8. Mark cart converted (same tx — atomic with order insert).
      await tx
        .update(carts)
        .set({ status: "converted", updatedAt: new Date() })
        .where(eq(carts.id, cart.id));

      // 9. Emit OrderCreated to outbox (same tx — atomic with order insert).
      await enqueueOutbox(tx, {
        id: newId(),
        aggregateType: "order",
        aggregateId: order.id,
        type: ORDER_CREATED_EVENT,
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          totalMinor: order.totalMinor,
          currency: order.currency,
          items: order.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPriceMinor: i.unitPriceMinor,
          })),
        },
        occurredAt: new Date(),
      });

      // 10. Persist response for replay.
      await this.idempotency.complete(tx, lookup.rowId, 201, order);

      return { order, replayed: false };
    });
  }
}

import { z } from "zod";
import { registry } from "@shared/http/openapi/registry";

const TAG = "Orders";

const OrderItem = z
  .object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    variantId: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.number().int(),
    totalMinor: z.number().int(),
  })
  .openapi("OrderItem");

const Order = z
  .object({
    id: z.string().uuid(),
    orderNumber: z.string().openapi({ example: "ORD-LK3MN9-018E8F" }),
    userId: z.string().uuid().nullable(),
    status: z.enum(["pending_payment", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]),
    currency: z.string().openapi({ example: "USD" }),
    subtotalMinor: z.number().int(),
    discountMinor: z.number().int(),
    taxMinor: z.number().int(),
    shippingMinor: z.number().int(),
    totalMinor: z.number().int().openapi({ description: "Final charged amount in minor units" }),
    couponCode: z.string().nullable(),
    shippingAddress: z.record(z.string()).nullable(),
    billingAddress: z.record(z.string()).nullable(),
    metadata: z.record(z.unknown()),
    items: z.array(OrderItem),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Order");

const CreateOrderBody = z
  .object({
    cartId: z.string().uuid().openapi({ example: "018e8f3a-0000-7000-8000-000000000002" }),
    shippingAddress: z.record(z.string()).optional().openapi({
      example: { street: "123 Main St", city: "New York", country: "US", zip: "10001" },
    }),
    billingAddress: z.record(z.string()).optional(),
    taxMinor: z.number().int().nonnegative().default(0).openapi({ description: "Tax in minor units", example: 800 }),
    shippingMinor: z.number().int().nonnegative().default(0).openapi({ description: "Shipping in minor units", example: 500 }),
  })
  .openapi("CreateOrderBody");

registry.registerPath({
  method: "post",
  path: "/orders",
  tags: [TAG],
  summary: "Place an order from a cart",
  description: [
    "Converts an active cart into an immutable order.",
    "Inventory is decremented atomically inside the same DB transaction.",
    "Requires the `Idempotency-Key` header — replay returns 200 with `Idempotent-Replayed: true`.",
  ].join(" "),
  security: [{ bearerAuth: [] }],
  request: {
    headers: z.object({
      "idempotency-key": z.string().min(8).max(128).openapi({
        description: "Client-generated idempotency key (UUID v4 recommended)",
        example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    }),
    body: { content: { "application/json": { schema: CreateOrderBody } }, required: true },
  },
  responses: {
    201: {
      description: "Order created",
      headers: {
        "Idempotent-Replayed": {
          schema: { type: "string", enum: ["false"] },
          description: "false on first creation",
        },
      },
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: Order }),
        },
      },
    },
    200: {
      description: "Idempotent replay of an already-created order",
      headers: {
        "Idempotent-Replayed": {
          schema: { type: "string", enum: ["true"] },
        },
      },
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: Order }),
        },
      },
    },
    400: { description: "Validation error or missing Idempotency-Key" },
    401: { description: "Authentication required" },
    404: { description: "Cart not found" },
    409: { description: "Cart already converted, currency mismatch, or idempotency-key conflict" },
    412: { description: "Cart empty, variant unavailable, or insufficient stock" },
  },
});

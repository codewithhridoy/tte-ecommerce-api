import { z } from "zod";
import { registry } from "@shared/http/openapi/registry";

const TAG = "Cart";

const CartItem = z
  .object({
    id: z.string().uuid(),
    cartId: z.string().uuid(),
    variantId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPriceMinor: z.number().int().openapi({ description: "Unit price in minor units (cents)" }),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CartItem");

const Cart = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid().nullable(),
    guestToken: z.string().nullable(),
    currency: z.string().openapi({ example: "USD" }),
    status: z.enum(["active", "converted", "abandoned"]),
    couponCode: z.string().nullable(),
    metadata: z.record(z.unknown()),
    items: z.array(CartItem),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Cart");

const AddToCartBody = z
  .object({
    variantId: z.string().uuid().openapi({ example: "018e8f3a-0000-7000-8000-000000000001" }),
    quantity: z.number().int().positive().max(999).openapi({ example: 2 }),
    guestToken: z.string().min(8).max(64).optional().openapi({
      description: "Required when not authenticated. Supply either this or a Bearer token.",
      example: "guest-abc123xyz",
    }),
  })
  .openapi("AddToCartBody");

const ApplyCouponBody = z
  .object({
    code: z.string().min(1).max(64).openapi({ example: "SUMMER20" }),
  })
  .openapi("ApplyCouponBody");

const CartResponse = z
  .object({ success: z.literal(true), data: Cart })
  .openapi("CartResponse");

registry.registerPath({
  method: "post",
  path: "/cart/items",
  tags: [TAG],
  summary: "Add a variant to the cart (creates cart if needed)",
  security: [{}],
  request: {
    headers: z.object({
      "x-guest-token": z.string().optional().openapi({ description: "Guest session token (alternative to guestToken body field)" }),
    }),
    body: { content: { "application/json": { schema: AddToCartBody } }, required: true },
  },
  responses: {
    201: {
      description: "Cart updated",
      content: { "application/json": { schema: CartResponse } },
    },
    400: { description: "Validation error" },
    404: { description: "Variant not found or inactive" },
    409: { description: "Currency mismatch or missing cart owner" },
  },
});

registry.registerPath({
  method: "post",
  path: "/cart/{cartId}/coupon",
  tags: [TAG],
  summary: "Apply a coupon code to a cart",
  security: [{}],
  request: {
    params: z.object({ cartId: z.string().uuid() }),
    body: { content: { "application/json": { schema: ApplyCouponBody } }, required: true },
  },
  responses: {
    200: {
      description: "Coupon applied",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              cart: Cart,
              discountMinor: z.number().int().openapi({ description: "Computed discount in minor units" }),
            }),
          }),
        },
      },
    },
    404: { description: "Cart or coupon not found" },
    412: { description: "Coupon limit reached or conditions not met" },
  },
});

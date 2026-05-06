import { z } from "zod";
import { registry } from "@shared/http/openapi/registry";

const TAG = "Products";

const ProductVariant = z
  .object({
    id: z.string().uuid(),
    productId: z.string().uuid(),
    sku: z.string(),
    name: z.string(),
    priceMinor: z.number().int().openapi({ description: "Price in minor units (cents)" }),
    currency: z.string().openapi({ example: "USD" }),
    options: z.record(z.string()),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("ProductVariant");

const Product = z
  .object({
    id: z.string().uuid(),
    sku: z.string(),
    slug: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: z.enum(["draft", "active", "archived"]),
    attributes: z.record(z.union([z.string(), z.number(), z.boolean()])),
    variants: z.array(ProductVariant),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Product");

registry.registerPath({
  method: "get",
  path: "/products",
  tags: [TAG],
  summary: "List products (cursor-paginated)",
  request: {
    query: z.object({
      status: z.enum(["draft", "active", "archived"]).optional().openapi({ description: "Filter by status" }),
      cursor: z.string().optional().openapi({ description: "Opaque pagination cursor" }),
      limit: z.coerce.number().int().min(1).max(100).default(20).openapi({ description: "Page size (1–100, default 20)" }),
    }),
  },
  responses: {
    200: {
      description: "Paginated product list",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(Product),
            meta: z.object({
              hasMore: z.boolean(),
              limit: z.number().int(),
              nextCursor: z.string().optional(),
            }),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/products/{idOrSlug}",
  tags: [TAG],
  summary: "Get product by ID or slug",
  request: {
    params: z.object({ idOrSlug: z.string().openapi({ example: "classic-tee" }) }),
  },
  responses: {
    200: {
      description: "Product with variants",
      content: {
        "application/json": {
          schema: z.object({ success: z.literal(true), data: Product }),
        },
      },
    },
    404: { description: "Product not found" },
  },
});

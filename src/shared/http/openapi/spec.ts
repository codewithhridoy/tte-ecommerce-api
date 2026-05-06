import { OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { registry } from "./registry";

export function buildOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: "3.1.0",
    info: {
      title: "TTE Ecommerce API",
      version: "1.0.0",
      description: "B2C ecommerce API — modular monolith",
    },
    servers: [{ url: "/api/v1", description: "Current version" }],
    // Routes may use cookieAuth (browser) or bearerAuth (API / mobile) interchangeably.
    // Individual route definitions override this where a specific scheme is required.
    security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  });
}

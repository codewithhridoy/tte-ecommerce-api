import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { apiReference } from "@scalar/express-api-reference";
import { logger } from "@shared/logger";
import { ok } from "@shared/http/response";
import { buildOpenApiSpec } from "@shared/http/openapi/spec";
// Side-effect imports: register each module's OpenAPI paths into the shared registry.
import "@modules/auth/interfaces/http/openapi";
import "@modules/product/interfaces/http/openapi";
import "@modules/cart/interfaces/http/openapi";
import "@modules/order/interfaces/http/openapi";
import {
  errorHandler,
  notFoundHandler,
} from "@shared/http/middleware/error-handler";
import { requestId } from "@shared/http/middleware/request-id";
import { apiRateLimiter } from "@shared/http/middleware/rate-limit";
import { authenticate, buildAuthModule } from "@modules/auth/index";
import { buildProductModule } from "@modules/product/index";
import { buildInventoryModule } from "@modules/inventory/index";
import { buildDiscountModule } from "@modules/discount/index";
import { buildCartModule } from "@modules/cart/index";
import { buildOrderModule } from "@modules/order/index";
import { buildPaymentModule } from "@modules/payment/index";
import { DrizzleOrderRepository } from "@modules/order/infrastructure/repositories/DrizzleOrderRepository";
import { db } from "@infra/db/client";
import { InMemoryEventBus } from "@infra/events/memory-publisher";
import { OutboxPublisher } from "@infra/events/outbox-publisher";
import { wireDomainEventHandlers } from "@infra/events/wire-handlers";

export interface BuildAppResult {
  app: Express;
  outboxPublisher: OutboxPublisher;
  shutdown: () => Promise<void>;
}

export const buildApp = (): BuildAppResult => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({
        correlationId: (req as { correlationId?: string }).correlationId,
      }),
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/ready",
      },
    }),
  );

  app.get("/health", (_req, res) => res.json(ok({ status: "ok" })));
  app.get("/ready", (_req, res) => res.json(ok({ status: "ready" })));

  // API documentation — served outside /api/v1 so it's not rate-limited.
  const openApiSpec = buildOpenApiSpec();
  app.get("/api/openapi.json", (_req, res) => res.json(openApiSpec));
  app.use(
    "/api/docs",
    apiReference({
      pageTitle: "TTE Ecommerce API Docs",
      content: openApiSpec,
      theme: "purple",
      url: "/openapi.json",
    }),
  );

  // Compose modules.
  const auth = buildAuthModule();
  const product = buildProductModule();
  const inventory = buildInventoryModule();
  const discount = buildDiscountModule();

  const requireAuth: RequestHandler = authenticate(auth.tokenService);
  const optionalAuth: RequestHandler = authenticate(auth.tokenService, {
    optional: true,
  });

  const cart = buildCartModule({
    productRepository: product.productRepository,
    validateCoupon: discount.validateCoupon,
    optionalAuth,
  });

  const order = buildOrderModule({
    cartRepository: cart.cartRepository,
    productRepository: product.productRepository,
    inventoryRepository: inventory.inventoryRepository,
    validateCoupon: discount.validateCoupon,
    requireAuth,
  });

  const orderRepository = new DrizzleOrderRepository(db);
  const payment = buildPaymentModule({ orderRepository });

  // Event bus: in-memory subscriber + outbox relay.
  const bus = new InMemoryEventBus();
  wireDomainEventHandlers(bus, { processPayment: payment.processPayment });
  const outboxPublisher = new OutboxPublisher(bus);

  // API routes — versioned.
  const v1 = express.Router();
  v1.use(apiRateLimiter);
  v1.use("/auth", auth.routes);
  v1.use("/products", product.routes);
  v1.use("/cart", cart.routes);
  v1.use("/orders", order.routes);
  app.use("/api/v1", v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  const shutdown = async (): Promise<void> => {
    logger.info("shutting down app");
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

  return { app, outboxPublisher, shutdown };
};

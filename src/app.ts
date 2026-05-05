import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express, type RequestHandler } from 'express'
import helmet from 'helmet'
import pinoHttp from 'pino-http'
import { logger } from '@shared/logger.js'
import { loadEnv } from '@shared/env.js'
import { ok } from '@shared/http/response.js'
import { errorHandler, notFoundHandler } from '@shared/http/middleware/error-handler.js'
import { requestId } from '@shared/http/middleware/request-id.js'
import { apiRateLimiter } from '@shared/http/middleware/rate-limit.js'
import { authenticate, buildAuthModule } from '@modules/auth/index.js'
import { buildProductModule } from '@modules/product/index.js'
import { buildInventoryModule } from '@modules/inventory/index.js'
import { buildDiscountModule } from '@modules/discount/index.js'
import { buildCartModule } from '@modules/cart/index.js'
import { buildOrderModule } from '@modules/order/index.js'
import { buildPaymentModule } from '@modules/payment/index.js'
import { DrizzleOrderRepository } from '@modules/order/infrastructure/repositories/DrizzleOrderRepository.js'
import { db } from '@infra/db/client.js'
import { InMemoryEventBus } from '@infra/events/memory-publisher.js'
import { OutboxPublisher } from '@infra/events/outbox-publisher.js'
import { wireDomainEventHandlers } from '@infra/events/wire-handlers.js'

export interface BuildAppResult {
  app: Express
  outboxPublisher: OutboxPublisher
  shutdown: () => Promise<void>
}

export const buildApp = (): BuildAppResult => {
  const env = loadEnv()
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: true, credentials: true }))
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(requestId)
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ correlationId: (req as { correlationId?: string }).correlationId }),
      autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/ready' },
    }),
  )

  app.get('/health', (_req, res) => res.json(ok({ status: 'ok' })))
  app.get('/ready', (_req, res) => res.json(ok({ status: 'ready' })))

  // Compose modules.
  const auth = buildAuthModule()
  const product = buildProductModule()
  const inventory = buildInventoryModule()
  const discount = buildDiscountModule()

  const requireAuth: RequestHandler = authenticate(auth.tokenService)
  const optionalAuth: RequestHandler = authenticate(auth.tokenService, { optional: true })

  const cart = buildCartModule({
    productRepository: product.productRepository,
    validateCoupon: discount.validateCoupon,
    optionalAuth,
  })

  const order = buildOrderModule({
    cartRepository: cart.cartRepository,
    productRepository: product.productRepository,
    inventoryRepository: inventory.inventoryRepository,
    validateCoupon: discount.validateCoupon,
    requireAuth,
  })

  const orderRepository = new DrizzleOrderRepository(db)
  const payment = buildPaymentModule({ orderRepository })

  // Event bus: in-memory subscriber + outbox relay.
  const bus = new InMemoryEventBus()
  wireDomainEventHandlers(bus, { processPayment: payment.processPayment })
  const outboxPublisher = new OutboxPublisher(bus)

  // API routes — versioned.
  const v1 = express.Router()
  v1.use(apiRateLimiter)
  v1.use('/auth', auth.routes)
  v1.use('/products', product.routes)
  v1.use('/cart', cart.routes)
  v1.use('/orders', order.routes)
  app.use('/api/v1', v1)

  app.use(notFoundHandler)
  app.use(errorHandler)

  const shutdown = async (): Promise<void> => {
    logger.info('shutting down app')
    await new Promise<void>((resolve) => setImmediate(resolve))
    void env
  }

  return { app, outboxPublisher, shutdown }
}

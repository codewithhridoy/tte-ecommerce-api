import type { RequestHandler, Router } from 'express'
import { db } from '@infra/db/client.js'
import { DrizzleOrderRepository } from './infrastructure/repositories/DrizzleOrderRepository.js'
import { DrizzleIdempotencyRepository } from './infrastructure/repositories/DrizzleIdempotencyRepository.js'
import { CreateOrder } from './application/use-cases/CreateOrder.js'
import { OrderController } from './interfaces/http/OrderController.js'
import { orderRoutes } from './interfaces/http/routes.js'
import type { CartRepository } from '@modules/cart/domain/repositories/CartRepository.js'
import type { ProductRepository } from '@modules/product/domain/repositories/ProductRepository.js'
import type { InventoryRepository } from '@modules/inventory/domain/repositories/InventoryRepository.js'
import type { ValidateCoupon } from '@modules/discount/index.js'

export interface OrderModuleDeps {
  cartRepository: CartRepository
  productRepository: ProductRepository
  inventoryRepository: InventoryRepository
  validateCoupon: ValidateCoupon
  requireAuth: RequestHandler
}

export interface OrderModule {
  routes: Router
  createOrder: CreateOrder
}

export const buildOrderModule = (deps: OrderModuleDeps): OrderModule => {
  const orderRepo = new DrizzleOrderRepository(db)
  const idemRepo = new DrizzleIdempotencyRepository(db)
  const createOrder = new CreateOrder(
    orderRepo,
    deps.cartRepository,
    deps.productRepository,
    deps.inventoryRepository,
    idemRepo,
    deps.validateCoupon,
  )
  const controller = new OrderController(createOrder)
  return { routes: orderRoutes(controller, deps.requireAuth), createOrder }
}

export type { Order, OrderItem } from './domain/entities/Order.js'
export type { OrderStatus } from './domain/value-objects/OrderStatus.js'

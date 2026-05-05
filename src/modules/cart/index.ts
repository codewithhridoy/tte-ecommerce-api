import type { Router, RequestHandler } from 'express'
import { db } from '@infra/db/client.js'
import { DrizzleCartRepository } from './infrastructure/repositories/DrizzleCartRepository.js'
import { AddToCart } from './application/use-cases/AddToCart.js'
import { ApplyCoupon } from './application/use-cases/ApplyCoupon.js'
import { CartController } from './interfaces/http/CartController.js'
import { cartRoutes } from './interfaces/http/routes.js'
import type { ProductRepository } from '@modules/product/domain/repositories/ProductRepository.js'
import type { ValidateCoupon } from '@modules/discount/index.js'
import type { CartRepository } from './domain/repositories/CartRepository.js'

export interface CartModuleDeps {
  productRepository: ProductRepository
  validateCoupon: ValidateCoupon
  optionalAuth: RequestHandler
}

export interface CartModule {
  routes: Router
  cartRepository: CartRepository
}

export const buildCartModule = (deps: CartModuleDeps): CartModule => {
  const cartRepository = new DrizzleCartRepository(db)
  const controller = new CartController(
    new AddToCart(cartRepository, deps.productRepository),
    new ApplyCoupon(cartRepository, deps.validateCoupon),
  )
  return { routes: cartRoutes(controller, deps.optionalAuth), cartRepository }
}

export type { CartRepository } from './domain/repositories/CartRepository.js'
export type { Cart, CartItem } from './domain/entities/Cart.js'
export { subtotalMinor } from './domain/entities/Cart.js'

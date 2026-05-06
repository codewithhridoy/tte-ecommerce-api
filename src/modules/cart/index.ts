import type { Router, RequestHandler } from "express";
import { db } from "@infra/db/client";
import { DrizzleCartRepository } from "./infrastructure/repositories/DrizzleCartRepository";
import { AddToCart } from "./application/use-cases/AddToCart";
import { ApplyCoupon } from "./application/use-cases/ApplyCoupon";
import { CartController } from "./interfaces/http/CartController";
import { cartRoutes } from "./interfaces/http/routes";
import type { ProductRepository } from "@modules/product/domain/repositories/ProductRepository";
import type { ValidateCoupon } from "@modules/discount/index";
import type { CartRepository } from "./domain/repositories/CartRepository";

export interface CartModuleDeps {
  productRepository: ProductRepository;
  validateCoupon: ValidateCoupon;
  optionalAuth: RequestHandler;
}

export interface CartModule {
  routes: Router;
  cartRepository: CartRepository;
}

export const buildCartModule = (deps: CartModuleDeps): CartModule => {
  const cartRepository = new DrizzleCartRepository(db);
  const controller = new CartController(
    new AddToCart(cartRepository, deps.productRepository),
    new ApplyCoupon(cartRepository, deps.validateCoupon),
  );
  return { routes: cartRoutes(controller, deps.optionalAuth), cartRepository };
};

export type { CartRepository } from "./domain/repositories/CartRepository";
export type { Cart, CartItem } from "./domain/entities/Cart";
export { subtotalMinor } from "./domain/entities/Cart";

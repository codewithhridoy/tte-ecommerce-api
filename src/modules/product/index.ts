import type { Router } from 'express'
import { db } from '@infra/db/client.js'
import { redisCache } from '@infra/cache/redis.js'
import { DrizzleProductRepository } from './infrastructure/repositories/DrizzleProductRepository.js'
import { ListProducts } from './application/use-cases/ListProducts.js'
import { GetProduct } from './application/use-cases/GetProduct.js'
import { ProductController } from './interfaces/http/ProductController.js'
import { productRoutes } from './interfaces/http/routes.js'
import type { ProductRepository } from './domain/repositories/ProductRepository.js'

export interface ProductModule {
  routes: Router
  productRepository: ProductRepository
}

export const buildProductModule = (): ProductModule => {
  const productRepository = new DrizzleProductRepository(db)
  const controller = new ProductController(
    new ListProducts(productRepository, redisCache),
    new GetProduct(productRepository, redisCache),
  )
  return { routes: productRoutes(controller), productRepository }
}

export type { ProductRepository } from './domain/repositories/ProductRepository.js'
export type { Product, ProductVariant, ProductWithVariants } from './domain/entities/Product.js'

import { Router } from 'express'
import { asyncHandler } from '@shared/http/async-handler.js'
import type { ProductController } from './ProductController.js'

export const productRoutes = (controller: ProductController): Router => {
  const r = Router()
  r.get('/', asyncHandler(controller.list))
  r.get('/:idOrSlug', asyncHandler(controller.detail))
  return r
}

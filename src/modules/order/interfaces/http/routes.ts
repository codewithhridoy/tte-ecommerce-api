import { Router, type RequestHandler } from 'express'
import { asyncHandler } from '@shared/http/async-handler.js'
import type { OrderController } from './OrderController.js'

export const orderRoutes = (controller: OrderController, requireAuth: RequestHandler): Router => {
  const r = Router()
  r.post('/', requireAuth, asyncHandler(controller.create))
  return r
}

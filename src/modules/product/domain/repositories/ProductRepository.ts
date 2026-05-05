import type { Product, ProductStatus, ProductVariant, ProductWithVariants } from '../entities/Product.js'

export interface ListProductsFilter {
  status?: ProductStatus
  cursor?: { id: string; createdAt: Date } | undefined
  limit: number
}

export interface ListProductsPage {
  items: ProductWithVariants[]
  nextCursor?: { id: string; createdAt: Date } | undefined
}

export interface CreateProductDto {
  id: string
  sku: string
  slug: string
  title: string
  description?: string | null
  status?: ProductStatus
  attributes?: Record<string, string | number | boolean>
}

export interface CreateProductVariantDto {
  id: string
  productId: string
  sku: string
  name: string
  priceMinor: number
  currency?: string
  options?: Record<string, string>
}

export interface ProductRepository {
  list(filter: ListProductsFilter): Promise<ListProductsPage>
  findById(id: string): Promise<ProductWithVariants | null>
  findBySlug(slug: string): Promise<ProductWithVariants | null>
  create(dto: CreateProductDto): Promise<Product>
  addVariant(dto: CreateProductVariantDto): Promise<ProductVariant>
  findVariantsByIds(ids: string[]): Promise<ProductVariant[]>
}

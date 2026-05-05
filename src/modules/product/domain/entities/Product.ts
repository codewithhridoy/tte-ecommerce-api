export type ProductStatus = 'draft' | 'active' | 'archived'

export interface Product {
  id: string
  sku: string
  slug: string
  title: string
  description: string | null
  status: ProductStatus
  attributes: Record<string, string | number | boolean>
  createdAt: Date
  updatedAt: Date
}

export interface ProductVariant {
  id: string
  productId: string
  sku: string
  name: string
  priceMinor: number
  currency: string
  options: Record<string, string>
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[]
}

export interface ApiSuccess<T> {
  success: true
  data: T
  meta?: PaginationMeta
}

export interface ApiFailure {
  success: false
  error: { code: string; message: string; details?: unknown }
}

export interface PaginationMeta {
  nextCursor?: string
  hasMore: boolean
  limit: number
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export const ok = <T>(data: T, meta?: PaginationMeta): ApiSuccess<T> =>
  meta ? { success: true, data, meta } : { success: true, data }

export const fail = (code: string, message: string, details?: unknown): ApiFailure => ({
  success: false,
  error: details !== undefined ? { code, message, details } : { code, message },
})

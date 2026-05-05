export type Money = number

export interface Cursor<T = string> {
  id: T
  createdAt: string
}

export const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString('base64url')

export const decodeCursor = (s: string): Cursor | null => {
  try {
    const parsed = JSON.parse(Buffer.from(s, 'base64url').toString('utf8')) as Cursor
    if (typeof parsed.id !== 'string' || typeof parsed.createdAt !== 'string') return null
    return parsed
  } catch {
    return null
  }
}

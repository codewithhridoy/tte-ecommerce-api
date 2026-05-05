export type UserRole = 'customer' | 'staff' | 'admin'

export interface User {
  id: string
  email: string
  fullName: string | null
  role: UserRole
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserWithSecret extends User {
  passwordHash: string
}

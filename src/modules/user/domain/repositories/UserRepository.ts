import type { User, UserRole, UserWithSecret } from '../entities/User.js'

export interface CreateUserDto {
  id: string
  email: string
  passwordHash: string
  fullName?: string | null
  role?: UserRole
}

export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByEmail(email: string): Promise<UserWithSecret | null>
  create(dto: CreateUserDto): Promise<User>
  setActive(id: string, active: boolean): Promise<void>
}

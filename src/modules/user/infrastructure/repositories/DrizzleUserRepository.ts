import { eq } from 'drizzle-orm'
import type { DbClient } from '@infra/db/client.js'
import { users } from '@infra/db/schema/index.js'
import type { User, UserWithSecret } from '../../domain/entities/User.js'
import type { CreateUserDto, UserRepository } from '../../domain/repositories/UserRepository.js'

const toUser = (row: typeof users.$inferSelect): User => ({
  id: row.id,
  email: row.email,
  fullName: row.fullName,
  role: row.role,
  isActive: row.isActive,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: DbClient) {}

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1)
    return row ? toUser(row) : null
  }

  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    if (!row) return null
    return { ...toUser(row), passwordHash: row.passwordHash }
  }

  async create(dto: CreateUserDto): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: dto.id,
        email: dto.email.toLowerCase(),
        passwordHash: dto.passwordHash,
        fullName: dto.fullName ?? null,
        role: dto.role ?? 'customer',
      })
      .returning()
    if (!row) throw new Error('User insert returned no row')
    return toUser(row)
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.db.update(users).set({ isActive: active, updatedAt: new Date() }).where(eq(users.id, id))
  }
}

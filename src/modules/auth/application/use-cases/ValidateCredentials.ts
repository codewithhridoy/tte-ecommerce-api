import { z } from 'zod'
import { UnauthenticatedError } from '@shared/errors'
import type { UserRepository } from '@modules/user/index.js'
import type { PasswordHasher } from '../../domain/services/PasswordHasher.js'

export const ValidateCredentialsInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type ValidateCredentialsInput = z.infer<typeof ValidateCredentialsInput>

export interface ValidateCredentialsOutput {
  userId: string
}

export class ValidateCredentials {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasher,
  ) {}

  async execute(input: ValidateCredentialsInput): Promise<ValidateCredentialsOutput> {
    const user = await this.users.findByEmail(input.email)
    if (!user || !user.isActive) throw new UnauthenticatedError('Invalid credentials')

    const valid = await this.hasher.verify(user.passwordHash, input.password)
    if (!valid) throw new UnauthenticatedError('Invalid credentials')

    return { userId: user.id }
  }
}

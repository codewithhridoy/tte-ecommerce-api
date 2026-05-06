import { z } from 'zod'
import { NotFoundError, UnauthenticatedError } from '@shared/errors'
import type { UserRepository } from '@modules/user/index.js'
import type { OtpTokenRepository } from '../../domain/repositories/OtpTokenRepository.js'
import type { OtpPurpose } from '../../domain/entities/OtpToken.js'
import { OtpService } from '../../domain/services/OtpService.js'
import type { OtpVerifier, OtpVerifyInput } from '../services/OtpVerifier.js'

export const VerifyOtpInput = z.object({
  userId: z.string().uuid(),
  purpose: z.enum(['email_verification', 'login', 'password_reset']),
  code: z.string().min(4).max(10),
})
export type VerifyOtpInput = z.infer<typeof VerifyOtpInput>

export interface VerifyOtpOutput {
  verified: true
}

export class VerifyOtp implements OtpVerifier {
  constructor(
    private readonly users: UserRepository,
    private readonly otpTokens: OtpTokenRepository,
  ) {}

  /** Implements OtpVerifier — throws UnauthenticatedError on failure. */
  async verify(input: OtpVerifyInput): Promise<void> {
    await this.execute(input)
  }

  async execute(input: VerifyOtpInput): Promise<VerifyOtpOutput> {
    const user = await this.users.findById(input.userId)
    if (!user || !user.isActive) throw new NotFoundError('User')

    const codeHash = OtpService.hash(input.code)
    const token = await this.otpTokens.findActiveByHash(
      codeHash,
      input.userId,
      input.purpose as OtpPurpose,
    )

    if (!token) throw new UnauthenticatedError('Invalid or expired OTP')
    if (token.expiresAt < new Date()) throw new UnauthenticatedError('Invalid or expired OTP')

    await this.otpTokens.markUsed(token.id)
    return { verified: true }
  }
}

import { z } from 'zod'
import { NotFoundError, PreconditionFailedError } from '@shared/errors'
import { newId } from '@shared/id'
import type { UserRepository } from '@modules/user/index.js'
import type { OtpTokenRepository } from '../../domain/repositories/OtpTokenRepository.js'
import type { OtpPurpose } from '../../domain/entities/OtpToken.js'
import type { OtpService } from '../../domain/services/OtpService.js'
import type { OtpNotifier } from '../../domain/services/OtpNotifier.js'

export const SendOtpInput = z.object({
  userId: z.string().uuid(),
  purpose: z.enum(['email_verification', 'login', 'password_reset']),
})
export type SendOtpInput = z.infer<typeof SendOtpInput>

export interface SendOtpOutput {
  /** Plain-text code — caller is responsible for delivering it (email/SMS). */
  code: string
  expiresAt: Date
  /** Earliest time the client may request another OTP for this user+purpose. */
  resendAllowedAt: Date
}

export class SendOtp {
  constructor(
    private readonly users: UserRepository,
    private readonly otpTokens: OtpTokenRepository,
    private readonly otpService: OtpService,
    private readonly notifier: OtpNotifier,
  ) {}

  async execute(input: SendOtpInput): Promise<SendOtpOutput> {
    const user = await this.users.findById(input.userId)
    if (!user || !user.isActive) throw new NotFoundError('User')

    const existing = await this.otpTokens.findLatestActive(
      input.userId,
      input.purpose as OtpPurpose,
    )

    if (existing) {
      const resendAllowedAt = this.otpService.resendAllowedAt(existing.createdAt)
      if (resendAllowedAt > new Date()) {
        throw new PreconditionFailedError(
          `OTP already sent. Resend allowed after ${resendAllowedAt.toISOString()}`,
        )
      }
    }

    // Revoke any outstanding OTPs for this user+purpose before issuing a new one.
    await this.otpTokens.revokeAllForUser(input.userId, input.purpose as OtpPurpose)

    const { code, hash, expiresAt } = this.otpService.generate()
    const token = await this.otpTokens.create({
      id: newId(),
      userId: input.userId,
      codeHash: hash,
      purpose: input.purpose as OtpPurpose,
      expiresAt,
    })

    await this.notifier.send({
      email: user.email,
      code,
      purpose: input.purpose as OtpPurpose,
      expiresAt,
    })

    return {
      code,
      expiresAt,
      resendAllowedAt: this.otpService.resendAllowedAt(token.createdAt),
    }
  }
}

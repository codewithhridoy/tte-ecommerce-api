import type { OtpPurpose } from '../../domain/entities/OtpToken.js'

export interface OtpVerifyInput {
  userId: string
  purpose: OtpPurpose
  code: string
}

/** Thin service interface consumed by other modules via DI. */
export interface OtpVerifier {
  verify(input: OtpVerifyInput): Promise<void>
}

export type OtpPurpose = 'email_verification' | 'login' | 'password_reset'

export interface OtpToken {
  id: string
  userId: string
  codeHash: string
  purpose: OtpPurpose
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

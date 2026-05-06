import type { OtpPurpose } from '../entities/OtpToken.js'

export interface OtpNotifyPayload {
  email: string
  code: string
  purpose: OtpPurpose
  expiresAt: Date
}

export interface OtpNotifier {
  send(payload: OtpNotifyPayload): Promise<void>
}

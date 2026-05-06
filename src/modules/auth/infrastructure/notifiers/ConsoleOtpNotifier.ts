import type { OtpNotifier, OtpNotifyPayload } from '../../domain/services/OtpNotifier.js'
import { logger } from '@shared/logger.js'

export class ConsoleOtpNotifier implements OtpNotifier {
  async send(payload: OtpNotifyPayload): Promise<void> {
    logger.info(
      { email: payload.email, purpose: payload.purpose, expiresAt: payload.expiresAt },
      `[DEV] OTP code: ${payload.code}`,
    )
  }
}

import { Resend } from 'resend'
import type { OtpNotifier, OtpNotifyPayload } from '../../domain/services/OtpNotifier.js'

const SUBJECT: Record<string, string> = {
  email_verification: 'Verify your email',
  login: 'Your login code',
  password_reset: 'Reset your password',
}

export class ResendOtpNotifier implements OtpNotifier {
  private readonly client: Resend

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey)
  }

  async send(payload: OtpNotifyPayload): Promise<void> {
    const subject = SUBJECT[payload.purpose] ?? 'Your verification code'

    const { error } = await this.client.emails.send({
      from: this.from,
      to: payload.email,
      subject,
      text: [
        `Your code is: ${payload.code}`,
        `It expires at ${payload.expiresAt.toISOString()}.`,
        'Do not share this code with anyone.',
      ].join('\n\n'),
    })

    if (error) {
      throw new Error(`Failed to send OTP email via Resend: ${error.message}`)
    }
  }
}

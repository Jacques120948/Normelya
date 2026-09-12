import type { Locale } from '@normelya/core'

/**
 * Port d'envoi de courrier transactionnel.
 *
 * Les gabarits sont nommés, jamais composés depuis l'appelant : cela évite
 * qu'une donnée utilisateur se retrouve interpolée dans un sujet ou un en-tête.
 */
export type MailTemplate =
  | 'verification_email'
  | 'password_reset'
  | 'invitation'
  | 'account_deleted'
  | 'compliance_alert'

export type MailMessage = {
  to: string
  template: MailTemplate
  locale: Locale
  variables: Record<string, string>
}

export interface MailSender {
  readonly name: string
  send(message: MailMessage): Promise<void>
}

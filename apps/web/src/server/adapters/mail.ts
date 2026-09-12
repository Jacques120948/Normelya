import type { MailMessage, MailSender } from '../ports/mail'

/**
 * Gabarits de courrier.
 *
 * Le sujet et le corps ne sont jamais composés par l'appelant : seules des
 * variables sont injectées, et elles sont échappées à l'insertion.
 */
const TEMPLATES_FR: Record<
  MailMessage['template'],
  { subject: string; body: (v: Record<string, string>) => string }
> = {
  verification_email: {
    subject: 'Confirmez votre adresse e-mail',
    body: (v) =>
      `Bienvenue sur Normelya.\n\nConfirmez votre adresse en ouvrant ce lien :\n${v.url ?? ''}\n\nCe lien expire dans 24 heures.`,
  },
  password_reset: {
    subject: 'Réinitialisation de votre mot de passe',
    body: (v) =>
      `Vous avez demandé à réinitialiser votre mot de passe Normelya.\n\n${v.url ?? ''}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  },
  invitation: {
    subject: 'Vous êtes invité à rejoindre un atelier sur Normelya',
    body: (v) =>
      `${v.inviterName ?? 'Un utilisateur'} vous invite à rejoindre l'atelier ${v.organizationName ?? ''} sur Normelya.\n\n${v.url ?? ''}`,
  },
  account_deleted: {
    subject: 'Votre compte Normelya a été supprimé',
    body: () =>
      `Votre compte et vos documents ont été supprimés. Cette opération est définitive.`,
  },
  compliance_alert: {
    subject: 'Une vérification est nécessaire sur votre atelier',
    body: (v) => `${v.title ?? ''}\n\n${v.body ?? ''}\n\n${v.url ?? ''}`,
  },
}

/** Envoi en développement : rien ne part, tout est visible dans la console. */
export class ConsoleMailSender implements MailSender {
  readonly name = 'console'
  readonly sent: MailMessage[] = []

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message)
    const template = TEMPLATES_FR[message.template]
    console.warn(
      `\n--- Courrier (mode console) ---\nÀ : ${message.to}\nSujet : ${template.subject}\n\n${template.body(message.variables)}\n---\n`,
    )
  }
}

/** Envoi réel via Resend. */
export class ResendMailSender implements MailSender {
  readonly name = 'resend'

  constructor(
    private readonly config: { apiKey: string; from: string },
  ) {}

  async send(message: MailMessage): Promise<void> {
    const template = TEMPLATES_FR[message.template]
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.from,
        to: message.to,
        subject: template.subject,
        text: template.body(message.variables),
      }),
    })

    if (!response.ok) {
      throw new Error(`Envoi de courrier refusé (${response.status}).`)
    }
  }
}

export type AppErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'QUOTA_EXCEEDED'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED_FILE'
  | 'FILE_TOO_LARGE'
  | 'REGULATORY_REVIEW_REQUIRED'
  | 'PROVIDER_ERROR'
  | 'INTERNAL'

/**
 * Erreur applicative porteuse d'un code stable et d'un message destiné à
 * l'utilisateur final. Aucun détail technique n'est exposé au client.
 */
export class AppError extends Error {
  readonly code: AppErrorCode
  readonly userMessage: string
  readonly details?: Record<string, unknown>

  constructor(
    code: AppErrorCode,
    userMessage: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(`${code}: ${userMessage}`, options?.cause ? { cause: options.cause } : undefined)
    this.name = 'AppError'
    this.code = code
    this.userMessage = userMessage
    this.details = options?.details
  }

  static unauthenticated(message = 'Vous devez être connecté pour effectuer cette action.') {
    return new AppError('UNAUTHENTICATED', message)
  }

  static forbidden(message = "Vous n'avez pas accès à cette ressource.") {
    return new AppError('FORBIDDEN', message)
  }

  static notFound(message = "Cet élément n'existe pas ou n'est plus accessible.") {
    return new AppError('NOT_FOUND', message)
  }

  static quotaExceeded(message: string, details?: Record<string, unknown>) {
    return new AppError('QUOTA_EXCEEDED', message, { details })
  }

  static rateLimited(message = 'Trop de tentatives. Réessayez dans quelques instants.') {
    return new AppError('RATE_LIMITED', message)
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError('VALIDATION_FAILED', message, { details })
  }
}

/** Codes d'erreur qui ne doivent jamais faire l'objet d'une valeur de repli. */
export const NEVER_GUESS_CODES: readonly AppErrorCode[] = ['REGULATORY_REVIEW_REQUIRED']

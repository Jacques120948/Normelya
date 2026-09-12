/**
 * Limitation de débit.
 *
 * Implémentation en mémoire, suffisante pour une instance unique et pour les
 * tests. L'interface permet de lui substituer un backend partagé (Redis,
 * PostgreSQL) sans toucher aux appelants, lorsque l'application tournera sur
 * plusieurs instances.
 *
 * L'horloge est injectable : les tests ne dépendent pas du temps réel.
 */

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  /** Horodatage auquel la fenêtre se réinitialise. */
  resetAt: number
  retryAfterSeconds: number
}

export interface RateLimiter {
  check(key: string, rule: RateLimitRule): Promise<RateLimitResult>
  reset(key: string): Promise<void>
}

export type RateLimitRule = {
  /** Nombre de tentatives autorisées dans la fenêtre. */
  limit: number
  /** Durée de la fenêtre, en millisecondes. */
  windowMs: number
}

/**
 * Règles appliquées aux points sensibles.
 *
 * Elles protègent d'abord l'utilisateur (énumération de comptes, force brute)
 * et ensuite le budget (extraction assistée par IA).
 */
export const RATE_LIMIT_RULES = {
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  signUp: { limit: 5, windowMs: 60 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  resendVerification: { limit: 3, windowMs: 60 * 60_000 },
  upload: { limit: 30, windowMs: 60 * 60_000 },
  aiExtraction: { limit: 20, windowMs: 60 * 60_000 },
  mutation: { limit: 300, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitAction = keyof typeof RATE_LIMIT_RULES

type Window = { count: number; resetAt: number }

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, Window>()
  private readonly now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  async check(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    const current = this.now()
    const existing = this.windows.get(key)

    if (!existing || existing.resetAt <= current) {
      const resetAt = current + rule.windowMs
      this.windows.set(key, { count: 1, resetAt })
      return {
        allowed: true,
        remaining: rule.limit - 1,
        resetAt,
        retryAfterSeconds: 0,
      }
    }

    if (existing.count >= rule.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - current) / 1000)),
      }
    }

    existing.count += 1
    return {
      allowed: true,
      remaining: rule.limit - existing.count,
      resetAt: existing.resetAt,
      retryAfterSeconds: 0,
    }
  }

  async reset(key: string): Promise<void> {
    this.windows.delete(key)
  }

  /** Purge les fenêtres expirées. À appeler périodiquement. */
  purge(): void {
    const current = this.now()
    for (const [key, window] of this.windows) {
      if (window.resetAt <= current) this.windows.delete(key)
    }
  }

  get size(): number {
    return this.windows.size
  }
}

/**
 * Construit la clé de limitation.
 *
 * L'identifiant (adresse IP, e-mail) est haché par l'appelant : la clé ne doit
 * pas contenir de donnée personnelle en clair.
 */
export function rateLimitKey(action: RateLimitAction, identifier: string): string {
  return `${action}:${identifier}`
}

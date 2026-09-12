import { describe, expect, it } from 'vitest'
import {
  InMemoryRateLimiter,
  RATE_LIMIT_RULES,
  rateLimitKey,
} from '../rate-limit'

/** Horloge contrôlée : aucun test ne dépend du temps réel. */
function horlogeSimulee(depart = 1_000_000) {
  let maintenant = depart
  return {
    now: () => maintenant,
    avancerDe: (ms: number) => {
      maintenant += ms
    },
  }
}

describe('limitation de débit', () => {
  const regle = { limit: 3, windowMs: 60_000 }

  it('autorise jusqu’à la limite puis refuse', async () => {
    const horloge = horlogeSimulee()
    const limiteur = new InMemoryRateLimiter(horloge.now)

    const premier = await limiteur.check('a', regle)
    expect(premier).toMatchObject({ allowed: true, remaining: 2 })

    await limiteur.check('a', regle)
    const troisieme = await limiteur.check('a', regle)
    expect(troisieme).toMatchObject({ allowed: true, remaining: 0 })

    const quatrieme = await limiteur.check('a', regle)
    expect(quatrieme.allowed).toBe(false)
    expect(quatrieme.remaining).toBe(0)
    expect(quatrieme.retryAfterSeconds).toBe(60)
  })

  it('réinitialise après la fenêtre', async () => {
    const horloge = horlogeSimulee()
    const limiteur = new InMemoryRateLimiter(horloge.now)

    for (let i = 0; i < 3; i += 1) await limiteur.check('a', regle)
    expect((await limiteur.check('a', regle)).allowed).toBe(false)

    horloge.avancerDe(60_001)
    const apres = await limiteur.check('a', regle)
    expect(apres.allowed).toBe(true)
    expect(apres.remaining).toBe(2)
  })

  it('compte chaque clé séparément', async () => {
    const limiteur = new InMemoryRateLimiter(horlogeSimulee().now)
    for (let i = 0; i < 3; i += 1) await limiteur.check('a', regle)
    expect((await limiteur.check('a', regle)).allowed).toBe(false)
    expect((await limiteur.check('b', regle)).allowed).toBe(true)
  })

  it('permet une réinitialisation explicite après une connexion réussie', async () => {
    const limiteur = new InMemoryRateLimiter(horlogeSimulee().now)
    for (let i = 0; i < 3; i += 1) await limiteur.check('a', regle)
    await limiteur.reset('a')
    expect((await limiteur.check('a', regle)).allowed).toBe(true)
  })

  it('purge les fenêtres expirées', async () => {
    const horloge = horlogeSimulee()
    const limiteur = new InMemoryRateLimiter(horloge.now)
    await limiteur.check('a', regle)
    await limiteur.check('b', regle)
    expect(limiteur.size).toBe(2)

    horloge.avancerDe(60_001)
    limiteur.purge()
    expect(limiteur.size).toBe(0)
  })

  it('protège les points sensibles avec des règles strictes', () => {
    expect(RATE_LIMIT_RULES.signIn.limit).toBeLessThanOrEqual(10)
    expect(RATE_LIMIT_RULES.passwordReset.limit).toBeLessThanOrEqual(5)
    expect(RATE_LIMIT_RULES.resendVerification.limit).toBeLessThanOrEqual(3)
    // La fenêtre de connexion couvre au moins un quart d'heure.
    expect(RATE_LIMIT_RULES.signIn.windowMs).toBeGreaterThanOrEqual(15 * 60_000)
  })

  it('construit une clé à partir de l’action et d’un identifiant', () => {
    expect(rateLimitKey('signIn', 'abc123')).toBe('signIn:abc123')
  })
})

import { describe, expect, it } from 'vitest'
import { err, ok, type Result } from '@normelya/core'
import type { AuthError, AuthProvider, AuthUser } from '../../ports/auth'
import type { Database, DatabaseClient } from '../../ports/database'
import type { MailSender, MailMessage } from '../../ports/mail'
import { InMemoryRateLimiter } from '../../security/rate-limit'
import { requestPasswordReset, signIn, signUp } from '../auth'

/** Base de données factice : mémorise les requêtes sans rien exécuter. */
function baseFactice() {
  const requetes: string[] = []
  const client: DatabaseClient = {
    query: async (sql) => {
      requetes.push(sql)
      return []
    },
    queryOne: async (sql) => {
      requetes.push(sql)
      return { id: 'user-1' } as never
    },
  }
  const db: Database = {
    query: client.query,
    queryOne: client.queryOne,
    transaction: (run) => run(client),
    withContext: (_ctx, run) => run(client),
    close: async () => undefined,
  }
  return { db, requetes }
}

function courrierFactice() {
  const envoyes: MailMessage[] = []
  const mail: MailSender = {
    name: 'test',
    send: async (message) => {
      envoyes.push(message)
    },
  }
  return { mail, envoyes }
}

type ComportementAuth = {
  signUp?: Result<AuthUser, AuthError>
  signIn?: Result<
    { user: AuthUser; accessToken: string; refreshToken: string },
    AuthError
  >
}

function authFactice(comportement: ComportementAuth = {}) {
  const appels: string[] = []
  const utilisateur: AuthUser = {
    subject: 'sub-1',
    email: 'jean@exemple.fr',
    emailVerified: false,
  }
  const auth: AuthProvider = {
    name: 'test',
    signUp: async () => {
      appels.push('signUp')
      return comportement.signUp ?? ok(utilisateur)
    },
    signIn: async () => {
      appels.push('signIn')
      return (
        comportement.signIn ??
        ok({ user: { ...utilisateur, emailVerified: true }, accessToken: 'at', refreshToken: 'rt' })
      )
    },
    signOut: async () => {
      appels.push('signOut')
    },
    resendVerification: async () => {
      appels.push('resendVerification')
      return ok(undefined)
    },
    requestPasswordReset: async () => {
      appels.push('requestPasswordReset')
      return ok(undefined)
    },
    resetPassword: async () => ok(undefined),
    getUser: async () => utilisateur,
    deleteUser: async () => ok(undefined),
  }
  return { auth, appels }
}

function dependances(comportement?: ComportementAuth) {
  const { db } = baseFactice()
  const { auth, appels } = authFactice(comportement)
  const { mail, envoyes } = courrierFactice()
  return {
    deps: {
      auth,
      db,
      serviceDb: db,
      mail,
      rateLimiter: new InMemoryRateLimiter(),
      appUrl: 'https://normelya.test',
    },
    appels,
    envoyes,
  }
}

const inscription = {
  email: 'jean@exemple.fr',
  password: 'motdepassecorrect',
  acceptTerms: true as const,
}

describe('inscription', () => {
  it('crée le compte et la fiche applicative', async () => {
    const { deps } = dependances()
    const resultat = await signUp(deps, inscription)
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.emailSent).toBe(true)
    expect(resultat.value.userId).toBe('user-1')
  })

  it('ne révèle pas qu’une adresse est déjà enregistrée', async () => {
    const { deps } = dependances({ signUp: err({ kind: 'email_already_used' }) })
    const resultat = await signUp(deps, inscription)
    // Même forme de réponse que pour une création réussie : impossible
    // d'énumérer les comptes existants depuis le formulaire d'inscription.
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.emailSent).toBe(true)
    expect(resultat.value.userId).toBeNull()
  })

  it('limite le nombre d’inscriptions par adresse IP', async () => {
    const { deps } = dependances()
    const meta = { ip: '10.0.0.1' }
    for (let i = 0; i < 5; i += 1) {
      const essai = await signUp(deps, inscription, meta)
      expect(essai.ok).toBe(true)
    }
    const sixieme = await signUp(deps, inscription, meta)
    expect(sixieme.ok).toBe(false)
    if (sixieme.ok) return
    expect(sixieme.error.code).toBe('RATE_LIMITED')
  })
})

describe('connexion', () => {
  it('renvoie les jetons de session', async () => {
    const { deps } = dependances()
    const resultat = await signIn(deps, { email: 'jean@exemple.fr', password: 'motdepasse' })
    expect(resultat.ok).toBe(true)
    if (!resultat.ok) return
    expect(resultat.value.accessToken).toBe('at')
    expect(resultat.value.emailVerified).toBe(true)
  })

  it('donne le même message pour un mot de passe faux et un compte inconnu', async () => {
    const { deps } = dependances({ signIn: err({ kind: 'invalid_credentials' }) })
    const resultat = await signIn(deps, { email: 'inconnu@exemple.fr', password: 'x' })
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.error.userMessage).toBe('Adresse e-mail ou mot de passe incorrect.')
  })

  it('bloque après dix tentatives infructueuses', async () => {
    const { deps } = dependances({ signIn: err({ kind: 'invalid_credentials' }) })
    const meta = { ip: '10.0.0.2' }
    for (let i = 0; i < 10; i += 1) {
      await signIn(deps, { email: 'jean@exemple.fr', password: 'faux' }, meta)
    }
    const bloque = await signIn(deps, { email: 'jean@exemple.fr', password: 'faux' }, meta)
    expect(bloque.ok).toBe(false)
    if (bloque.ok) return
    expect(bloque.error.code).toBe('RATE_LIMITED')
  })

  it('remet le compteur à zéro après une connexion réussie', async () => {
    const { deps } = dependances()
    const meta = { ip: '10.0.0.3' }
    for (let i = 0; i < 9; i += 1) {
      await signIn(deps, { email: 'jean@exemple.fr', password: 'bon' }, meta)
    }
    // Après neuf succès, le compteur est remis à zéro à chaque fois :
    // un utilisateur légitime n'est jamais bloqué.
    for (let i = 0; i < 9; i += 1) {
      const essai = await signIn(deps, { email: 'jean@exemple.fr', password: 'bon' }, meta)
      expect(essai.ok).toBe(true)
    }
  })
})

describe('mot de passe oublié', () => {
  it('répond toujours de la même façon, adresse connue ou non', async () => {
    const { deps, appels } = dependances()
    const premier = await requestPasswordReset(deps, 'connu@exemple.fr')
    const second = await requestPasswordReset(deps, 'inconnu@exemple.fr')
    expect(premier.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(appels.filter((a) => a === 'requestPasswordReset')).toHaveLength(2)
  })

  it('reste silencieux au-delà de la limite, sans révéler le blocage', async () => {
    const { deps, appels } = dependances()
    const meta = { ip: '10.0.0.4' }
    for (let i = 0; i < 6; i += 1) {
      const essai = await requestPasswordReset(deps, 'jean@exemple.fr', meta)
      expect(essai.ok).toBe(true)
    }
    // La sixième demande n'atteint pas le fournisseur.
    expect(appels.filter((a) => a === 'requestPasswordReset')).toHaveLength(5)
  })
})

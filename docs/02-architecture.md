# 02 — Architecture technique

## 2.1 Principes directeurs

1. **Le moteur réglementaire est un module isolé.** Aucune dépendance à React,
   Next.js, à la base de données ou au réseau. Entrée : un objet JSON. Sortie :
   un objet JSON. Il est publiable comme paquet npm interne et testable seul.
2. **Aucun verrouillage fournisseur bloquant.** Supabase est utilisé comme
   *implémentation* de trois ports (base, authentification, stockage), jamais
   comme API appelée directement depuis le code métier.
3. **Défense en profondeur sur l'isolation des données.** Chaque requête est
   filtrée par organisation dans le code applicatif **et** par Row Level Security
   dans PostgreSQL. Les deux, pas l'un ou l'autre.
4. **Tout ce qui est réglementaire est immuable et versionné.** Une analyse
   produite en 2026 doit pouvoir être rejouée à l'identique en 2030.
5. **Coût maîtrisé.** Pas d'infrastructure exotique, pas d'appel IA lorsqu'un
   algorithme classique suffit, cache agressif sur les extractions.

## 2.2 Vue d'ensemble

```
┌──────────────────────────────────────────────────────────────────┐
│  Navigateur (desktop / tablette / mobile)                        │
│  Next.js App Router · React Server Components · Tailwind         │
└───────────────┬──────────────────────────────────────────────────┘
                │ HTTPS
┌───────────────▼──────────────────────────────────────────────────┐
│  apps/web — Next.js (Node runtime)                               │
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────────┐ │
│  │ Pages RSC  │  │ Server       │  │ Route handlers (/api)     │ │
│  │ + formu-   │  │ Actions      │  │ webhooks Stripe, exports  │ │
│  │ laires     │  │ (mutations)  │  │ fichiers signés           │ │
│  └─────┬──────┘  └──────┬───────┘  └──────────┬────────────────┘ │
│        └────────────────┴─────────────────────┘                  │
│                         │ appel typé                             │
│  ┌──────────────────────▼─────────────────────────────────────┐  │
│  │  Couche application (services métier)                      │  │
│  │  auth · organisations · matières · FDS · produits ·        │  │
│  │  recettes · analyses · étiquettes · documents · quotas     │  │
│  │  Toute entrée validée par Zod. Toute action auditée.       │  │
│  └───┬───────────┬───────────────┬──────────────┬─────────────┘  │
└──────┼───────────┼───────────────┼──────────────┼────────────────┘
       │           │               │              │
┌──────▼─────┐ ┌───▼──────────┐ ┌──▼───────────┐ ┌▼───────────────┐
│ Ports      │ │ packages/    │ │ packages/    │ │ packages/      │
│ db/auth/   │ │ regulatory-  │ │ sds-         │ │ label-         │
│ storage/   │ │ engine       │ │ extraction   │ │ renderer       │
│ mail/pay   │ │ (pur, testé) │ │ (parsing +   │ │ (PDF/PNG)      │
│            │ │              │ │  IA option.) │ │                │
└──┬──┬──┬───┘ └──────────────┘ └──────┬───────┘ └────────────────┘
   │  │  │                             │
   │  │  └──── Stripe (paiement)       └──── Fournisseur IA (optionnel, § 11)
   │  └─────── Resend (e-mail transactionnel)
   └────────── PostgreSQL + Storage (Supabase, remplaçable)
```

## 2.3 Choix techniques

| Domaine | Choix | Justification |
|---------|-------|---------------|
| Framework | Next.js (App Router) | Rendu serveur, un seul déploiement, coût faible |
| Langage | TypeScript `strict` | Le domaine réglementaire ne tolère pas l'à-peu-près |
| UI | Tailwind CSS + composants maison | Design system propre, pas de kit tiers marqué |
| Base | PostgreSQL 15+ | RLS natif, JSONB, contraintes fortes |
| Accès données | SQL + requêtes typées, migrations SQL versionnées | La base est la source de vérité, pas l'ORM |
| Auth | Supabase Auth derrière un port `AuthProvider` | Coût nul au départ, remplaçable |
| Stockage | Bucket privé + URL signées courtes | Aucun document utilisateur public |
| Paiement | Stripe (Checkout + Billing Portal + webhooks) | Standard, faible maintenance |
| PDF | Génération serveur, pas de dépendance navigateur | Reproductibilité du rendu |
| Validation | Zod, côté serveur systématiquement | Le client n'est jamais digne de confiance |
| Tests | Vitest (unitaire/intégration) + Playwright (E2E) | Un seul écosystème |

### Pourquoi pas un ORM lourd

Le schéma comporte des contraintes fortes (immuabilité des analyses, RLS,
politiques par rôle, index partiels). Écrire les migrations en SQL garde ces
garanties visibles et auditables. Une couche de requêtes typées suffit pour le
confort de développement.

### Frontière avec Supabase

Le code métier n'importe jamais `@supabase/*`. Il appelle :

```
AuthProvider   signUp, signIn, signOut, verifyEmail, requestPasswordReset,
               resetPassword, deleteUser, getUserFromRequest
Database       query<T>(sql, params), transaction(fn), withTenant(orgId, fn)
FileStorage    put, getSignedUrl, delete, stat
MailSender     send(template, to, vars)
PaymentGateway createCheckoutSession, createPortalSession, parseWebhook
```

Migrer vers une autre infrastructure revient à réécrire quatre adaptateurs, pas
l'application.

## 2.4 Arborescence du projet

```
normelya/
├── package.json                    # workspaces npm
├── docs/                           # ce dossier
│   └── adr/                        # décisions d'architecture
├── db/
│   ├── migrations/                 # 0001_*.sql, 0002_*.sql … versionnées
│   ├── seeds/                      # jeux de données DEMO uniquement
│   └── policies/                   # doc lisible des politiques RLS
├── packages/
│   ├── core/                       # types du domaine, schémas Zod partagés,
│   │                               # unités, erreurs, résultats
│   ├── regulatory-engine/          # MOTEUR — aucune dépendance runtime
│   │   ├── src/
│   │   │   ├── engine/             # orchestration du calcul
│   │   │   ├── rules/
│   │   │   │   ├── eu/             # règles UE (CLP)
│   │   │   │   ├── france/         # spécificités françaises
│   │   │   │   └── switzerland/    # spécificités suisses
│   │   │   ├── calculators/        # additivité, seuils, cumuls
│   │   │   ├── thresholds/         # tables de seuils, versionnées
│   │   │   ├── substances/         # référentiel interne (CAS/CE)
│   │   │   ├── validation/         # contrôles d'entrée, complétude
│   │   │   ├── ufi/                # déclenchement et enregistrement UFI
│   │   │   └── version.ts          # NORMELYA_EU_CLP_YYYY_NN
│   │   └── tests/                  # couverture renforcée + non-régression
│   ├── regulatory-sources/         # sources citables, une entrée par règle
│   ├── sds-extraction/             # parsing PDF, heuristiques, IA optionnelle
│   ├── label-renderer/             # mise en page étiquette → PDF / PNG
│   ├── costing/                    # coût de revient (hors moteur)
│   └── ui/                         # design system Normelya
├── apps/
│   ├── web/                        # application + landing + API
│   │   ├── src/app/
│   │   │   ├── (marketing)/        # landing, pages SEO, pages légales
│   │   │   ├── (auth)/             # inscription, connexion, mot de passe
│   │   │   ├── (app)/              # espace connecté
│   │   │   │   ├── onboarding/
│   │   │   │   ├── tableau-de-bord/
│   │   │   │   ├── produits/
│   │   │   │   ├── matieres-premieres/
│   │   │   │   ├── documents/
│   │   │   │   ├── conformite/
│   │   │   │   ├── alertes/
│   │   │   │   ├── assistant/
│   │   │   │   ├── parametres/
│   │   │   │   └── abonnement/
│   │   │   ├── (admin)/            # back-office Normelya, rôles internes
│   │   │   └── api/                # webhooks, téléchargements signés
│   │   ├── src/server/             # services métier, ports, adaptateurs
│   │   │   ├── application/        # cas d'usage
│   │   │   ├── ports/              # interfaces
│   │   │   ├── adapters/           # supabase, stripe, resend, local
│   │   │   ├── security/           # session, rôles, quotas, rate limit, audit
│   │   │   └── repositories/       # accès données, toujours scopés org
│   │   └── src/i18n/               # fr par défaut, de/it/en préparés
│   └── (futur) admin/              # si le back-office doit être séparé
├── e2e/                            # Playwright
└── .github/workflows/              # CI : lint, types, tests, migrations
```

## 2.5 Modèle de sécurité applicative

Chaque requête authentifiée résout un **contexte** unique :

```ts
type RequestContext = {
  userId: string
  organizationId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  plan: 'free' | 'essential' | 'pro' | 'atelier'
  locale: 'fr' | 'de' | 'it' | 'en'
}
```

Ce contexte est obtenu côté serveur uniquement, jamais reçu du client. Il est :

1. exigé par tout service métier (paramètre explicite, pas de variable globale) ;
2. propagé à PostgreSQL (`SET LOCAL app.current_user_id / app.current_org_id`)
   pour que les politiques RLS s'appliquent ;
3. utilisé pour vérifier les quotas du plan **avant** toute écriture ;
4. consigné dans `audit_logs` pour toute action sensible.

## 2.6 Internationalisation

Le français est la seule langue livrée en V1, mais toute chaîne visible passe dès
maintenant par un dictionnaire (`src/i18n/fr.ts`). Les libellés réglementaires
(mentions H, EUH, P) ne sont **pas** traduits par l'application : ils proviennent
des libellés officiels par langue, stockés comme données du moteur, et une langue
non couverte produit `REGULATORY_REVIEW_REQUIRED` plutôt qu'une traduction
approximative.

> Le design system reste dans l'application tant qu'elle est son unique
> consommateur. Il sera extrait en `packages/ui` le jour où un second
> consommateur apparaîtra (back-office séparé, par exemple).

## 2.7 Environnements

| Environnement | Base | Paiement | IA | Usage |
|---------------|------|----------|----|-------|
| développement | locale (Docker) ou projet Supabase dédié | Stripe test | désactivée par défaut | développement |
| staging | projet dédié, données DEMO | Stripe test | quota réduit | recette, E2E |
| production | projet dédié, sauvegardes | Stripe live | activée | clients |

Aucune donnée de production n'est copiée vers un autre environnement.

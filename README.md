# Normelya

**La conformité simplifiée pour les créateurs.**

Normelya est une application SaaS destinée aux artisans, créateurs et petites
entreprises qui fabriquent des bougies et des produits parfumés. Elle centralise
les matières premières, les fiches de données de sécurité, les recettes et les
documents, et produit une analyse réglementaire **traçable et reproductible**.

> L'IA vous aide. Elle ne décide pas de votre classification.

## Principe fondateur

L'intelligence artificielle lit les documents et explique les résultats. Elle ne
décide jamais d'une classification, d'un seuil, d'un pictogramme ou d'une
mention. Ces décisions proviennent d'un **moteur déterministe, versionné et
testé** : même entrée, même résultat, aujourd'hui et dans dix ans.

Quand une règle n'est pas couverte par une source officielle vérifiée, Normelya
le dit — `REGULATORY_REVIEW_REQUIRED` — au lieu d'inventer un résultat.

Les règles permanentes du projet sont dans [`CLAUDE.md`](./CLAUDE.md).

## Documentation

Le dossier d'architecture complet est dans [`docs/`](./docs/README.md) :
produit, architecture, schéma PostgreSQL, moteur réglementaire, extraction des
FDS, étiquettes, stratégie France/Suisse, points de validation réglementaire,
risques, coûts, feuille de route.

## Organisation du dépôt

```
normelya/
├── CLAUDE.md                  règles permanentes du projet
├── docs/                      dossier d'architecture et ADR
├── db/
│   ├── migrations/            schéma PostgreSQL, versionné
│   ├── roles.sql              rôles applicatif / service / migrations
│   └── tests/                 tests d'isolation (RLS) et de traçabilité
├── packages/
│   ├── core/                  domaine partagé : types, schémas, calculs sûrs
│   ├── regulatory-engine/     moteur réglementaire (phase 5, non commencé)
│   └── regulatory-sources/    registre des sources officielles (phase 5)
├── apps/web/                  application Next.js et API
│   └── src/server/            ports, adaptateurs, sécurité, cas d'usage
└── scripts/                   migrations, contrôle des secrets
```

## Démarrage

```bash
npm install
cp .env.example .env.local          # puis renseigner les valeurs
DATABASE_URL=... npm run db:migrate
npm run dev
```

## Commandes

| Commande | Rôle |
|----------|------|
| `npm run dev` | Application en développement |
| `npm run build` | Compilation de production |
| `npm run typecheck` | Vérification des types |
| `npm run lint` | Analyse statique |
| `npm test` | Suite de tests |
| `npm run test:coverage` | Couverture |
| `npm run db:migrate` | Application des migrations |
| `npm run verifier:secrets` | Contrôle qu'aucun secret ne fuit côté client |
| `npm run verifier:vocabulaire` | Contrôle qu'aucun terme interdit n'atteint l'utilisateur |
| `npm run check` | Tout ce qui précède, comme en intégration continue |

### Tests d'intégration base de données

Les tests d'isolation (RLS) et de traçabilité s'exécutent sur un vrai
PostgreSQL. Sans la variable `TEST_DATABASE_URL`, ils sont ignorés :

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm test
```

## Confidentialité des formulations

Aucun appel à un modèle de langage ne reçoit une recette, une formulation ou un
pourcentage client. Un modèle ne voit que des documents **fournisseurs** — des
fiches qui circulent déjà entre le fournisseur et tous ses clients.

Cette séparation est appliquée par le code, pas par une convention :

- un **type marqué** (`SupplierDocumentText`) que seule `fromSupplierDocument()`
  peut construire ; une chaîne ordinaire ne compile pas ;
- des **contrôles d'exécution** avant chaque sortie réseau : forme du document,
  absence de marqueur de formulation, antériorité d'une lecture déterministe ;
- une **règle de lint** interdisant d'importer un client de modèle hors de
  `apps/web/src/server/ai/`.

L'analyse déterministe du PDF est la méthode principale. Le modèle n'est qu'un
recours, et la méthode employée est journalisée pour chaque document.

## Sécurité

- Isolation par organisation garantie à deux niveaux : filtrage applicatif **et**
  Row Level Security en base, avec un rôle de connexion sans `BYPASSRLS`.
- Données à valeur probante en append-only : analyses, résultats, documents
  générés et journal d'audit ne peuvent être ni modifiés ni supprimés.
- Documents dans un stockage privé, accessibles uniquement par URL signée de
  courte durée.
- Toute entrée validée côté serveur, limitation de débit sur les points sensibles.
- Aucun secret côté client, vérifié automatiquement en intégration continue.
- Validation humaine enregistrée en append-only avant toute génération de
  document : utilisateur, horodatage, empreinte des données validées, version du
  moteur.

## Avertissement

Normelya est un outil d'assistance. Il ne remplace ni les autorités compétentes,
ni un toxicologue, ni un chimiste, ni un expert réglementaire lorsque celui-ci
est nécessaire, ni les démarches officielles.

Cet avertissement ne justifie jamais un calcul approximatif : en cas de doute, le
moteur refuse de répondre plutôt que de deviner.

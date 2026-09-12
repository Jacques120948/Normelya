# 12 — Feuille de route MVP

## 12.1 Définition du MVP commercialisable

Un artisan français peut : créer son compte, décrire son atelier, importer les FDS
de sa cire et de son parfum, les vérifier, créer une recette, lancer une analyse,
obtenir un résultat traçable ou un refus explicite, générer une étiquette,
retrouver l'historique, et payer un abonnement. Le tout de façon sûre et isolée.

**Le MVP n'est pas commercialisable tant que les points `BLOQUANT` de
`08-validation-humaine.md` ne sont pas levés.** Le développement peut avancer en
parallèle ; la mise en vente, non.

## 12.2 Phases

| Phase | Contenu | État |
|-------|---------|------|
| 0 | Architecture, dossier de conception, décisions | ✅ fait |
| 1 | Authentification, organisations, base de données, sécurité initiale | 🚧 en cours |
| 2 | Tableau de bord, matières premières | à venir |
| 3 | Import FDS, extraction, validation humaine | à venir |
| 4 | Produits, versions, recettes | à venir |
| 5 | Moteur réglementaire | à venir |
| 6 | Résultats, étiquettes | à venir |
| 7 | PDF, documents, historique | à venir |
| 8 | Stripe, plans, quotas | à venir |
| 9 | Landing page, SEO, pages légales | à venir |
| 10 | Sécurité, tests, audit | à venir |
| 11 | Production, supervision, sauvegardes | à venir |

Chaque phase se termine par : code + tests verts + documentation à jour + commit.

## 12.3 Détail des phases

### Phase 1 — Fondations (en cours)

- espace de travail npm, TypeScript strict, lint, CI
- migrations SQL : identité, organisations, membres, abonnements, audit, RLS
- ports `AuthProvider`, `Database`, `FileStorage`, `MailSender` + adaptateurs
- inscription, connexion, vérification d'e-mail, mot de passe oublié,
  réinitialisation, déconnexion, suppression de compte
- contexte de requête, rôles, limitation de débit, journal d'audit
- onboarding et coquille de l'application (barre latérale, thème, composants)
- tests : schémas, isolation, contrôle d'accès, limitation de débit

### Phase 2 — Atelier
Tableau de bord réel, matières premières, fournisseurs, catégories, documents
rattachés, recherche, états.

### Phase 3 — FDS
Dépôt, contrôles d'entrée, extraction texte, segmentation, extraction structurée,
contrôles de cohérence, écran de vérification avec extrait source, validation,
versionnage, alertes de nouvelle version.

### Phase 4 — Produits
Création guidée, versions, recettes, contrôle du total, verrouillage à l'analyse.

### Phase 5 — Moteur
Sources, règles, calculateurs, seuils, UFI, traçabilité, tests exhaustifs,
publication de la première version de moteur. **Dépend des validations humaines.**

### Phase 6 — Résultats et étiquettes
Écran d'analyse, statuts, journal d'explication, générateur d'étiquettes,
prévisualisation, gestion du débordement.

### Phase 7 — Documents
Export PDF, dossier produit, historique, rattachement des sources.

### Phase 8 — Abonnements
Stripe Checkout, portail client, webhooks idempotents, quotas serveur, plans.

### Phase 9 — Acquisition
Landing page, pages « comment ça marche », pages SEO utiles, mentions légales,
CGU, CGV, politique de confidentialité.

### Phase 10 — Durcissement
Tests E2E, tests RLS, tests d'upload, tests Stripe, tests PDF, revue de sécurité,
en-têtes, limitation de débit affinée.

### Phase 11 — Production
Environnements, CI/CD, migrations, sauvegardes, supervision, alertes, retour
arrière, procédure d'incident.

## 12.4 Hors périmètre V1 (assumé)

Stocks avancés, CRM, marketplace, comptabilité, multi-pays au-delà de FR/CH,
diffuseurs et sprays, génération de FDS produit fini, application mobile native,
API publique.

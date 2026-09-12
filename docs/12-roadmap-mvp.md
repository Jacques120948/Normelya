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
| 1 | Authentification, organisations, base de données, sécurité initiale | ✅ fait |
| 2 | Tableau de bord, matières premières | ✅ fait |
| 3 | Import FDS, extraction, validation humaine | ✅ fait |
| 4 | Produits, versions, recettes | à venir |
| 5 | Moteur réglementaire | ⏸ point d'arrêt : validation humaine requise |
| 6 | Résultats, étiquettes | à venir |
| 7 | PDF, documents, historique | à venir |
| 8 | Stripe, plans, quotas | à venir |
| 9 | Landing page, SEO, pages légales | 🚧 structure des pages légales préparée |
| 10 | Sécurité, tests, audit | à venir |
| 11 | Production, supervision, sauvegardes | à venir |

Chaque phase se termine par : code + tests verts + documentation à jour + commit.

## 12.3 Détail des phases

### Phase 1 — Fondations (terminée)

- espace de travail npm, TypeScript strict, lint, CI
- migrations SQL : identité, organisations, membres, abonnements, audit, RLS
- ports `AuthProvider`, `Database`, `FileStorage`, `MailSender` + adaptateurs
- inscription, connexion, vérification d'e-mail, mot de passe oublié,
  réinitialisation, déconnexion, suppression de compte
- contexte de requête, rôles, limitation de débit, journal d'audit
- onboarding et coquille de l'application (barre latérale, thème, composants)
- tests : schémas, isolation, contrôle d'accès, limitation de débit

### Phase 2 — Atelier (terminée)

- tableau de bord alimenté par des chiffres réels, sans valeur estimée
- matières premières : création, modification, archivage, recherche, filtres
- fournisseurs créés à la volée, sans doublon
- état du dossier documentaire par matière (manquant, à vérifier, validé)
- centre de conformité, paramètres, suppression de compte, page abonnement
- sections non développées annoncées honnêtement plutôt que masquées

Une matière première n'est jamais supprimée : elle peut être citée par une
recette ou une analyse déjà produite. L'archivage la retire des listes sans
rompre la traçabilité.

### Phase 3 — FDS (terminée)

- lecteur déterministe : identifiants et leurs clés de contrôle, segmentation en
  seize rubriques, tableau de composition, champs d'en-tête, point éclair
- aucun appel à un modèle : sur le corpus mesuré, l'analyse du texte suffit
- import avec contrôle des octets d'en-tête, déduplication par empreinte,
  quota de stockage, document original conservé intact
- écran de vérification montrant, champ par champ, l'extrait du document dont
  vient la valeur proposée
- validation humaine scellée par une attestation append-only
- versionnage : une nouvelle version archive la précédente, jamais ne l'écrase,
  et les produits concernés sont signalés sans recalcul automatique

Aucune table de mentions H, EUH ou P n'a été écrite. Les codes relevés sont des
chaînes extraites du document fournisseur, jamais interprétées.

Dépôt, contrôles d'entrée, extraction texte, segmentation, extraction structurée,
contrôles de cohérence, écran de vérification avec extrait source, validation,
versionnage, alertes de nouvelle version.

### Phase 4 — Produits — livrée

Création guidée, versions, recettes, contrôle du total, verrouillage à l'analyse.

Ce qui a été livré :

- création en trois informations : type, nom, marchés visés ; le poids et le
  contenant restent facultatifs parce qu'ils ne conditionnent pas la recette,
  ils seront exigés au moment de l'étiquette
- recette à plusieurs parfums, plus cire, colorants et additifs : le calcul
  portera sur le mélange final complet, jamais parfum par parfum
- pourcentage saisi dans un champ numérique libre, jamais choisi dans une liste ;
  la valeur est restituée telle quelle, sans arrondi silencieux
- total imposé à exactement 100 %, sans tolérance : l'écart est calculé à la
  saisie avec la même arithmétique que le serveur, et affiché avant toute écriture
- version courante verrouillée dès qu'une analyse s'y rattache ; une modification
  crée alors une nouvelle version et l'ancienne reste rejouable à l'identique
- quota de l'offre gratuite contrôlé côté serveur sur deux plafonds, dont un
  compteur cumulatif que l'archivage ne libère pas
- version exacte de FDS validée rattachée à chaque ingrédient au moment de la
  saisie, jamais recalculée ensuite

Aucune règle réglementaire n'a été écrite : la recette est une donnée d'entrée,
pas un résultat.

### Phase 5 — Moteur — point d'arrêt

Aucune écriture dans `packages/regulatory-engine` sans validation humaine
préalable. Le paquet reste volontairement vide.

Premier travail à mener une fois le point d'arrêt levé : le **jeu de tests de
référence** décrit dans [`15-jeu-de-tests-reference.md`](./15-jeu-de-tests-reference.md).
Il précède toute implémentation de règle. Si le moteur ne reproduit pas à 100 %
la classification du fournisseur sur le parfum pur, la sommation est fausse et le
développement s'arrête.

Module `SwitzerlandCompliance` séparé dès cette phase, sans aucune constante
partagée avec le module européen.

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
Landing page, pages « comment ça marche », pages SEO utiles.

Les pages légales existent déjà sous forme de **plan** : sections attendues et
points à couvrir, marqués `DEMO_JURIDIQUE` à l'écran comme dans le code. Le texte
définitif sera rédigé par un juriste avant toute mise en vente. Points déjà
prévus dans la structure : service réservé aux professionnels, responsabilité de
mise sur le marché incombant à l'utilisateur, plafonnement de responsabilité,
absence de garantie quant au caractère suffisant des résultats, engagement de
non-utilisation des formulations clients.

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

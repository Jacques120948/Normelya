# 09 — Risques

## 9.1 Risques juridiques

| # | Risque | Gravité | Mesures |
|---|--------|---------|---------|
| J1 | Un utilisateur met sur le marché un produit mal étiqueté à cause d'un calcul Normelya | **critique** | Moteur déterministe testé ; refus explicite hors périmètre ; jamais le mot « conforme » ; traçabilité complète ; assurance responsabilité civile professionnelle |
| J2 | Le disclaimer sert d'excuse à un calcul approximatif | critique | Interdit par construction : un doute produit `REGULATORY_REVIEW_REQUIRED`, pas une valeur assortie d'un avertissement |
| J3 | Normelya est perçu comme fournissant du conseil réglementaire | élevé | Vocabulaire produit : « analyse », « préparation », jamais « validation » ni « certification ». CGU explicites |
| J4 | Évolution réglementaire non répercutée | élevé | Veille formalisée, `verifiedOn` par source, alerte de build au-delà de 12 mois, notification client à chaque version de moteur |
| J5 | Données personnelles et RGPD | élevé | Registre des traitements, base légale contractuelle, export et suppression, sous-traitants listés, hébergement UE/Suisse, DPA signés |
| J6 | Confidentialité des recettes (secret d'affaires) | élevé | Isolation stricte, chiffrement au repos, aucune exploitation commerciale des recettes, engagement contractuel écrit |
| J7 | Transmission de données à un fournisseur d'IA | élevé | Envoi limité au texte de FDS fournisseur, jamais la recette complète ; fournisseur avec engagement de non-entraînement ; option désactivable par l'organisation |
| J8 | Réutilisation de contenu réglementaire protégé (normes payantes) | moyen | Aucune reproduction du texte de normes privées ; citation de la référence uniquement |
| J9 | Contentieux sur une résiliation ou un remboursement | faible | CGV claires, gestion via Stripe, données exportables après résiliation |

**Position de fond** : le disclaimer protège Normelya contre l'usage que
l'utilisateur fait du résultat, pas contre un résultat faux. La qualité du moteur
est la seule vraie protection juridique.

## 9.2 Risques techniques

| # | Risque | Gravité | Mesures |
|---|--------|---------|---------|
| T1 | Extraction FDS de mauvaise qualité ⇒ perte de confiance | **élevé** | Validation humaine obligatoire ; extrait source affiché ; score de confiance ; champ vide plutôt que valeur douteuse |
| T2 | Non-déterminisme du moteur (ordre d'itération, flottants, locale, date système) | élevé | Fonctions pures ; tris stables ; arithmétique décimale contrôlée ; `evaluatedAt` en entrée ; test de déterminisme en CI |
| T3 | Une évolution du moteur change silencieusement des résultats passés | élevé | Résultats immuables ; rejeu comparatif avant publication ; notification, jamais recalcul automatique |
| T4 | Diversité réelle des FDS bien supérieure aux échantillons de développement | élevé | Corpus de test constitué dès la phase 3 ; mesure du taux de champs validés sans correction ; retour utilisateur en un clic |
| T5 | Dépendance à Supabase | moyen | Ports et adaptateurs ; migrations SQL standard ; test d'intégration sur PostgreSQL nu |
| T6 | Coût IA qui dérape | moyen | Appel IA en dernier recours ; compteur par organisation ; plafond mensuel ; cache par empreinte de document |
| T7 | Génération PDF lente ou instable | moyen | pdf-lib côté serveur, pas de navigateur sans interface ; mise en page testée sans rendu |
| T8 | Migrations de base risquées en production | moyen | Migrations additives, jamais destructives en une étape ; sauvegarde avant migration ; test sur copie de staging |
| T9 | Perte de documents utilisateurs | élevé | Sauvegardes quotidiennes du stockage et de la base, restauration testée trimestriellement |
| T10 | Dette de tests sur le moteur | élevé | Seuil de couverture bloquant en CI sur `regulatory-engine` |

## 9.3 Risques sécurité

| # | Risque | Gravité | Mesures |
|---|--------|---------|---------|
| S1 | Fuite de données entre organisations | **critique** | RLS `FORCE` + scoping applicatif + tests d'isolation automatisés à chaque build |
| S2 | Accès direct à un document d'une autre organisation | critique | Bucket privé, aucune URL publique, URL signées de 60 s liées au contexte, vérification d'appartenance avant signature |
| S3 | PDF malveillant déposé | élevé | Vérification des octets d'en-tête, taille limitée, pas d'exécution, traitement isolé, stockage hors racine web, jamais servi en `text/html` |
| S4 | Élévation de privilège vers le back-office | critique | `is_platform_admin` en base uniquement, jamais dans un jeton client ; back-office sur chemin séparé ; double vérification ; accès aux documents clients interdit par défaut et journalisé |
| S5 | Abus d'API et déni de service économique (extraction IA) | élevé | Limitation de débit par IP et par organisation, quotas par plan, file d'attente, plafond de dépense |
| S6 | Falsification de webhook Stripe | élevé | Vérification de signature, idempotence par `external_id`, aucune confiance dans le corps de la requête |
| S7 | XSS via un champ importé d'une FDS | élevé | Échappement systématique, pas de `dangerouslySetInnerHTML`, CSP stricte, en-têtes de sécurité |
| S8 | CSRF sur les mutations | moyen | Cookies `SameSite=Lax`, `Secure`, `HttpOnly`, jeton anti-rejeu sur les actions sensibles |
| S9 | Vol de session | moyen | Durées courtes, rotation, révocation, journal des sessions, déconnexion de tous les appareils |
| S10 | Secrets exposés côté client | élevé | Aucune clé de service dans le code client ; contrôle automatisé en CI sur le préfixe public |
| S11 | Dépendances vulnérables | moyen | Audit automatique, mises à jour régulières, verrouillage des versions |
| S12 | Suppression de compte incomplète | moyen | Procédure d'effacement testée : base, stockage, sauvegardes (délai documenté), sous-traitants |

## 9.4 Risques produit et business

| # | Risque | Mesures |
|---|--------|---------|
| B1 | Le gratuit ne convertit pas | 3 produits réels et complets : l'utilisateur atteint la valeur, puis la limite |
| B2 | Prix trop bas pour une charge réglementaire élevée | Le plan Atelier porte la marge ; la veille est un coût fixe, pas variable |
| B3 | Utilisateur bloqué par un `REGULATORY_REVIEW_REQUIRED` | Message explicite, ce qui manque, comment l'obtenir, canal de contact |
| B4 | Concurrent installé | Différenciation par la traçabilité et l'honnêteté du moteur, pas par le nombre de fonctions (voir `13-differenciation.md`) |
| B5 | Support réglementaire chronophage | Base de connaissances, assistant explicatif, réponses types, tarification du conseil séparée si besoin |

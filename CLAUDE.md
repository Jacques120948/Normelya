# NORMELYA — règles permanentes

## Langue
Français pour toute communication, doc et commentaire.
Le code reste en anglais : variables, fonctions, tables, colonnes.

## Moteur réglementaire — NON NÉGOCIABLE
- Aucune constante réglementaire (seuil, mention H, EUH, P,
  pictogramme, mot signal, classification, facteur M, règle de
  sommation) ne peut être écrite sans les champs obligatoires :
  `source`, `reference` (annexe + article/point), `verifiedAt`.
- Si la source exacte n'est pas connue : renvoyer
  REGULATORY_REVIEW_REQUIRED. Ne JAMAIS estimer une valeur
  plausible, ne jamais compléter "au mieux".
- Toute règle = au moins un test unitaire avec cas attendu documenté.
- France (UE/CLP) et Suisse (OChim/RS 813.11) : modules séparés,
  aucune constante partagée, aucun import croisé.
- Le moteur est une librairie TypeScript pure : aucune dépendance
  à React, Next.js, Supabase ou à la base de données.
- Politique plages de concentration FDS ("5–10 %") : toujours
  retenir la borne haute, l'afficher à l'utilisateur, la journaliser.
- Le choix des conseils P est une liste fixe par profil de danger,
  documentée et révisable — jamais un algorithme improvisé.

## Périmètre fonctionnel du moteur
- L'utilisateur saisit un pourcentage LIBRE (champ numérique, 0,1 à
  30 %). Jamais une liste de valeurs prédéfinies. Le moteur calcule.
- Une recette peut contenir PLUSIEURS parfums + cire + colorants +
  additifs. Le calcul porte sur le mélange final complet, pas parfum
  par parfum. Prévois-le dans le schéma dès maintenant.
- Sorties du moteur, trois états distincts :
  1. CALCUL_COMPLET — toutes les données présentes
  2. CALCUL_AVEC_HYPOTHESE — plage de concentration ramenée à la
     borne haute, hypothèse affichée et journalisée
  3. REGULATORY_REVIEW_REQUIRED — donnée bloquante manquante
     (ex : facteur M absent sur une substance Aquatic Acute 1)
- Le moteur signale toute valeur calculée située à moins de 10 % sous
  un seuil de bascule (proximité de seuil = avertissement visible).

## Confidentialité — argument commercial différenciant
- AUCUN appel IA ne doit recevoir une recette, une formulation ou un
  pourcentage client. Jamais.
- L'IA est autorisée UNIQUEMENT pour l'extraction de FDS fournisseur
  (document du fournisseur, pas du client).
- Privilégie le parsing PDF déterministe (pdf-parse / structure de
  tableau rubrique 3). L'IA n'est qu'un fallback quand le parsing
  échoue. Journalise quelle méthode a été utilisée.
- Implémente cette séparation comme une frontière de code explicite,
  pas comme une convention.

## Documents générés
Normelya génère DEUX documents par produit :
1. l'étiquette CLP
2. la FDS du produit dilué (format REACH annexe II, règlement
   UE 2020/878)
Les deux sont horodatés, versionnés, et référencent la version exacte
de la FDS fournisseur utilisée.

## Suisse
Module SwitzerlandCompliance séparé dès la phase 5. Aucune constante
partagée avec le module UE/France. C'est un différenciateur : le
concurrent exclut explicitement les marchés hors France.

## Tarifs
- GRATUIT : 3 produits documentés, quota non renouvelable
- ESSENTIEL : 9 €/mois — 15 produits actifs
- PRO : 15 €/mois — produits illimités, FDS + CLP + UFI + archivage
- ATELIER : 25 €/mois — tout PRO + lots, traçabilité, coûts
- Annuel : 2 mois offerts
- Quotas contrôlés côté serveur uniquement.

## Validation humaine — brique juridique
Avant toute génération de document, l'utilisateur coche :
« Je confirme avoir vérifié ces informations. »
Stocke : utilisateur, horodatage, hash des données validées, version
du moteur. Cette trace est non modifiable (table append-only).
C'est notre principale protection en cas de litige.

## Vocabulaire interdit dans toute l'application
N'écris JAMAIS, ni en UI, ni en PDF, ni en landing page :
« conforme », « conformité garantie », « produit conforme ».
Formulations autorisées : « analyse terminée », « calcul effectué
selon le règlement (CE) n° 1272/2008 », « à vérifier ».

## Jeu de tests de référence — phase 5
Cas de test obligatoire à implémenter avant toute autre règle :
parfum contenant 5 substances Skin Sens. 1B totalisant 3,0 % et un
profil aquatique déclenchant Aquatic Chronic 3.
Vérifier que le moteur reproduit, à 100 %, la classification du
fournisseur (H317 + H412), puis tester à 5, 7, 9, 9,9, 10 et 12 %.
La bascule EUH208 entre 9 et 10 % doit être détectée.
Si le moteur ne reproduit pas la classification fournisseur à 100 %,
l'implémentation de la sommation est fausse : arrête-toi.

## Pages légales — phase 9
Prépare la STRUCTURE des pages CGU/CGV, mentions légales et politique
de confidentialité, avec les sections et le plan, mais n'écris pas le
texte définitif : il sera rédigé par un juriste. Marque le contenu
provisoire DEMO_JURIDIQUE.
Points à prévoir dans la structure : service réservé aux
professionnels, responsabilité légale de mise sur le marché
incombant à l'utilisateur, plafonnement de responsabilité, absence
de garantie de conformité, engagement de non-utilisation des
formulations clients.

## Données de démonstration
Toute donnée fictive est préfixée DEMO et ne doit jamais alimenter
le moteur réglementaire.

## Points d'arrêt obligatoires
Arrête-toi et demande validation humaine avant :
- de commencer la phase 3 (extraction FDS)
- de commencer la phase 5 (moteur réglementaire)
- toute écriture dans /regulatory-engine

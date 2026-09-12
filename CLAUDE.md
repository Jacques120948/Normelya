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

## Données de démonstration
Toute donnée fictive est préfixée DEMO et ne doit jamais alimenter
le moteur réglementaire.

## Points d'arrêt obligatoires
Arrête-toi et demande validation humaine avant :
- de commencer la phase 3 (extraction FDS)
- de commencer la phase 5 (moteur réglementaire)
- toute écriture dans /regulatory-engine

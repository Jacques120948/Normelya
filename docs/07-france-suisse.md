# 07 — Stratégie France / Suisse

## 7.1 Principe : ne jamais mélanger les juridictions

Une recette peut donner **deux analyses différentes** selon le marché visé. Le
modèle de données le prévoit dès la V1 : `regulatory_calculations.market` fait
partie de la clé fonctionnelle du calcul, et l'interface affiche toujours le
marché à côté du résultat.

```
Bougie Fleur de coton 180 g
  ├── Analyse — marché France  — NORMELYA_EU_CLP_2026_01 — ✓ Analyse terminée
  └── Analyse — marché Suisse  — NORMELYA_CH_2026_01     — ⚠ Vérification nécessaire
```

## 7.2 Organisation du code

```
rules/
  eu/            socle commun : classification et étiquetage harmonisés UE
  france/        surcouche nationale, ne modifie jamais eu/ en place
  switzerland/   corpus propre, ne réutilise eu/ que via une déclaration explicite
```

Règle de construction vérifiée par test : un module `france/` ou
`switzerland/` ne peut pas exporter une règle sans déclarer explicitement son
rattachement (`basedOn: 'EU.CLP.X'` ou `standalone: true`). Aucune règle
nationale ne peut être « héritée » par inadvertance.

## 7.3 France

Le socle applicable est le corpus européen (classification, étiquetage,
emballage), auquel s'ajoutent des obligations nationales, notamment en matière de
langue de l'étiquetage et de déclaration aux organismes compétents.

Éléments à confirmer sur source primaire avant implémentation
(**`REGULATORY_REVIEW_REQUIRED`**) :

- statut exact d'une bougie parfumée finie au regard du CLP (mélange mis sur le
  marché, ou article) — voir `08-validation-humaine.md`, point n° 1 ;
- portée précise et calendrier des obligations de notification aux centres
  antipoison pour cette catégorie de produits ;
- conditions d'étiquetage réduit pour les emballages de petite taille ;
- articulation avec les obligations de déclaration propres aux produits
  biocides lorsqu'une allégation s'en approche (bougies dites « anti-odeurs »).

## 7.4 Suisse

La Suisse dispose de son **propre corpus**, aligné sur le système général
harmonisé mais distinct du droit de l'Union. Normelya ne présume aucune
équivalence automatique.

Points à établir sur source officielle avant toute implémentation
(**`REGULATORY_REVIEW_REQUIRED`**) :

- textes applicables à la mise sur le marché d'un produit chimique destiné au
  grand public, et leurs annexes pertinentes ;
- obligation, forme et délai de la déclaration au registre suisse des produits
  chimiques ;
- exigences relatives au numéro d'identification du produit et à son éventuelle
  équivalence avec l'UFI européen ;
- obligation d'un interlocuteur d'urgence en Suisse et mention à faire figurer ;
- exigences linguistiques de l'étiquetage selon la région de commercialisation ;
- exigence d'un domicile ou d'un représentant en Suisse pour le responsable de la
  mise sur le marché.

Tant que ces points ne sont pas validés et sourcés, le moteur suisse produit un
résultat de statut `needs_verification` accompagné d'un message explicite. C'est
volontairement frustrant, et c'est correct : une fausse certitude sur le marché
suisse serait un défaut bien plus grave qu'une absence de réponse.

## 7.5 Ce que la V1 livre réellement pour la Suisse

| Fonction | V1 |
|----------|----|
| Gestion des matières, FDS, recettes, documents, coûts | identique à la France |
| Calcul de la composition du produit fini | identique |
| Reprise des classifications des FDS | identique |
| Règles d'étiquetage suisses | après validation humaine documentée |
| Déclaration au registre suisse | assistance pédagogique uniquement, jamais automatisée |

## 7.6 Extension future

L'ajout de la Belgique, de l'Allemagne, de l'Italie et du reste de l'Union se
fait par ajout d'un dossier sous `rules/` et d'une valeur dans l'énumération des
marchés. Le modèle de données (`markets text[]`, `market` sur le calcul) et le
moteur (surcouche par juridiction) sont déjà dimensionnés pour cela. Ce qui n'est
pas extensible « gratuitement », c'est le travail de vérification réglementaire :
il faut compter une charge d'expertise par pays, pas une charge de développement.

De la même manière, l'extension aux diffuseurs, sprays d'ambiance et parfums
d'intérieur ajoute des `product_type` et des règles dédiées (produits liquides,
inflammabilité, propulseurs) : l'architecture les accueille, la réglementation
demande un travail distinct.

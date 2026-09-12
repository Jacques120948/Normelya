# 06 — Stratégie de génération des étiquettes

## 6.1 Principe

L'étiquette est un **rendu du résultat du moteur**, pas une source d'information
indépendante. Elle ne peut exister sans un `regulatory_result` rattaché, et elle
porte la version de moteur qui l'a produite.

Conséquence : on ne peut pas « éditer » une mention H sur l'étiquette. On corrige
la donnée en amont et on relance l'analyse.

## 6.2 Composition d'une étiquette

| Bloc | Source | Modifiable |
|------|--------|------------|
| Nom du produit | produit | oui |
| Identité et coordonnées du responsable de la mise sur le marché | organisation | oui |
| Quantité nominale | produit | oui |
| Pictogrammes de danger | moteur | non |
| Mot d'avertissement | moteur | non |
| Mentions H et EUH | moteur | non |
| Conseils P | moteur (sélection validée par l'utilisateur) | sélection uniquement |
| UFI | `ufi_records` | non |
| Mentions complémentaires libres | utilisateur | oui |

## 6.3 Formats

50 × 50 mm · 60 × 40 mm · 70 × 50 mm · personnalisé (largeur/hauteur en mm,
marges, fond perdu). Prévisualisation instantanée, rendue par le **même moteur de
mise en page** que l'export, pour qu'il n'y ait aucune surprise entre l'écran et
le PDF.

## 6.4 Moteur de rendu

```
packages/label-renderer/
  layout/     calcul de la mise en page (pur, testable, sans dépendance graphique)
  render/     pdf.ts (pdf-lib) · png.ts (rendu vectoriel → bitmap haute densité)
  assets/     pictogrammes GHS vectoriels, polices embarquées
```

La séparation `layout` / `render` permet de tester le comportement de débordement
sans générer un seul pixel : le calcul de mise en page renvoie une structure
décrivant les blocs, leurs positions et un indicateur `overflow`.

Choix techniques :

- **pdf-lib** plutôt qu'un navigateur sans interface : pas de Chromium à héberger,
  démarrage instantané, coût serveur négligeable, rendu reproductible.
- **Polices embarquées** dans le PDF : le fichier est identique chez l'imprimeur.
- **Pictogrammes vectoriels** intégrés au paquet, jamais chargés depuis Internet.
- **PNG haute définition** : 300 ou 600 dpi, à partir de la même mise en page.

## 6.5 Règle de débordement — la plus importante

Si le contenu réglementaire obligatoire ne tient pas dans le format demandé :

> **Cette étiquette est trop petite pour contenir toutes les informations
> nécessaires.**
>
> Choisissez un format plus grand, réduisez le texte libre, ou envisagez une
> étiquette dépliante.

L'application ne **jamais** :

- réduire la taille d'une police sous le seuil de lisibilité configuré ;
- tronquer une mention H, EUH ou P ;
- supprimer un pictogramme ;
- masquer l'UFI ;
- proposer une case « ignorer cet avertissement ».

Le blocage est une fonctionnalité, pas un défaut.

Les dimensions minimales d'étiquette et de pictogramme prévues par la
réglementation selon la contenance de l'emballage, ainsi que les possibilités
d'étiquetage réduit pour les petits emballages, sont marquées
**`REGULATORY_REVIEW_REQUIRED`** : elles seront implémentées comme paramètres du
moteur une fois vérifiées sur le texte officiel, et non codées en dur à partir
d'une connaissance approximative.

## 6.6 Traçabilité des exports

Chaque export crée une ligne `generated_documents` : type, date, produit et
version, résultat réglementaire, version de moteur, documents sources. Un PDF
d'étiquette téléchargé il y a six mois peut donc être retrouvé, réexpliqué, et
comparé à la version actuelle.

## 6.7 Hors périmètre V1

- Impression en planche (multi-poses) et repères de découpe : V1.1.
- Codes-barres EAN, QR code : V1.1.
- Pictogrammes de sécurité des bougies issus des normes produit (EN 15494 et
  apparentées) : à traiter séparément du CLP, après vérification —
  `REGULATORY_REVIEW_REQUIRED`.

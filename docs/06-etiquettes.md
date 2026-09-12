# 06 — Stratégie de génération des documents

Normelya produit **deux documents par produit** :

1. **l'étiquette CLP** ;
2. **la fiche de données de sécurité du produit dilué**, au format défini par
   l'annexe II du règlement REACH tel que modifié par le règlement (UE) 2020/878.

Les deux sont horodatés, versionnés, et citent la version exacte de la FDS
fournisseur utilisée ainsi que la version du moteur. Les deux exigent une
attestation de validation humaine préalable (voir § 6.8).

> La structure détaillée de la fiche de données de sécurité du produit dilué —
> l'ordre des seize rubriques, les sous-rubriques obligatoires et les mentions
> exigées — doit être établie sur le texte officiel avant implémentation :
> **`REGULATORY_REVIEW_REQUIRED`**. Le gabarit ne sera pas écrit de mémoire.

## 6.0 Étiquette CLP

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

## 6.8 Validation humaine préalable — brique juridique

Aucun document n'est généré sans qu'une attestation ait été enregistrée. Avant la
génération, l'utilisateur coche :

> **Je confirme avoir vérifié ces informations.**

Sont alors enregistrés dans `validation_attestations`, table **append-only** :

| Donnée | Rôle |
|--------|------|
| utilisateur | qui a validé |
| horodatage | quand |
| empreinte des données validées | **ce qui** a été validé, scellé |
| texte exact de la déclaration acceptée | ce qui a été affirmé, mot pour mot |
| version du moteur | dans quel état des règles |
| empreintes d'adresse réseau et d'agent | contexte, jamais en clair |

L'empreinte permet de démontrer, des années plus tard, que les données validées
sont exactement celles qui figurent dans le document. Une modification
ultérieure est détectable.

La table n'accepte que des insertions, garanties à deux niveaux : absence de
politique de modification et déclencheur bloquant. Une contrainte sur
`generated_documents` refuse toute étiquette, fiche de produit ou rapport
d'analyse non rattaché à une attestation.

C'est notre principale pièce de défense en cas de litige.

## 6.9 Hors périmètre V1

- Impression en planche (multi-poses) et repères de découpe : V1.1.
- Codes-barres EAN, QR code : V1.1.
- Pictogrammes de sécurité des bougies issus des normes produit (EN 15494 et
  apparentées) : à traiter séparément du CLP, après vérification —
  `REGULATORY_REVIEW_REQUIRED`.

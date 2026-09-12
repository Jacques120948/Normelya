# 17 — Sources réglementaires

## 17.1 Principe

Aucune règle, aucune constante, aucune structure documentaire n'entre dans le
code sans référencer une entrée du registre `packages/regulatory-sources`. Une
entrée décrit un texte officiel, **la version exactement consultée**, la date de
vérification et la personne qui l'a faite.

Les textes eux-mêmes sont conservés dans `sources-reglementaires/`. Les lire dans
le dépôt, plutôt que de mémoire ou depuis un résumé, est la seule méthode
acceptable.

## 17.2 Hiérarchie des sources

**Guides et brochures pour comprendre, textes consolidés pour les valeurs.**

| Statut | Ce qu'on en tire |
|--------|------------------|
| `normative` | Texte consolidé. **Seule** source dont on extrait une valeur réglementaire : seuil, mention, pictogramme, classification, structure documentaire |
| `explanatory` | Guide, brochure, fiche d'information. Sert **uniquement** à comprendre : repérer une question, éclairer une notion, orienter une recherche |

Un document explicatif ne fonde aucune valeur, **même si celle-ci y figure noir
sur blanc**. Ces documents sont fréquemment antérieurs à la dernière
consolidation du texte qu'ils commentent. En cas de divergence, le texte
consolidé prime, et la divergence doit être signalée.

Cette règle n'est pas qu'une convention : `assertNormative()` lève une erreur si
l'on tente de tirer une valeur d'un document explicatif.

## 17.3 Textes présents

| Identifiant | Texte | Statut | Version consultée |
|-------------|-------|--------|-------------------|
| `EU_REACH_1907_2006` | Règlement (CE) n° 1907/2006 (REACH) | consolidé | 22 juin 2026 |
| `EU_CLP_1272_2008` | Règlement (CE) n° 1272/2008 (CLP) | consolidé | 1er juillet 2026 |
| `CH_ORDONNANCE_2015_366` | Ordonnance suisse, référence eli/cc/2015/366 | consolidé | état au 24 avril 2026 |
| `ECHA_FICHE_BOUGIES` | Fiche d'information de l'Agence européenne des produits chimiques relative aux bougies | **compréhension seulement** | août 2024 |

La fiche d'information **date d'août 2024**. Elle est donc antérieure au
règlement CLP consolidé au 1er juillet 2026 et au règlement REACH consolidé au
22 juin 2026. Aucune valeur n'en est extraite.

**Divergences relevées à ce jour : aucune.** Aucune valeur n'ayant été tirée de
ce document, aucune comparaison n'a eu lieu. Toute divergence constatée à
l'avenir sera signalée au porteur du projet.

## 17.4 Ce qui en a été tiré à ce jour

### Structure de la fiche de données de sécurité — établie

Les seize rubriques et leurs sous-rubriques proviennent de l'annexe II,
partie B, du règlement REACH. Elles sont codées dans `packages/sds-document`.

Cette structure est **vérifiée par un test qui relit le règlement lui-même** :
il extrait le sommaire de l'annexe II du PDF officiel, le segmente, et compare
les seize intitulés à ceux déclarés dans le code. Une divergence fait échouer la
suite. La structure ne peut donc pas dériver en silence.

Ce fichier ne contient **que** la structure. Un test supplémentaire vérifie
qu'aucune règle de contenu ne s'y est glissée : pas de seuil, pas de pourcentage,
pas de code de mention.

### Règles de classification — non commencées

Aucune n'est tirée du règlement CLP à ce jour : la phase 5 n'est pas ouverte.
Voir [`15-jeu-de-tests-reference.md`](./15-jeu-de-tests-reference.md) pour le
premier travail à mener quand elle le sera.

### Corpus suisse — périmètre à établir

Le texte est présent, mais son périmètre exact au regard des produits visés par
Normelya reste à déterminer. C'est un point de validation humaine, listé dans
[`08-validation-humaine.md`](./08-validation-humaine.md).

## 17.5 Règles de citation

1. Toute règle cite l'identifiant de source, l'annexe ou l'article, et la date
   de vérification.
2. Une source vérifiée depuis plus de douze mois déclenche un avertissement :
   un texte consolidé évolue, et une référence périmée est un défaut.
3. Un intitulé officiel n'est jamais traduit ni reformulé par l'application. Il
   est relevé tel qu'il figure dans le texte.
4. Une structure relevée n'autorise aucune règle de contenu. Relever l'existence
   de la rubrique 2 ne dit rien de ce qu'il faut y écrire.
5. Une valeur ne se tire jamais d'un guide, d'une brochure ou d'une fiche
   d'information, quelle que soit la clarté avec laquelle elle y figure.

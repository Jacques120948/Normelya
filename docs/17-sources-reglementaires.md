# 17 — Sources réglementaires

## 17.1 Principe

Aucune règle, aucune constante, aucune structure documentaire n'entre dans le
code sans référencer une entrée du registre `packages/regulatory-sources`. Une
entrée décrit un texte officiel, **la version exactement consultée**, la date de
vérification et la personne qui l'a faite.

Les textes eux-mêmes sont conservés dans `sources-reglementaires/`. Les lire dans
le dépôt, plutôt que de mémoire ou depuis un résumé, est la seule méthode
acceptable.

## 17.2 Textes présents

| Identifiant | Texte | Version consultée |
|-------------|-------|-------------------|
| `EU_REACH_1907_2006` | Règlement (CE) n° 1907/2006 (REACH) | consolidée du 22 juin 2026 |
| `EU_CLP_1272_2008` | Règlement (CE) n° 1272/2008 (CLP) | consolidée du 1er juillet 2026 |
| `CH_ORDONNANCE_2015_366` | Ordonnance suisse, référence eli/cc/2015/366 | état au 24 avril 2026 |
| `ECHA_FICHE_BOUGIES` | Fiche d'information de l'Agence européenne des produits chimiques relative aux bougies | exemplaire du 12 septembre 2026 |

**Distinction importante** : la fiche d'information n'est pas un texte normatif.
Elle peut éclairer une question, jamais fonder une règle du moteur. Le registre
le consigne explicitement.

## 17.3 Ce qui en a été tiré à ce jour

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

## 17.4 Règles de citation

1. Toute règle cite l'identifiant de source, l'annexe ou l'article, et la date
   de vérification.
2. Une source vérifiée depuis plus de douze mois déclenche un avertissement :
   un texte consolidé évolue, et une référence périmée est un défaut.
3. Un intitulé officiel n'est jamais traduit ni reformulé par l'application. Il
   est relevé tel qu'il figure dans le texte.
4. Une structure relevée n'autorise aucune règle de contenu. Relever l'existence
   de la rubrique 2 ne dit rien de ce qu'il faut y écrire.

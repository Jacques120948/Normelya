# 15 — Jeu de tests de référence du moteur

Ce document décrit le **premier test à écrire** lorsque la phase 5 sera
autorisée. Il précède toute implémentation de règle : c'est lui qui dira si la
sommation est juste.

> ⛔ **Point d'arrêt.** Aucune écriture dans `packages/regulatory-engine` sans
> validation humaine préalable. Ce document prépare le travail, il ne l'exécute
> pas.

## 15.1 Principe

Le meilleur juge de la sommation n'est pas une règle recopiée d'un texte, c'est
une **FDS fournisseur réelle**. Le fournisseur a classé son parfum pur. Si notre
moteur, appliqué au parfum pur (100 %), ne retrouve pas exactement sa
classification, notre sommation est fausse.

C'est un test de non-régression permanent, et le seul qui valide la mécanique de
bout en bout à partir de données authentiques.

## 15.2 Cas de référence

**Données d'entrée** — parfum fournisseur contenant :

| Élément | Valeur |
|---------|--------|
| Substances sensibilisantes cutanées catégorie 1B | 5 substances |
| Somme de leurs concentrations | 3,0 % |
| Profil aquatique déclaré | déclenchant une classification de danger chronique pour le milieu aquatique, catégorie 3 |
| Classification déclarée par le fournisseur pour le parfum pur | H317 et H412 |

**Les concentrations exactes des cinq substances, leurs numéros CAS et la
composition précise du profil aquatique doivent provenir d'une FDS réelle**,
enregistrée dans le corpus de test avec sa source. Aucune donnée de ce cas ne
doit être inventée : un cas fabriqué validerait une mécanique contre elle-même.

## 15.3 Étapes du test

### Étape 1 — reproduction de la classification fournisseur

Entrée : le parfum seul, à 100 %.
Attendu : le moteur produit exactement H317 et H412.

**Si le moteur ne reproduit pas cette classification à 100 %, l'implémentation
de la sommation est fausse. Le développement s'arrête, on corrige la sommation
avant toute autre règle.** Aucun contournement, aucun ajustement de seuil pour
faire passer le test.

### Étape 2 — dilution, taux croissants

Le parfum est incorporé dans une cire, aux taux suivants :

| Taux de parfum | Vérification attendue |
|----------------|-----------------------|
| 5 % | sortie du moteur cohérente et stable |
| 7 % | idem |
| 9 % | idem, et **avertissement de proximité de seuil** si applicable |
| 9,9 % | idem, avertissement de proximité de seuil attendu |
| 10 % | **bascule attendue** |
| 12 % | résultat au-delà de la bascule |

Le point à détecter : **la bascule de la mention EUH208 entre 9 % et 10 %**. Le
test échoue si le moteur ne la détecte pas, et il échoue également s'il la place
ailleurs que là où la règle sourcée le prévoit.

### Étape 3 — avertissement de proximité

Conformément à `CLAUDE.md`, toute valeur calculée située à moins de 10 % sous un
seuil de bascule doit produire un avertissement visible. Le test vérifie qu'à
9,9 % l'avertissement est présent, et qu'il disparaît une fois le seuil franchi
— au-delà, ce n'est plus une proximité, c'est un résultat.

La fonction `isNearThreshold` de `packages/core/src/status.ts` implémente déjà
cette règle et possède ses propres tests. Le moteur devra l'utiliser, pas la
réécrire.

### Étape 4 — états de calcul

Le même cas est rejoué avec :

| Variante | État attendu |
|----------|--------------|
| Concentrations exactes déclarées | `complete` |
| Concentrations déclarées en plages | `with_assumption`, borne haute retenue, hypothèse listée |
| Facteur M absent sur une substance qui l'exige | `review_required`, aucun résultat produit |

## 15.4 Ce que ce test ne prouve pas

Il valide la mécanique de sommation et de dilution. Il ne valide pas :

- l'exactitude des seuils, qui dépend des sources vérifiées ;
- la couverture des autres classes de danger ;
- le choix des conseils de prudence ;
- l'applicabilité du résultat au marché suisse, traité par un module séparé.

Ces points relèvent des validations humaines listées dans
[`08-validation-humaine.md`](./08-validation-humaine.md).

## 15.5 Emplacement prévu

```
packages/regulatory-engine/tests/
  reference/
    parfum-skin-sens-1b-aquatic-chronic-3.json   ← données issues d'une FDS réelle
    reproduction-fournisseur.test.ts             ← étape 1
    dilution-taux-croissants.test.ts             ← étapes 2 et 3
    etats-de-calcul.test.ts                      ← étape 4
```

Ces fichiers ne seront créés qu'après levée du point d'arrêt.

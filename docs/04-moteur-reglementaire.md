# 04 — Architecture du moteur réglementaire Normelya

## 4.1 Contrat du moteur

```ts
computeRegulatoryResult(input: EngineInput): EngineOutput
```

- **Pur** : aucune entrée/sortie, aucun accès réseau, aucune horloge, aucun
  aléatoire. La date d'évaluation fait partie de l'entrée.
- **Total** : ne lève jamais d'exception pour une donnée incomplète ; renvoie un
  résultat porteur de `review_flags`.
- **Déterministe** : `digest(input)` identique ⇒ sortie identique, bit à bit.
- **Traçable** : chaque élément de sortie porte la référence de la règle et de la
  source qui l'ont produit.

### Entrée

```ts
type EngineInput = {
  engineVersion: string          // ex. 'NORMELYA_EU_CLP_2026_01'
  market: 'FR' | 'CH'
  evaluatedAt: string            // ISO, fait partie de l'empreinte
  product: {
    type: 'candle' | 'wax_melt'
    netWeightGrams?: number
    containerCapacityMl?: number
  }
  /**
   * Recette complète. Elle peut contenir PLUSIEURS parfums, en plus de la cire,
   * des colorants et des additifs. Le calcul porte sur le mélange final, jamais
   * parfum par parfum : deux parfums apportant chacun une même substance
   * s'additionnent.
   */
  ingredients: Array<{
    ref: string                  // identifiant stable de l'ingrédient
    role: 'wax' | 'fragrance' | 'dye' | 'additive' | 'other'
    percent: number              // % masse dans le produit fini, valeur libre
    sds: {
      sourceRef: string          // id de la version de FDS validée
      validated: true            // le moteur REFUSE une FDS non validée
      substances: Array<{
        casNumber?: string
        ecNumber?: string
        declaredName: string
        concentration: { min?: number; max?: number; exact?: number } // % dans la matière
        classification: Array<{ hazardClass: string; category: string; hStatement: string }>
        specificConcentrationLimits?: Array<{ hStatement: string; lowerPercent: number; upperPercent?: number }>
        mFactorAcute?: number
        mFactorChronic?: number
      }>
      physical?: { flashPointCelsius?: number }
    }
  }>
}
```

### Sortie

```ts
type EngineOutput = {
  engineVersion: string
  /**
   * Ce que le moteur a pu faire :
   *   'complete'         toutes les données nécessaires étaient présentes
   *   'with_assumption'  une hypothèse explicite a été appliquée
   *   'review_required'  donnée bloquante manquante, aucun résultat produit
   */
  computationState: 'complete' | 'with_assumption' | 'review_required'
  assumptions: Assumption[]
  thresholdWarnings: ThresholdProximityWarning[]
  status: 'completed' | 'needs_verification' | 'action_required' | 'not_applicable'
  classifications: Classification[]
  signalWord: 'Danger' | 'Attention' | null
  pictograms: PictogramCode[]          // GHS01 … GHS09
  hazardStatements: StatementRef[]
  euhStatements: StatementRef[]
  precautionaryStatements: StatementRef[]
  ufi: { required: 'yes' | 'no' | 'verification_required'; reasons: Reason[] }
  reviewFlags: ReviewFlag[]            // REGULATORY_REVIEW_REQUIRED détaillés
  trace: TraceEntry[]                  // { output, ruleId, sourceId, inputs }
  inputDigest: string
}
```

## 4.2 Pipeline interne

```
EngineInput
   │
   ├─ 1. validate          complétude, cohérence, refus des FDS non validées
   │                       → toute lacune devient un ReviewFlag, jamais une
   │                         valeur par défaut inventée
   ├─ 2. normalize         conversion en composition « produit fini » :
   │                       %substance_produit = %matière × %substance_matière
   │                       les plages restent des plages (min/max conservés)
   ├─ 3. resolve           rapprochement avec le référentiel de substances
   │                       (CAS/CE), récupération des données de référence
   ├─ 4. classify          application des règles par classe de danger
   │                       (module par classe, jamais une fonction géante)
   ├─ 5. label             mot d'avertissement, pictogrammes, mentions H/EUH
   ├─ 6. precaution        sélection et limitation des conseils P
   ├─ 7. market rules      surcouche FR ou CH, jamais mélangée
   ├─ 8. ufi               déclenchement UFI
   └─ 9. finalize          statut global, tri stable, empreinte
EngineOutput
```

### Les trois états de sortie

| État | Signification | Résultat produit |
|------|---------------|------------------|
| `complete` | Toutes les données nécessaires étaient présentes | oui |
| `with_assumption` | Une ou plusieurs hypothèses explicites ont été appliquées | oui, accompagné du détail des hypothèses |
| `review_required` | Une donnée bloquante manque | **non** |

Exemple de donnée bloquante : un facteur M absent sur une substance classée pour
un danger aigu pour le milieu aquatique catégorie 1. Sans lui, le calcul n'est
pas possible ; Normelya le dit et n'en produit aucun.

Chaque état est enregistré avec le calcul, dans une colonne distincte du statut
d'affichage : le premier dit ce que le moteur a pu faire, le second ce que
l'utilisateur doit faire.

### Le point critique : les plages de concentration

Une FDS déclare presque toujours des plages (« 5–10 % »). Le moteur ne choisit
jamais une valeur « raisonnable » au milieu : il retient **la borne haute**,
affiche l'hypothèse à l'utilisateur et la journalise avec le résultat. L'état de
calcul passe alors à `with_assumption`.

```
Assumption: concentration_upper_bound
  subject     Linalool
  declared    5 – 10 %
  applied     10 %
  explication « Votre fournisseur déclare une plage. Normelya retient la valeur
                la plus élevée, celle qui est la plus défavorable. Demandez la
                valeur exacte pour affiner le résultat. »
```

Il n'existe aucune hypothèse implicite dans le moteur : toute hypothèse est
nommée, affichée et enregistrée.

### Avertissement de proximité de seuil

Toute valeur calculée située à **moins de 10 % sous un seuil de bascule** produit
un avertissement visible. L'artisan doit savoir qu'un demi-point de parfum en
plus changerait son étiquette.

```
ThresholdProximityWarning
  subject        somme des sensibilisants cutanés
  computedValue  0,95 %
  thresholdValue 1 %
  ruleId         …
```

Au-delà du seuil, ce n'est plus une proximité mais un résultat : l'avertissement
disparaît. La fonction `isNearThreshold` de `packages/core` implémente cette
règle et possède ses propres tests.

C'est une différence de fond avec un tableur : l'incertitude et la fragilité
d'un résultat sont des sorties du calcul, pas des angles morts.

## 4.3 Format d'une règle

Une règle est une donnée, pas seulement du code :

```ts
export const SKIN_SENS_1_GENERIC: Rule = {
  id: 'EU.CLP.SKIN_SENS_1.GENERIC_CUTOFF',
  scope: 'EU',
  title: 'Sensibilisation cutanée catégorie 1 — limite générique',
  status: 'implemented' | 'draft' | 'review_required',
  sourceIds: ['EU_CLP_1272_2008_ANNEX_I_3_4'],
  effectiveFrom: '2026-01-01',
  appliesTo: (ctx) => ...,
  evaluate: (ctx) => ...,     // pure, testée cas par cas
}
```

Toute règle dont `status !== 'implemented'` ne produit **aucune sortie** : elle
produit un `ReviewFlag`. Il n'existe aucun chemin de code permettant de
« deviner ».

## 4.4 Registre des sources

`packages/regulatory-sources` contient une entrée par texte cité :

```ts
{
  id: 'EU_CLP_1272_2008',
  jurisdiction: 'EU',
  title: 'Règlement (CE) n° 1272/2008 relatif à la classification, '
       + "à l'étiquetage et à l'emballage des substances et des mélanges",
  reference: 'CELEX:32008R1272',
  url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32008R1272',
  consolidatedAs: '<date de la version consolidée utilisée>',
  verifiedOn: '<date de vérification humaine>',
  verifiedBy: '<personne>',
}
```

Contraintes de construction (vérifiées par un test) :

1. toute règle référence au moins une source existante ;
2. toute source possède `verifiedOn` et `verifiedBy` renseignés ;
3. une source dont la vérification date de plus de 12 mois déclenche un
   avertissement de build et une tâche dans le back-office.

**Aucune règle ne peut être écrite à partir de la mémoire d'un développeur ou
d'un modèle de langage.** La source primaire doit être ouverte, lue, et citée.

## 4.5 Versionnage

`NORMELYA_<SCOPE>_<DOMAINE>_<ANNÉE>_<INCRÉMENT>` — par exemple
`NORMELYA_EU_CLP_2026_01`.

Une version est un objet figé contenant : la liste des règles actives, les tables
de seuils, les libellés officiels, et une empreinte `rules_digest`. Publier une
version consiste à :

1. figer le jeu de règles ;
2. exécuter la suite de tests, y compris les cas de non-régression historiques ;
3. rejouer les N derniers calculs réels de production et **produire un rapport de
   différences** ;
4. publier via le back-office, avec note de version ;
5. créer une notification `reanalysis_needed` pour les produits dont le résultat
   changerait.

Les analyses existantes ne sont jamais recalculées silencieusement.

## 4.6 Périmètre réel de la V1

Le moteur V1 ne prétend pas couvrir l'ensemble du CLP. Il couvre un sous-ensemble
explicite, adapté aux bougies et fondants, et **refuse visiblement** le reste.

| Élément | V1 | Commentaire |
|---------|----|-------------|
| Reprise des classifications de substances issues des FDS validées | oui | Le moteur n'invente aucune classification de substance |
| Calcul de la composition du produit fini à partir de la recette | oui | Arithmétique pure, testable |
| Méthode d'additivité / seuils par classe de danger | partiel | Uniquement les classes documentées et testées ; les autres ⇒ `ReviewFlag` |
| Sensibilisation cutanée, danger pour le milieu aquatique | prioritaires | Classes les plus fréquentes sur ce marché |
| Toxicité aiguë par calcul d'ETA | à confirmer | Exige des données ETA rarement présentes dans une FDS fournisseur |
| Mentions EUH liées aux sensibilisants et aux FDS sur demande | à confirmer | `REGULATORY_REVIEW_REQUIRED` avant implémentation |
| Sélection des conseils P | assistée | Proposition + choix explicite de l'utilisateur, jamais imposé seul |
| Étiquetage réduit des petits emballages | non en V1 | Signalé comme point à vérifier |
| Statut « article » vs « mélange » de la bougie finie | non tranché | Voir `08-validation-humaine.md`, point bloquant n° 1 |

Ce tableau est la traduction directe de l'exigence « ne jamais simuler ».

## 4.7 Module UFI

```
ufi/
  isUfiRequired(input): { required, reasons, reviewFlags }
  registerExistingUfi(code): validation de format et de cohérence
  explainNextSteps(market): texte pédagogique, non normatif
```

Deux séparations strictes :

1. La **détermination** du besoin d'UFI est une règle du moteur, sourcée, et
   renvoie `verification_required` par défaut tant qu'elle n'est pas validée.
2. La **déclaration** aux autorités n'est pas faite par Normelya. Message affiché
   systématiquement, non masquable :

   > La génération ou l'enregistrement d'un UFI dans Normelya ne remplace pas les
   > notifications ou déclarations obligatoires auprès des autorités compétentes.

## 4.8 Stratégie de test

| Niveau | Contenu |
|--------|---------|
| Unitaire | Chaque calculateur, chaque règle, cas nominal + bornes + absence de donnée |
| Propriété | Déterminisme (mêmes entrées ⇒ mêmes sorties), stabilité du tri, monotonie des seuils |
| Table | Jeux de cas figés en JSON : entrée → sortie attendue, revus humainement |
| Non-régression | Chaque bug corrigé ajoute un cas figé, définitivement conservé |
| Instantané inter-versions | Rejeu des cas de référence entre deux versions de moteur, différences explicitées |

Objectif de couverture du paquet `regulatory-engine` : **100 % des branches des
règles**, sans exception tolérée en intégration continue.

Procédure obligatoire en cas de bug moteur :

1. reproduire par un test ; 2. le faire échouer ; 3. corriger ; 4. confirmer ;
5. conserver le test en non-régression, avec la référence du bug.

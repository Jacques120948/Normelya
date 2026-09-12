# 08 — Points nécessitant impérativement une validation réglementaire humaine

Ce document est le plus important du dossier. Il liste ce qui **ne doit pas être
codé** tant qu'une personne compétente n'a pas vérifié le texte officiel, écrit
la règle, et signé la source.

Statut de chaque point : `BLOQUANT` (empêche la commercialisation de la
fonction concernée) ou `À VALIDER` (peut être livré en mode
« vérification nécessaire »).

---

## 1. Statut de la bougie parfumée finie au regard du CLP — `BLOQUANT`

**Question** : une bougie parfumée mise sur le marché est-elle, au sens du
règlement CLP, un mélange soumis à classification et étiquetage, ou un article ?
Même question pour un fondant parfumé.

**Pourquoi c'est bloquant** : toute la promesse produit repose sur cette réponse.
Si la réponse varie selon le type de produit ou l'usage, la réponse doit être
encodée comme une règle explicite, pas comme une hypothèse implicite.

**Livrable attendu** : note écrite, citant le texte et les positions des autorités
compétentes, définissant les cas où l'étiquetage CLP s'applique.

---

## 2. Obligations de notification aux centres antipoison et UFI — `BLOQUANT`

**Questions** : pour un artisan mettant sur le marché des bougies et fondants en
France, quelles notifications sont dues, à qui, dans quels délais, selon quels
critères de classification ? Un UFI est-il requis, et dans quels cas ?

**Pourquoi c'est bloquant** : afficher « UFI non nécessaire » à tort expose
directement l'utilisateur. Par défaut, Normelya répond
`verification_required` tant que ce point n'est pas tranché.

---

## 3. Corpus suisse applicable — `BLOQUANT` pour le marché suisse

Textes applicables, registre de déclaration, identifiant produit, interlocuteur
d'urgence, exigences linguistiques, obligation de représentation en Suisse.
Voir `07-france-suisse.md` § 7.4.

---

## 4. Méthodes de classification des mélanges — `BLOQUANT` par classe

Pour **chaque classe de danger** que le moteur prétend calculer :

- méthode applicable (données du mélange, principes d'extrapolation, méthode de
  calcul) et ordre de priorité entre elles ;
- valeurs seuils génériques et limites de concentration spécifiques ;
- traitement des facteurs M ;
- traitement des plages de concentration déclarées en FDS.

Aucune classe n'est activée dans le moteur sans cette note. Les classes non
couvertes produisent `REGULATORY_REVIEW_REQUIRED`.

---

## 5. Mentions EUH — `À VALIDER`

Conditions exactes de déclenchement des mentions EUH pertinentes pour ce marché
(présence de sensibilisants sous le seuil de classification, disponibilité de la
FDS sur demande, etc.), y compris les seuils et les interactions avec les limites
de concentration spécifiques.

---

## 6. Sélection des conseils de prudence — `À VALIDER`

Critères de sélection, nombre maximal recommandé sur une étiquette, règles de
regroupement et de combinaison, formulations officielles avec leurs parties
variables (texte entre crochets). Normelya proposera une sélection et laissera
toujours l'arbitrage final à l'utilisateur.

---

## 7. Dimensions d'étiquette et de pictogrammes — `À VALIDER`

Dimensions minimales de l'étiquette et des pictogrammes selon la contenance,
conditions de l'étiquetage réduit pour les petits emballages. Tant que ce point
n'est pas validé, le générateur signale le débordement mais n'applique aucune
réduction réglementaire.

---

## 8. Libellés officiels des mentions H, EUH et P — `BLOQUANT`

Les libellés doivent provenir de la source officielle, dans chaque langue
supportée. Ils ne doivent jamais être traduits par l'application ni par un modèle
de langage. Une langue sans libellé officiel chargé est une langue non supportée.

---

## 9. Responsabilité du fabricant artisanal — `À VALIDER`

Qui est « responsable de la mise sur le marché » dans les cas d'un artisan
vendant en direct, d'une vente sous marque de distributeur, d'une revente d'un
produit acheté fini ? Cela détermine le bloc fournisseur de l'étiquette.

---

## 10. Articulation avec les normes de sécurité produit — `À VALIDER`

Les normes relatives à la sécurité des bougies (comportement à la combustion,
étiquetage de sécurité) sont **distinctes** du CLP. Normelya ne doit pas laisser
croire qu'une analyse CLP couvre ces exigences. Un message explicite est prévu.

---

## 11. IFRA — `À VALIDER`

En V1, Normelya **stocke** les certificats IFRA et **rappelle leur existence**,
sans en tirer de conclusion automatique. Exploiter les catégories IFRA et les
limites d'usage suppose de fixer la version de l'amendement de référence, la
catégorie applicable aux bougies et aux fondants, et la méthode de calcul — tout
cela documenté et sourcé.

---

## 12. Formulation des mentions légales et du disclaimer — `BLOQUANT`

Conditions générales d'utilisation, limitation de responsabilité, mentions
affichées sur les documents générés. À faire relire par un juriste avant la mise
en vente. Voir `09-risques.md` § 9.1.

---

## Procédure de validation

Pour chaque point ci-dessus :

1. ouvrir la source primaire officielle ;
2. rédiger une note interne : question, texte cité, référence exacte, conclusion ;
3. créer l'entrée correspondante dans `packages/regulatory-sources` avec
   `verifiedOn` et `verifiedBy` ;
4. écrire la règle et ses tests ;
5. passer la règle de `review_required` à `implemented` ;
6. publier une nouvelle version de moteur.

Tant que l'étape 6 n'est pas faite, l'utilisateur voit un message honnête plutôt
qu'un résultat inventé.

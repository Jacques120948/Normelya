# 16 — Corpus de fiches de données de sécurité

## 16.1 Emplacement et statut

```
fixtures-fds/            ← à la racine du dépôt, JAMAIS versionné
```

Ces documents appartiennent aux fournisseurs. Ils peuvent porter des données
commercialement sensibles, des coordonnées nominatives et des compositions que
leurs auteurs ne souhaitent pas voir circuler. Le dossier est donc exclu du
dépôt par `.gitignore`, avec les fichiers `*.fds.pdf` où qu'ils se trouvent.

**Conséquence pratique** : un poste de développement qui n'a pas reçu le corpus
peut exécuter toute la suite de tests. Les tests du lecteur reposent sur des
documents `DEMO` construits par le code lui-même, pas sur le corpus. Seule la
mesure du taux de réussite exige de vraies fiches.

## 16.2 Composition attendue

| Critère | Cible |
|---------|-------|
| Nombre de fiches | 30 à 50 |
| Fournisseurs distincts | au moins 10 |
| Catégories | parfums, cires, colorants, additifs |
| Langues | français, anglais, allemand |
| Documents scannés, sans couche de texte | au moins 3 |
| Fiches anciennes, antérieures au format actuel | au moins 3 |
| Deux versions d'une même fiche | au moins 1 paire |

Les cas difficiles ont plus de valeur que les cas propres : une fiche mal
structurée révèle une faiblesse du lecteur, une fiche impeccable ne prouve rien.

## 16.3 Mesurer le taux de réussite

```bash
npm run mesurer:corpus                 # lit fixtures-fds/
npm run mesurer:corpus -- /autre/dossier
```

La commande lit chaque PDF, applique la lecture déterministe et classe le
résultat :

| Verdict | Sens |
|---------|------|
| `automatic` | Tous les champs mesurés ont été lus. L'utilisateur contrôle, il ne saisit pas. |
| `light_review` | Le nom et la composition sont lus, quelques champs manquent. |
| `manual_entry` | Le nom ou la composition manquent. La saisie manuelle est nécessaire. |

Le rapport détaille le taux de lecture par champ et **par fournisseur** : c'est
la donnée qui oriente le travail, car les fiches d'un même fournisseur partagent
le même gabarit. Améliorer la lecture d'un gabarit fait progresser toutes ses
fiches d'un coup.

**Aucun appel à un modèle de langage n'est effectué par cette commande.** Elle
mesure exclusivement la lecture déterministe, c'est-à-dire la part du corpus qui
ne coûte rien à traiter.

Le rapport détaillé est écrit en JSON à côté du corpus, donc hors du dépôt : il
nomme des fichiers fournisseurs.

## 16.4 Ce que la mesure ne fait pas

Elle ne juge pas l'**exactitude** de la lecture, seulement sa **complétude**. Un
champ lu peut être faux. Vérifier l'exactitude suppose de comparer, fiche par
fiche, les valeurs lues aux valeurs réelles — c'est un travail humain, à mener
sur un sous-ensemble du corpus une fois la complétude satisfaisante.

C'est précisément la raison d'être de l'écran de vérification : Normelya ne
prétend jamais avoir bien lu, il montre ce qu'il a lu et d'où il le tient.

## 16.5 Première mesure sur fiches réelles — 12 septembre 2026

Corpus mesuré : **4 fiches**, toutes des parfums, d'un même fournisseur pour
trois d'entre elles.

| Indicateur | Résultat |
|------------|----------|
| Lecture automatique | 4 fiches sur 4 |
| Saisie manuelle nécessaire | aucune |
| Recours à un modèle de langage | **aucun** |
| Composants lus | 12 à 53 par fiche |

Taux de lecture par champ : nom du produit, date de révision, version, point
éclair, mentions de danger et composition à 100 %. Nom du fournisseur à 25 %.

### Trois défauts corrigés grâce à ce corpus

Aucun n'apparaissait sur des documents de test. Chacun a donné lieu à un test de
non-régression.

1. **Une fiche entièrement illisible.** Sa mise en page isole le mot
   « section » sur une ligne et reporte le numéro et l'intitulé sur la suivante.
   Aucune rubrique n'était détectée. Une seconde passe, aux règles tolérantes,
   n'est appliquée que si la lecture stricte échoue.
2. **Un nom de fournisseur faux.** Les intitulés officiels emploient les mots
   recherchés : « Renseignements concernant le fournisseur », « de la société ».
   Trois fiches sur quatre relevaient un morceau de titre. Les lignes de titre
   sont désormais écartées.
3. **Aucune date lue.** Les fiches écrivent « Date de version » et « Date
   d'émission », absentes de la liste des étiquettes reconnues.

### Le fournisseur reste à 25 %

Trois fiches placent le nom dans le corps de la sous-rubrique 1.3, sans
étiquette dédiée sur la même ligne. Le champ reste **vide** plutôt que faux :
l'écran de vérification demandera la saisie.

C'est la démonstration de ce qu'annonce le paragraphe 16.4 : la mesure porte sur
la complétude, pas sur l'exactitude. Avant correction, ce champ affichait
100 % avec trois valeurs fausses sur quatre. Le chiffre était meilleur et le
produit était pire.

### Ce que ce corpus ne couvre pas encore

Quatre fiches, trois d'un même fournisseur, toutes en français et toutes
porteuses d'une couche de texte. Manquent : d'autres fournisseurs, des cires et
des colorants, l'anglais et l'allemand, des documents scannés, des fiches
anciennes, et deux versions d'une même fiche.

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

## 16.5 Statut à ce jour

Le corpus n'est pas présent dans l'environnement de développement. Aucune mesure
n'a donc été produite sur des fiches réelles, et aucun taux de réussite n'est
avancé dans cette documentation. Les chiffres n'apparaîtront ici qu'une fois la
commande exécutée sur de vraies fiches.

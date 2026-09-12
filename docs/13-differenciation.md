# 13 — Différenciation

Aucune fonctionnalité, aucun texte, aucun visuel d'un concurrent n'est repris.
La différenciation recherchée n'est pas « plus de fonctions », mais **une
position produit différente**.

## 13.0 Parité fonctionnelle, puis écart

L'analyse de marché montre que la solution de référence sur ce créneau calcule la
dilution à un taux libre et produit la fiche du produit dilué ainsi que
l'étiquette. Normelya doit atteindre ce niveau avant de prétendre différer de
quoi que ce soit.

**Parité attendue** : taux de parfum saisi librement dans un champ numérique,
calcul sur le mélange final complet, étiquette CLP et fiche de données de
sécurité du produit dilué.

**Écart recherché**, sur quatre terrains que la solution de référence ne couvre
pas ou couvre peu :

| Terrain | Position de Normelya |
|---------|----------------------|
| Marché suisse | Module distinct, sans constante partagée avec le module européen. La solution de référence exclut explicitement les marchés hors France |
| Matières premières | Un référentiel d'atelier, pas seulement un calcul ponctuel |
| Archivage | Chaque document conserve ses sources, sa version de moteur et son attestation de validation |
| Confidentialité | Aucune formulation client ne quitte l'infrastructure, garanti par le code |

## 13.1 Les cinq axes

### 1. La traçabilité comme fonctionnalité visible

La plupart des outils affichent un résultat. Normelya affiche un **résultat et
son dossier** : quelle version de FDS, quelle règle, quelle source, quelle
version de moteur, quelle date, quel utilisateur a validé quoi.

Concrètement : un bouton « Pourquoi ce résultat ? » sur chaque ligne de
l'analyse, et un export « dossier produit » qui tient dans un classeur en cas de
contrôle. C'est ce que personne n'aime construire, et c'est exactement ce dont un
artisan a besoin le jour où on lui pose une question.

### 2. L'honnêteté comme argument commercial

Normelya dit « je ne sais pas » quand il ne sait pas, et explique ce qui manque.
Un outil qui produit toujours un résultat est soit exhaustif, soit dangereux.

Message assumé sur la landing page : *Normelya refuse de deviner.*

### 3. La séparation stricte entre l'IA et la décision

L'IA lit et explique. Le moteur décide. Cette séparation est visible dans
l'interface, documentée publiquement, et vérifiable : la version du moteur figure
sur chaque document généré.

Message : *L'IA vous aide. Elle ne décide pas de votre classification.*

### 4. La gestion du cycle de vie plutôt que l'acte ponctuel

Le vrai problème d'un artisan n'est pas de produire une étiquette une fois. C'est
que trois mois plus tard son fournisseur publie une nouvelle FDS et qu'il ne le
sait pas. Le centre de conformité, les alertes de version, le rejeu comparatif
entre versions de moteur et l'historique complet traitent ce problème-là.

### 5. La confidentialité des formulations, garantie par le code

Aucun appel à un modèle de langage ne reçoit une recette, une formulation ou un
pourcentage client. Ce n'est pas une promesse commerciale : c'est un type marqué
que le compilateur fait respecter, un contrôle d'exécution avant chaque sortie
réseau, et une règle de lint qui échoue le build.

Un modèle ne voit que des documents fournisseurs — des fiches qui circulent déjà
entre le fournisseur et tous ses clients. La recette de l'artisan, jamais.

Une organisation peut en outre désactiver toute assistance par IA. Et l'export
complet des données est disponible dans tous les plans, y compris le gratuit. Un
artisan qui craint d'être prisonnier d'un outil, ou de voir sa formule servir à
entraîner un modèle, a une réponse vérifiable.

## 13.2 Différenciations secondaires

| Axe | Contenu |
|-----|---------|
| Français et suisse dès le départ | Deux marchés traités séparément, pas un marché principal et un « aussi » |
| Taux de parfum libre | Champ numérique, jamais une liste de valeurs prédéfinies |
| Recettes à plusieurs parfums | Le calcul porte sur le mélange final, deux parfums apportant la même substance s'additionnent |
| Avertissement de proximité de seuil | L'artisan sait quand un demi-point de parfum changerait son étiquette |
| Interface non technique | Aucun écran n'exige de comprendre la réglementation pour avancer |
| Gratuit réellement utilisable | 3 produits complets, pas une démonstration bridée |
| Coût de revient intégré | Le même outil répond à « est-ce vendable ? » et « est-ce rentable ? » |
| Mobile en consultation | Vérifier une étiquette depuis l'atelier, sans ordinateur |
| Design sobre et lumineux | Style SaaS contemporain, pas d'esthétique de logiciel de laboratoire |

## 13.3 Ce que Normelya ne cherchera pas à faire

- rivaliser sur le nombre de pays couverts au lancement ;
- proposer une base de données de substances exhaustive ;
- remplacer un expert réglementaire sur les cas complexes ;
- automatiser les déclarations officielles.

Une petite surface, parfaitement tenue et traçable, vaut mieux qu'une grande
surface approximative — sur ce marché plus que sur tout autre.

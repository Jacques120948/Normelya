# 01 — Résumé du produit

## 1.1 En une phrase

**Normelya** est un logiciel en ligne (SaaS) par abonnement qui permet à un
artisan cirier, un créateur de bougies ou de fondants parfumés de centraliser ses
documents fournisseurs, de décrire ses recettes, et d'obtenir une **analyse
réglementaire reproductible** accompagnée des documents qui en découlent
(étiquette, dossier produit, historique).

Signature : *La conformité simplifiée pour les créateurs.*
Promesse : *De votre recette à votre analyse réglementaire, en quelques minutes.*

## 1.2 Le problème résolu

Un artisan qui vend une bougie parfumée doit aujourd'hui manipuler, sans être
chimiste :

- des fiches de données de sécurité (FDS) fournisseur de 16 sections, en PDF,
  parfois en anglais, souvent mises à jour sans prévenir ;
- des certificats IFRA et des déclarations d'allergènes ;
- des règles de classification et d'étiquetage (CLP) qui dépendent de la
  concentration de chaque substance dans **sa** recette, pas dans le parfum brut ;
- des obligations déclaratives (UFI / notification aux centres antipoison) ;
- des différences entre marché français et marché suisse ;
- l'obligation de conserver la trace de ce qu'il a fait, et quand.

Le tout est généralement géré dans un tableur, un dossier de PDF et un fichier
Word d'étiquette. C'est fragile, non traçable, et impossible à reprendre quand
une FDS change.

## 1.3 Ce que Normelya fait

```
IMPORTER  →  VÉRIFIER  →  CRÉER LA RECETTE  →  ANALYSER  →  ÉTIQUETER  →  ARCHIVER
```

1. **Importer** — l'utilisateur dépose la FDS PDF de son parfum ou de sa cire.
2. **Vérifier** — Normelya propose une lecture structurée du document ; l'utilisateur
   corrige et **valide explicitement**. Rien n'est réputé exact avant cette validation.
3. **Créer la recette** — pourcentages par matière première, total contrôlé à 100 %.
4. **Analyser** — le moteur déterministe calcule à partir des données validées.
5. **Étiqueter** — génération d'une étiquette au format choisi, sans suppression
   automatique d'une mention réglementaire.
6. **Archiver** — chaque analyse fige la recette, les versions de FDS utilisées,
   la version du moteur, la date, l'utilisateur.

## 1.4 Ce que Normelya n'est pas

- Ce n'est pas un cabinet de conseil réglementaire ni un toxicologue.
- Ce n'est pas un service de déclaration : Normelya prépare et explique les
  démarches, il ne les effectue pas à la place de l'utilisateur.
- Ce n'est pas un générateur de FDS. Normelya **lit** des FDS fournisseurs ;
  produire une FDS pour un produit fini est un acte d'expertise hors périmètre V1.
- Ce n'est pas une IA qui « décide » de la conformité. Voir § 1.6.

## 1.5 Cible

Priorité V1 : créateurs de bougies, ciriers artisanaux, créateurs de fondants,
microentreprises, petites marques, ateliers. Profil dominant : non-chimiste,
entre 1 et 5 personnes, 5 à 50 références produit, 3 à 20 matières premières.

Conséquences produit directes :

- vocabulaire non technique par défaut, terme réglementaire exact en second plan ;
- aucun écran ne doit exiger de comprendre la réglementation pour avancer ;
- chaque résultat est accompagné d'un « pourquoi » en langage courant ;
- l'application doit être utilisable sur mobile en consultation.

## 1.6 Principe fondateur : l'IA n'est pas le moteur réglementaire

| L'IA peut | L'IA ne doit jamais |
|-----------|---------------------|
| lire un PDF, en extraire du texte et des tableaux | décider d'une classification CLP |
| proposer une structuration de FDS | choisir un pictogramme ou un mot d'avertissement |
| repérer une incohérence probable | fixer un seuil |
| reformuler et expliquer un résultat | décider qu'un UFI est nécessaire |
| guider l'utilisateur dans le parcours | produire un résultat réglementaire final |

Le résultat réglementaire provient d'un **moteur déterministe, versionné et
testé** : même entrée ⇒ même sortie, aujourd'hui et dans deux ans. L'interface
distingue visuellement et sémantiquement deux objets :

- **Résultat Normelya** — calculé, traçable, reproductible, opposable en interne ;
- **Explication de l'assistant** — texte généré, pédagogique, jamais normatif.

## 1.7 Statuts produit

Normelya n'emploie pas le mot « conforme » comme résultat d'un calcul.

| Statut | Sens |
|--------|------|
| ✓ Analyse terminée | Le moteur a produit un résultat complet à partir de données validées |
| ⚠ Vérification nécessaire | Une donnée manque, est incertaine, ou une règle n'est pas couverte |
| ● Action requise | L'utilisateur doit agir (FDS obsolète, champ non validé, quota atteint) |
| ○ Non applicable | La règle ne concerne pas ce produit / ce marché |

## 1.8 Modèle économique

| Plan | Prix | Contenu |
|------|------|---------|
| Gratuit | 0 € | 3 produits, parcours complet pour évaluer réellement l'outil |
| Essentiel | 9,90 €/mois | 10 produits actifs, FDS, analyse, CLP, étiquettes, historique |
| Pro | 19,90 €/mois | Produits illimités, UFI, documents, exports, historique complet, assistant |
| Atelier | 29,90 €/mois | Pro + lots, traçabilité, coûts de revient, multi-utilisateurs |

Annuel : ~2 mois offerts. **Toutes les limites sont appliquées côté serveur**,
jamais uniquement dans l'interface.

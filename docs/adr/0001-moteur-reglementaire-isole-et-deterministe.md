# ADR 0001 — Moteur réglementaire isolé et déterministe

- **Statut** : accepté
- **Date** : 2026-09-12

## Contexte

Normelya produit des résultats qui influencent l'étiquetage de produits mis sur
le marché. Ces résultats doivent être reproductibles, explicables et défendables
plusieurs années après leur production.

## Décision

Le moteur réglementaire est un paquet autonome (`packages/regulatory-engine`)
sans dépendance runtime, sans entrée/sortie, sans horloge et sans aléatoire. Son
interface est une fonction pure `EngineInput -> EngineOutput`. Chaque sortie
porte la règle et la source qui l'ont produite. Aucun modèle de langage ne peut
influencer son résultat.

## Conséquences

- Testable à 100 %, rejouable, comparable entre versions.
- L'interface ne peut pas contourner le moteur : elle n'a pas accès aux règles.
- Coût : toute donnée doit être explicitement fournie en entrée, y compris la
  date d'évaluation.

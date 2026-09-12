# ADR 0003 — Append-only sur les données réglementaires

- **Statut** : accepté
- **Date** : 2026-09-12

## Contexte

Une analyse réglementaire est un acte daté. La modifier a posteriori détruirait
sa valeur probante.

## Décision

`regulatory_calculations`, `regulatory_results`, `generated_documents` et
`audit_logs` n'acceptent que des `INSERT`. Les `UPDATE` et `DELETE` sont bloqués
par déclencheur et par absence de politique RLS correspondante. Corriger une
analyse consiste à en produire une nouvelle. Les versions de FDS ne sont jamais
écrasées ; les recettes sont figées dès qu'une analyse s'y rattache.

## Conséquences

- Croissance du volume maîtrisée (données petites, textuelles).
- Toute correction est visible dans l'historique.
- L'effacement RGPD est une opération privilégiée, explicite et journalisée.

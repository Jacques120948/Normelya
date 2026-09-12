# Dossier d'architecture Normelya

Ce dossier contient l'analyse produit et technique de Normelya, réalisée **avant**
l'écriture du code applicatif, conformément à la demande initiale.

| # | Document | Contenu |
|---|----------|---------|
| 01 | [`01-produit.md`](./01-produit.md) | Résumé du produit, positionnement, cibles, parcours |
| 02 | [`02-architecture.md`](./02-architecture.md) | Architecture technique, arborescence du projet |
| 03 | [`03-schema-postgresql.md`](./03-schema-postgresql.md) | Schéma PostgreSQL proposé, multi-tenant, RLS |
| 04 | [`04-moteur-reglementaire.md`](./04-moteur-reglementaire.md) | Architecture du moteur déterministe, versionnage, sources |
| 05 | [`05-extraction-fds.md`](./05-extraction-fds.md) | Stratégie d'import et d'extraction des FDS |
| 06 | [`06-etiquettes.md`](./06-etiquettes.md) | Stratégie de génération des étiquettes |
| 07 | [`07-france-suisse.md`](./07-france-suisse.md) | Stratégie France / Suisse et extension UE |
| 08 | [`08-validation-humaine.md`](./08-validation-humaine.md) | Points nécessitant impérativement une validation réglementaire humaine |
| 09 | [`09-risques.md`](./09-risques.md) | Risques juridiques, techniques et sécurité |
| 10 | [`10-services-et-couts.md`](./10-services-et-couts.md) | Services externes et estimation des coûts d'exploitation |
| 11 | [`11-sans-ia.md`](./11-sans-ia.md) | Fonctions fonctionnant sans IA, politique d'usage de l'IA |
| 12 | [`12-roadmap-mvp.md`](./12-roadmap-mvp.md) | Feuille de route MVP commercialisable |
| 13 | [`13-differenciation.md`](./13-differenciation.md) | Différenciation par rapport aux solutions existantes |
| 14 | [`14-recommandations.md`](./14-recommandations.md) | Recommandations avant développement, décisions à trancher |

Les décisions structurantes sont consignées sous forme d'ADR dans [`adr/`](./adr/).

## Convention de lecture

Tout élément marqué **`REGULATORY_REVIEW_REQUIRED`** signale une affirmation
réglementaire qui n'a pas été vérifiée sur une source officielle primaire à la
date de rédaction. Ces éléments ne doivent **jamais** être implémentés comme une
règle automatique du moteur tant qu'ils n'ont pas été validés par une personne
compétente et rattachés à une source citable.

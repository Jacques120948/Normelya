# 11 — Ce qui fonctionne sans IA

## 11.1 Fonctionne intégralement sans IA (la quasi-totalité du produit)

- inscription, connexion, vérification d'e-mail, réinitialisation, suppression ;
- onboarding, organisations, membres, rôles ;
- tableau de bord, compteurs, raccourcis ;
- matières premières : création, catégories, fournisseurs, références, documents ;
- dépôt de documents, déduplication, versionnage des FDS, archivage ;
- **extraction de FDS lorsque le PDF contient du texte structuré** (majorité des cas) ;
- reconnaissance et validation des numéros CAS et CE, y compris les sommes de
  contrôle ;
- reconnaissance des codes H, EUH, P par liste fermée ;
- détection de la date de révision et de la version ;
- contrôles de cohérence (somme des concentrations, correspondances §2/§3) ;
- produits, versions, recettes, contrôle du total à 100 % ;
- **l'intégralité du moteur réglementaire** — par construction ;
- résultats, statuts, journal d'explication ;
- génération d'étiquettes, mise en page, détection de débordement, PDF et PNG ;
- documents générés, historique, dossier produit ;
- alertes du centre de conformité ;
- coût de revient, marges ;
- lots et traçabilité (V2) ;
- abonnements, quotas, facturation ;
- back-office, statistiques, audit ;
- landing page, SEO, pages légales.

## 11.2 L'IA apporte une vraie valeur à trois endroits seulement

| Usage | Valeur | Repli sans IA |
|-------|--------|---------------|
| Lecture d'une FDS atypique ou scannée | fait gagner 20 à 40 minutes | saisie manuelle assistée, parcours complet |
| Assistant explicatif (« pourquoi H317 ? ») | rend le résultat compréhensible | textes pédagogiques pré-écrits, rattachés aux règles |
| Détection d'incohérence probable | prévient une erreur | contrôles algorithmiques, déjà l'essentiel |

## 11.3 Règle d'engagement

L'IA est appelée si et seulement si :

1. l'algorithme n'a pas su répondre, **et**
2. l'organisation a activé l'assistance IA, **et**
3. le quota mensuel n'est pas atteint, **et**
4. le document n'est pas déjà en cache.

Sa sortie est toujours **revalidée par les validateurs algorithmiques** avant
d'être proposée, et jamais présentée comme certaine.

## 11.4 Mode « sans IA » assumé

Une organisation peut désactiver totalement l'assistance IA dans ses paramètres.
Dans ce mode, aucun contenu ne quitte l'infrastructure Normelya vers un tiers
d'inférence. Le produit reste entièrement fonctionnel, avec davantage de saisie
manuelle. C'est un argument commercial pour les utilisateurs soucieux du secret
de leurs formules — et un filet de sécurité en cas de panne ou de hausse
tarifaire d'un fournisseur d'IA.

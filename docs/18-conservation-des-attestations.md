# 18 — Conservation des attestations de validation

> **Statut : décision d'exploitation, à faire relire par un juriste en phase 9.**
> Ce document consigne un choix et les articles invoqués. Il ne constitue pas un
> avis juridique.

Décision prise le 12 septembre 2026 par le porteur du projet.

## 18.1 La question

Une attestation de validation enregistre qu'une personne a coché
« Je confirme avoir vérifié ces informations », à une date donnée, sur des
données dont l'empreinte est conservée. C'est la principale pièce de défense de
Normelya et de son utilisateur en cas de litige.

Lorsqu'un utilisateur demande la suppression de son compte, deux exigences se
rencontrent :

- la personne peut obtenir l'effacement de ses données à caractère personnel ;
- la pièce doit rester exploitable pour établir ce qui a été validé, et par qui.

Effacer l'attestation détruit sa valeur probante. La conserver telle quelle
maintient indéfiniment des données d'identification.

## 18.2 La décision

**Conservation avec pseudonymisation, puis purge automatique.**

À la suppression du compte :

| Donnée | Traitement |
|--------|------------|
| Nom de la personne | **effacé** |
| Adresse électronique | **effacée** |
| Identifiant technique du compte | conservé |
| Horodatage de l'attestation | conservé |
| Empreinte des données validées | conservée |
| Texte exact de la déclaration acceptée | conservé |
| Version du moteur réglementaire | conservée |

Dix ans après la suppression du compte, l'attestation est **purgée
automatiquement**.

## 18.3 Fondements invoqués

**Conservation malgré la demande d'effacement.** Règlement (UE) 2016/679,
article 17, paragraphe 3, point e) : le droit à l'effacement ne s'applique pas
dans la mesure où le traitement est nécessaire à la constatation, à l'exercice
ou à la défense de droits en justice.

**Bornage de la durée.** Règlement (UE) 2016/679, article 5, paragraphe 1,
point e) : les données ne sont conservées que pendant la durée nécessaire au
regard des finalités. Une conservation indéfinie ne serait pas défendable, d'où
la purge à dix ans.

**Minimisation.** Règlement (UE) 2016/679, article 5, paragraphe 1, point c).
La finalité probante n'exige pas le nom ni l'adresse : l'identifiant technique
du compte suffit à établir qu'une même personne a validé plusieurs éléments, et
à relier l'attestation au journal d'audit.

**Points que le juriste devra examiner en phase 9 :**

1. la durée de dix ans au regard des délais de prescription applicables ;
2. la qualification exacte de l'identifiant technique conservé, qui reste une
   donnée à caractère personnel au sens du règlement, la pseudonymisation
   n'étant pas une anonymisation ;
3. l'information à donner à l'utilisateur au moment de la suppression ;
4. l'articulation avec les durées de conservation du journal d'audit, traité
   différemment puisqu'il est simplement dissocié du compte.

## 18.4 Mise en œuvre

### À la suppression du compte

La suppression appelle `app.pseudonymize_attestations`, qui efface le nom et
l'adresse, horodate l'opération et pose la date de purge. La fonction pose
elle-même le mode effacement, par la clause `SET` de sa définition : le mode ne
vaut que pendant son exécution et est restauré à sa sortie.

L'identifiant technique du compte survit à la suppression de l'utilisateur. La
contrainte de clé étrangère vers la table des utilisateurs a donc été retirée :
la colonne est un identifiant conservé, plus un lien.

### La purge est automatique

```bash
npm run purger                    # purge réelle
npm run purger -- --simulation    # compte sans supprimer
npm run purger -- --date=2036-01-01 --simulation
```

Une tâche planifiée l'exécute chaque jour
(`.github/workflows/purge-quotidienne.yml`). **Elle n'est pas manuelle** : une
conservation qui dépendrait d'un geste humain ne serait pas une politique de
conservation.

La date d'évaluation est un paramètre de la fonction SQL, ce qui rend le
comportement testable sans dépendre de l'horloge du serveur.

### Garanties vérifiées par les tests

| Garantie | Vérifiée |
|----------|----------|
| L'identité est présente tant que le compte existe | oui |
| Toute modification hors effacement est refusée | oui |
| Le nom et l'adresse sont effacés, le reste conservé | oui |
| La purge est fixée à dix ans | oui |
| Rien n'est purgé avant l'échéance | oui |
| Une attestation dont le compte vit n'est jamais touchée | oui |
| Une attestation pseudonymisée sans date de purge est refusée | oui |

La dernière garantie est structurelle : une contrainte de base refuse une
attestation pseudonymisée qui n'aurait pas de date de purge. Il est donc
impossible de pseudonymiser sans borner la conservation.

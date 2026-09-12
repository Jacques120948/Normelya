# 14 — Recommandations avant et pendant le développement

## 14.1 Les cinq recommandations essentielles

### R1 — Engager la validation réglementaire maintenant, en parallèle du code

C'est le chemin critique du projet, et le seul que le développement ne peut pas
raccourcir. Les points `BLOQUANT` de `08-validation-humaine.md` doivent être
confiés à une personne compétente (consultant réglementaire, cabinet spécialisé,
ou temps de travail dédié sur les textes officiels) dès à présent. Budget à
prévoir explicitement.

**Sans cette étape, le moteur restera en mode « vérification nécessaire » et le
produit ne sera pas vendable, quel que soit l'état du code.**

### R2 — Constituer un corpus réel de FDS avant la phase 3

Il faut 30 à 50 FDS réelles, provenant d'au moins 10 fournisseurs différents
(parfums, cires, colorants), en français, anglais et allemand, incluant des PDF
scannés. Ce corpus détermine la qualité de l'extraction et sert de jeu de tests
permanent. Le collecter est une tâche de quelques heures qui conditionne des
semaines de développement.

### R3 — Recruter 5 artisans testeurs dès la phase 2

Pas pour valider le design, mais pour observer où ils bloquent. Contrepartie :
accès gratuit à vie au plan Pro. Un retour sur l'écran de vérification de FDS
vaut plus que trois itérations d'interface faites à l'aveugle.

### R4 — Faire relire les mentions juridiques avant la mise en vente

CGU, CGV, disclaimer, politique de confidentialité, et le texte affiché sur les
documents générés. Un juriste, une fois, avant le premier paiement encaissé.

### R5 — Écrire les tests du moteur avant les règles

Pour chaque classe de danger : d'abord le jeu de cas issu de la note de
validation réglementaire, ensuite l'implémentation. C'est la seule méthode qui
garantit que le code traduit la note, et non l'intuition du développeur.

## 14.2 Décisions à impact fort à trancher par le porteur du projet

Ces décisions engagent la réglementation, le coût, le modèle économique ou
l'expérience utilisateur. Le développement de la phase 1 ne dépend d'aucune
d'entre elles et se poursuit.

| # | Décision | Options | Recommandation |
|---|----------|---------|----------------|
| D1 | Validation réglementaire | consultant externe / formation interne / report | **Consultant externe sur les points bloquants**, internalisation ensuite |
| D2 | Marché suisse en V1 | livrer FR seul d'abord / livrer FR + CH | **FR d'abord**, CH en V1.1 après validation : évite un engagement sur un corpus non vérifié |
| D3 | Hébergement des données | Supabase (UE) / hébergeur suisse / VPS européen | **Supabase région UE** au départ, réversible par les adaptateurs |
| D4 | Fournisseur d'IA | API commerciale / modèle auto-hébergé / sans IA | **API commerciale avec engagement de non-entraînement**, mode sans IA disponible |
| D5 | Période d'essai | gratuit permanent à 3 produits / essai 14 jours du plan Pro | **Gratuit permanent** : meilleur pour le bouche-à-oreille artisan |
| D6 | Assurance RC professionnelle | souscrire avant la vente / après | **Avant le premier paiement encaissé** |
| D7 | Génération d'UFI | générer dans Normelya / enregistrer seulement | **Enregistrer seulement en V1**, génération après validation du point n° 2 |
| D8 | Pages SEO | rédaction interne / externalisée | **Interne**, à partir des notes de validation réglementaire : contenu réellement utile et différenciant |

## 14.3 Règles de travail pour la suite

1. Une phase se termine par : code + tests verts + documentation + commit.
2. Aucune règle réglementaire n'entre dans le code sans entrée de source associée.
3. Aucune donnée fictive sans marquage `DEMO` explicite en base et à l'écran.
4. Tout écrit utilisateur passe par le dictionnaire d'internationalisation.
5. Toute écriture en base passe par un service validant le contexte et les quotas.
6. Tout bug moteur produit un test de non-régression conservé définitivement.
7. Aucun secret hors du serveur ; contrôle automatisé en intégration continue.

## 14.4 Indicateurs à suivre dès le premier client

| Indicateur | Cible initiale |
|------------|----------------|
| Temps entre inscription et première analyse | < 30 minutes |
| Champs de FDS validés sans correction | > 70 % |
| Part des imports déclenchant un appel IA | < 40 % |
| Analyses terminées / analyses en « vérification nécessaire » | à suivre, sans forcer la première |
| Conversion gratuit → payant | 8 à 15 % |
| Coût d'infrastructure par client actif | < 2 € / mois |

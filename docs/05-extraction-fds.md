# 05 — Stratégie d'import et d'extraction des FDS

## 5.1 Objectif et contrainte

Objectif : réduire le temps de saisie d'une FDS de 30–60 minutes à 3–5 minutes de
**vérification**.

Contrainte absolue : une extraction automatique n'est jamais une donnée validée.
Le moteur réglementaire refuse de consommer une version de FDS dont
`status !== 'validated'`.

## 5.2 Chaîne de traitement

```
PDF déposé
   │
   ├─ 0. Contrôles d'entrée
   │     MIME réel (magic bytes, pas l'extension), taille ≤ 20 Mo,
   │     PDF non chiffré, pas de JavaScript embarqué, sha256 calculé
   │     → doublon détecté = on rattache, on ne re-traite pas
   │
   ├─ 1. Extraction de texte native (pdf.js / pdfjs-dist)
   │     Couvre la grande majorité des FDS fournisseurs, coût ≈ 0
   │
   ├─ 2. Si le texte est vide ou trop pauvre → OCR
   │     Tesseract (fr+en+de) exécuté côté serveur, en tâche de fond
   │
   ├─ 3. Segmentation en sections 1 à 16
   │     Détection par expressions régulières multilingues sur les intitulés
   │     normalisés des FDS. Étape purement algorithmique.
   │
   ├─ 4. Extraction structurée par section — algorithmique d'abord
   │     · §1  : nom commercial, fournisseur, usage
   │     · §2  : classification, mentions H/EUH/P, mot d'avertissement, pictogrammes
   │     · §3  : tableau de composition → CAS, CE, %, classification
   │     · §9  : point éclair, densité, point de fusion
   │     · §12 : données environnementales
   │     · §14 : transport
   │     · §16 : date de révision, version, mentions H en clair
   │     Les codes suivent des formats stricts et vérifiables :
   │       CAS      ^\d{2,7}-\d{2}-\d$  + somme de contrôle du dernier chiffre
   │       CE       ^\d{3}-\d{3}-\d$    + somme de contrôle
   │       H/EUH/P  listes fermées de codes officiels
   │     → aucune valeur hors format n'est acceptée
   │
   ├─ 5. IA d'appoint — uniquement si l'étape 4 laisse des trous
   │     Entrée : le texte des sections concernées, pas le PDF entier
   │     Sortie : JSON contraint par un schéma strict
   │     Toute valeur renvoyée repasse par les validateurs de l'étape 4
   │     Coût mesuré et enregistré dans sds_extraction_runs
   │
   ├─ 6. Contrôles de cohérence (algorithmiques)
   │     · somme des concentrations ≤ 100 %
   │     · une mention H citée en §2 correspond-elle à une substance de §3 ?
   │     · un CAS connu du référentiel a-t-il une classification contradictoire ?
   │     · date de révision postérieure à la version précédente ?
   │     → chaque anomalie devient un point d'attention dans l'écran de vérification
   │
   └─ 7. Écran « Vérifiez les informations détectées »
         Chaque champ affiche : la valeur, son niveau de confiance,
         et l'extrait du PDF d'où elle vient (page + surlignage).
         Case obligatoire : « Je confirme avoir vérifié ces informations. »
```

## 5.3 Politique d'usage de l'IA dans l'extraction

| Situation | Traitement |
|-----------|------------|
| PDF texte bien structuré | 100 % algorithmique, **aucun appel IA** |
| Tableau de composition atypique | IA sur la section 3 uniquement |
| PDF scanné | OCR puis algorithmique, IA si nécessaire |
| Document dans une langue non couverte | IA pour la segmentation, valeurs toujours revalidées |
| FDS déjà importée (même sha256) | Réutilisation, coût nul |

Mesure cible : **moins de 40 % des imports** déclenchent un appel IA, pour un
coût unitaire de l'ordre de 0,01 à 0,04 €.

## 5.4 Confiance et affichage

Chaque champ extrait porte un score :

| Score | Origine | Affichage |
|-------|---------|-----------|
| 1.00 | Format strict validé + trouvé à l'emplacement attendu | valeur simple |
| 0.70–0.99 | Format validé, emplacement inhabituel | valeur + « à confirmer » |
| < 0.70 | Reconstruit, ou issu de l'IA seule | champ vide pré-rempli, mis en évidence |
| — | Absent | champ vide, explication de ce qui est attendu |

Un champ à faible confiance n'est jamais présenté comme une certitude.

## 5.5 Versionnage des FDS

- Une matière première possède une FDS (entité stable) et **N versions**.
- Déposer un nouveau PDF crée une **nouvelle version**, jamais un écrasement.
- L'ancienne version passe en `archived` mais reste lisible et téléchargeable.
- Chaque `recipe_ingredients` pointe la `sds_version_id` exacte utilisée.
- Lorsqu'une nouvelle version est validée, Normelya crée une notification
  `product_uses_old_sds` pour chaque produit concerné, avec un bouton
  « Relancer l'analyse ». **Aucune analyse n'est recalculée automatiquement.**

```
Fleur de coton
 ├─ FDS V1 — 12/2025 — ARCHIVÉE — utilisée par 2 analyses
 └─ FDS V2 — 03/2026 — ACTIVE
```

## 5.6 Journal de traçabilité

Chaque import enregistre : le PDF original intact, le texte extrait, la sortie
brute de chaque tentative, les données corrigées, l'auteur et la date de
validation, le champ modifié et sa valeur avant/après. C'est ce journal qui rend
l'analyse défendable en cas de contrôle.

## 5.7 Ce qui n'est volontairement pas automatisé

- La **saisie d'une classification absente de la FDS**. Si le fournisseur ne la
  fournit pas, Normelya le dit et n'en déduit aucune.
- La **traduction** d'une mention H. Les libellés officiels par langue sont des
  données de référence, pas une traduction produite à la volée.
- La **complétion** d'une composition partielle. Une FDS qui ne déclare que 60 %
  de sa composition reste une FDS incomplète, avec un `ReviewFlag` associé.

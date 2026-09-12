# 10 — Services externes et coûts d'exploitation

Montants indicatifs hors taxes, à vérifier avant engagement : les grilles
tarifaires évoluent. L'objectif de ce document est la **structure** des coûts et
la présence d'une alternative pour chaque poste.

## 10.1 Tableau des services

| Service | Rôle | Coût fixe | Coût variable | Coût / client / mois | Alternative moins chère | Auto-hébergeable |
|---------|------|-----------|---------------|----------------------|-------------------------|------------------|
| Hébergement applicatif (Vercel ou équivalent) | Next.js, API | 0 € puis ~20 €/mois par siège | bande passante, fonctions | ~0,05–0,20 € | VPS 6–12 €/mois (Hetzner, Infomaniak) + Docker | oui |
| PostgreSQL + Auth + Stockage (Supabase) | base, authentification, fichiers | 0 € puis ~25 €/mois | stockage et trafic au-delà du forfait | ~0,25 € | PostgreSQL managé (~7–15 €) + Auth maison + S3 compatible | oui |
| Stockage objet | PDF utilisateurs | inclus | ~0,02 €/Go/mois au-delà | ~0,02 € (≈ 50–200 Mo/client) | Cloudflare R2, Scaleway, Backblaze | oui |
| E-mail transactionnel (Resend, Brevo, Postmark) | vérification, réinitialisation, alertes | 0 € puis ~20 €/mois | au-delà du quota | ~0,02 € | SMTP Infomaniak / Brevo gratuit 300/j | partiel |
| Stripe | paiement, abonnements, facturation | 0 € | ~1,5 % + 0,25 € (cartes UE) | ~0,40 € sur un abonnement à 19,90 € | aucune réellement moins chère à ce volume | non |
| Fournisseur IA (extraction + assistant) | lecture de FDS, explications | 0 € | à l'appel | **0,05–0,30 €** | modèle ouvert auto-hébergé | oui, mais coût GPU |
| OCR | PDF scannés | 0 € | CPU | ~0,01 € | Tesseract sur le serveur applicatif | oui |
| Supervision des erreurs (Sentry) | qualité | 0 € puis ~26 €/mois | événements | ~0,05 € | GlitchTip auto-hébergé | oui |
| Analytique produit (Plausible, Umami) | mesure | ~9 €/mois | — | ~0,02 € | Umami auto-hébergé | oui |
| Nom de domaine + certificats | — | ~15 €/an | — | négligeable | — | — |
| Sauvegardes externalisées | sécurité | ~5 €/mois | volume | ~0,02 € | script + stockage objet | oui |

## 10.2 Scénarios

### Démarrage — 0 à 20 clients

| Poste | Coût mensuel |
|-------|--------------|
| Hébergement (offre gratuite ou VPS) | 0–12 € |
| Base / Auth / Stockage (offre gratuite) | 0 € |
| E-mail (offre gratuite) | 0 € |
| Supervision (offre gratuite) | 0 € |
| IA | 2–10 € |
| Domaine | ~1 € |
| **Total** | **≈ 5 à 25 €/mois** |

### 100 clients payants (~1 500 €/mois de revenu)

| Poste | Coût mensuel |
|-------|--------------|
| Hébergement | 20 € |
| Base / Auth / Stockage | 25 € |
| Stockage supplémentaire | 5 € |
| E-mail | 20 € |
| Stripe (~1 500 € encaissés) | ~48 € |
| IA | 20–40 € |
| Supervision + analytique | 35 € |
| Sauvegardes | 5 € |
| **Total** | **≈ 180 à 200 €/mois**, soit **~12 % du revenu** |

### 250 clients (~4 000 €/mois)

Environ **350 à 450 €/mois**, soit ~10 %.

### 500 clients (~8 000 €/mois)

Environ **700 à 900 €/mois**, soit ~10 %. À ce stade, migrer l'hébergement
applicatif et la base vers des ressources dédiées devient rentable.

## 10.3 Le vrai coût n'est pas l'infrastructure

| Poste | Ordre de grandeur annuel |
|-------|--------------------------|
| Infrastructure à 100 clients | ~2 400 € |
| **Veille et validation réglementaire** | **plusieurs milliers d'euros** |
| Relecture juridique (CGU, CGV, disclaimer) | 1 000 à 3 000 € |
| Assurance responsabilité civile professionnelle | 400 à 1 500 € |
| Support client | temps humain, ~10 min/client/mois |

C'est la ligne réglementaire qui détermine la viabilité, pas la ligne serveur.
Elle doit être budgétée dès le départ.

## 10.4 Règles de maîtrise des coûts

1. **Pas d'appel IA lorsqu'un algorithme suffit** — mesure cible : < 40 % des
   imports déclenchent un appel.
2. **Cache par empreinte de document** — le même PDF n'est jamais analysé deux fois.
3. **Compteur par organisation** avec plafond par plan et alerte à 80 %.
4. **Modèle proportionné** : un modèle économique pour l'extraction structurée,
   un modèle plus capable réservé à l'assistant explicatif.
5. **Aucun traitement d'arrière-plan permanent** : tout est déclenché par une
   action utilisateur ou une tâche planifiée peu fréquente.
6. **Surveillance mensuelle du coût par client actif**, avec seuil d'alerte.

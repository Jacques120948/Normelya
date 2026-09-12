# 03 — Schéma PostgreSQL proposé

## 3.1 Règles transverses

- **Unité de cloisonnement : l'organisation.** Toute table contenant des données
  client porte `organization_id` et une politique RLS. Pas d'exception.
- **Identifiants** : `uuid` (`gen_random_uuid()`), jamais de compteur exposé.
- **Horodatage** : `created_at`, `updated_at` en `timestamptz`, `now()` par défaut.
- **Suppression** : `deleted_at` (soft delete) pour tout ce qui doit rester
  traçable ; suppression physique réservée à l'effacement RGPD.
- **Immuabilité réglementaire** : les tables `regulatory_calculations`,
  `regulatory_results`, `generated_documents` sont en **append-only** (trigger
  bloquant `UPDATE`/`DELETE`).
- **Argent** : `numeric(12,4)` + code devise, jamais de flottant.
- **Pourcentages de recette** : `numeric(9,6)`, contrainte `>= 0 AND <= 100`.
- **Enums** : types PostgreSQL nommés, pour que la base refuse une valeur inconnue.

## 3.2 Identité et organisations

```
users                     compte personne physique
  id, email (citext, unique), email_verified_at, full_name, first_name,
  last_name, phone, locale, is_platform_admin, last_seen_at,
  created_at, updated_at, deleted_at

organizations             l'atelier — unité de facturation et d'isolation
  id, name, legal_name, country ('FR' | 'CH'), address_line1, address_line2,
  postal_code, city, vat_number, contact_email, contact_phone,
  activity ('candles' | 'wax_melts' | 'both'), onboarding_completed_at,
  default_locale, created_at, updated_at, deleted_at

organization_members      appartenance + rôle
  id, organization_id, user_id, role ('owner'|'admin'|'member'|'viewer'),
  invited_by, invited_at, accepted_at, created_at, updated_at
  UNIQUE (organization_id, user_id)

user_sessions             sessions applicatives (audit, révocation)
  id, user_id, organization_id, ip_hash, user_agent_hash,
  created_at, last_used_at, revoked_at

invitations
  id, organization_id, email, role, token_hash, expires_at,
  accepted_at, created_at
```

> `organization_members` est la table pivot de **toute** politique RLS :
> « j'ai accès à la ligne si j'appartiens à son organisation ».

## 3.3 Abonnement et quotas

```
plans                     référentiel des offres (administrable)
  id, code ('free'|'essential'|'pro'|'atelier'), name,
  price_monthly_cents, price_yearly_cents, currency,
  max_active_products (null = illimité), max_members, max_storage_mb,
  features jsonb, stripe_price_monthly_id, stripe_price_yearly_id,
  is_public, sort_order

subscriptions
  id, organization_id, plan_id, status ('trialing'|'active'|'past_due'|
  'canceled'|'incomplete'), billing_interval ('month'|'year'),
  stripe_customer_id, stripe_subscription_id,
  current_period_start, current_period_end, cancel_at_period_end,
  created_at, updated_at
  UNIQUE (organization_id) WHERE status IN ('trialing','active','past_due')

usage_counters            compteurs matérialisés, vérifiés côté serveur
  organization_id, metric ('active_products'|'storage_bytes'|'ai_extractions'),
  period_start, value, updated_at
  PRIMARY KEY (organization_id, metric, period_start)

payment_events            journal brut des webhooks Stripe (idempotence)
  id, provider, external_id UNIQUE, type, payload jsonb,
  processed_at, error, created_at
```

## 3.4 Fournisseurs et matières premières

```
suppliers
  id, organization_id, name, website, contact_email, notes,
  created_at, updated_at, deleted_at

raw_materials
  id, organization_id, supplier_id, name, internal_reference,
  category ('fragrance'|'wax'|'dye'|'additive'|'wick'|'other'),
  form ('liquid'|'solid'|'powder'|'other'),
  density_g_per_ml numeric(8,4),
  purchase_price_cents, purchase_quantity, purchase_unit,
  is_archived, notes, created_at, updated_at, deleted_at
  UNIQUE (organization_id, internal_reference) WHERE internal_reference IS NOT NULL
```

## 3.5 Documents fournisseurs, FDS et substances

```
documents                 tout fichier déposé ou généré
  id, organization_id, kind ('sds'|'ifra'|'allergen_declaration'|
  'technical_sheet'|'label'|'analysis_report'|'other'),
  storage_key, original_filename, mime_type, byte_size, sha256,
  uploaded_by, created_at, deleted_at
  UNIQUE (organization_id, sha256)   -- déduplication

safety_data_sheets        « la FDS de cette matière », entité stable
  id, organization_id, raw_material_id, supplier_id,
  commercial_name, created_at, updated_at, deleted_at

sds_versions              une révision datée — JAMAIS écrasée
  id, organization_id, safety_data_sheet_id, document_id,
  version_label, revision_date, language,
  status ('imported'|'extracting'|'needs_review'|'validated'|'archived'),
  extraction_engine, extraction_confidence numeric(4,3),
  extracted_payload jsonb,      -- brut, lecture automatique
  validated_payload jsonb,      -- après correction humaine, source de vérité
  validated_by, validated_at, archived_at,
  flash_point_celsius numeric(6,2), signal_word, hazard_pictograms text[],
  hazard_statements text[], euh_statements text[],
  precautionary_statements text[],
  created_at, updated_at
  UNIQUE (safety_data_sheet_id, version_label)

sds_extraction_runs       traçabilité de chaque tentative de lecture
  id, organization_id, sds_version_id, method ('pdf_text'|'ocr'|'ai_assisted'),
  model, prompt_hash, token_cost, duration_ms, succeeded,
  raw_output jsonb, error, created_at

substances                référentiel — partagé, non nominatif
  id, cas_number, ec_number, name_en, name_fr,
  is_reference boolean,         -- true = entrée référentielle Normelya
  source_ref, created_at, updated_at
  UNIQUE (cas_number) WHERE cas_number IS NOT NULL

sds_substances            composition déclarée dans une version de FDS
  id, organization_id, sds_version_id, substance_id,
  declared_name, cas_number, ec_number,
  concentration_min numeric(9,6), concentration_max numeric(9,6),
  concentration_exact numeric(9,6),
  classification jsonb,         -- [{hazard_class, category, h_statement}]
  specific_concentration_limits jsonb,
  m_factor_acute numeric, m_factor_chronic numeric,
  is_allergen boolean, source ('extracted'|'manual'|'corrected'),
  created_at, updated_at
```

**Pourquoi `extracted_payload` ET `validated_payload`** : la traçabilité exige de
pouvoir montrer ce que la machine a lu, ce que l'humain a corrigé, et qui a
validé. Seul `validated_payload` alimente le moteur.

## 3.6 Produits, versions et recettes

```
products
  id, organization_id, name, product_type ('candle'|'wax_melt'),
  net_weight_grams numeric(9,3), container_description,
  status ('draft'|'active'|'archived'),
  current_version_id, created_by, created_at, updated_at, deleted_at

product_versions          une version = une recette figée + ses marchés
  id, organization_id, product_id, version_number,
  name_snapshot, net_weight_grams, markets text[],  -- ex. {FR,CH}
  is_locked boolean,        -- true dès qu'une analyse s'y rattache
  created_by, created_at
  UNIQUE (product_id, version_number)

recipes
  id, organization_id, product_version_id, basis ('mass_percent'),
  total_percent numeric(9,6), notes, created_at
  CHECK (total_percent = 100)

recipe_ingredients
  id, organization_id, recipe_id, raw_material_id,
  sds_version_id,          -- version EXACTE utilisée, figée
  percent numeric(9,6) CHECK (percent > 0 AND percent <= 100),
  role ('wax'|'fragrance'|'dye'|'additive'|'other'),
  position int
  UNIQUE (recipe_id, raw_material_id)
```

## 3.7 Moteur réglementaire et résultats

```
regulatory_engine_versions
  id, code ('NORMELYA_EU_CLP_2026_01'), scope ('EU'|'FR'|'CH'),
  released_at, notes, rules_digest,   -- empreinte du jeu de règles
  is_active, created_at

regulatory_calculations   APPEND-ONLY — la demande et son empreinte
  id, organization_id, product_version_id, market ('FR'|'CH'),
  engine_version_code, input_payload jsonb,   -- entrée complète, figée
  input_digest text,                          -- sha256 de l'entrée normalisée
  requested_by, created_at

regulatory_results        APPEND-ONLY — la réponse
  id, organization_id, calculation_id,
  overall_status ('completed'|'needs_verification'|'action_required'|
  'not_applicable'),
  signal_word, pictograms text[], hazard_statements jsonb,
  euh_statements jsonb, precautionary_statements jsonb,
  classifications jsonb,
  ufi_required ('yes'|'no'|'verification_required'),
  review_flags jsonb,      -- liste des REGULATORY_REVIEW_REQUIRED
  explanation_trace jsonb, -- pour chaque sortie : règle + source appliquées
  computed_at, duration_ms
  UNIQUE (calculation_id)
```

`input_digest` permet de détecter qu'une recette identique a déjà été calculée
avec la même version de moteur — donc de servir un résultat sans recalcul, et de
prouver le déterminisme en test.

## 3.8 UFI, étiquettes, documents générés

```
ufi_records
  id, organization_id, product_id, ufi_code, formulation_number,
  vat_or_company_key, source ('user_provided'|'generated'),
  declared_to_authority boolean, declaration_reference, declared_at,
  notes, created_at, updated_at

labels
  id, organization_id, product_version_id, regulatory_result_id,
  format ('50x50'|'60x40'|'70x50'|'custom'), width_mm, height_mm,
  layout jsonb, supplier_block jsonb, extra_text,
  overflow boolean,        -- contenu obligatoire ne tenant pas
  created_by, created_at, updated_at

generated_documents       APPEND-ONLY
  id, organization_id, document_id, type ('label_pdf'|'label_png'|
  'analysis_report'|'product_dossier'|'data_export'),
  product_version_id, regulatory_result_id, label_id,
  engine_version_code, source_document_ids uuid[],
  generated_by, generated_at
```

## 3.9 Alertes, audit, coûts, lots

```
notifications             centre de conformité
  id, organization_id, type ('sds_new_version'|'product_uses_old_sds'|
  'missing_information'|'reanalysis_needed'|'document_to_check'|'system'),
  severity ('info'|'warning'|'action'), title, body,
  product_id, raw_material_id, sds_version_id,
  read_at, resolved_at, created_at

audit_logs                APPEND-ONLY
  id, organization_id, actor_user_id, actor_type ('user'|'system'|'admin'),
  action, entity_type, entity_id, before jsonb, after jsonb,
  ip_hash, user_agent_hash, created_at

cost_items                coût de revient (hors moteur réglementaire)
  id, organization_id, product_version_id,
  category ('material'|'container'|'packaging'|'wick'|'label'|'other'),
  label, raw_material_id, quantity numeric(12,4), unit,
  unit_cost_cents, total_cost_cents, created_at, updated_at

product_pricing
  id, organization_id, product_version_id, selling_price_cents,
  vat_rate numeric(5,2), margin_cents, margin_percent, updated_at

lots                      V2
  id, organization_id, product_version_id, lot_code, produced_on,
  quantity, notes, created_by, created_at
  UNIQUE (organization_id, lot_code)

lot_materials             V2
  id, organization_id, lot_id, raw_material_id, sds_version_id,
  supplier_lot_code, quantity, unit
```

## 3.10 Améliorations apportées au schéma initial

| Ajout | Raison |
|-------|--------|
| `product_versions` + `is_locked` | Une analyse doit pointer une recette figée, pas une recette modifiable |
| `sds_extraction_runs` | Mesurer le coût et la qualité de l'extraction, déboguer sans relancer l'IA |
| `extracted_payload` / `validated_payload` séparés | Prouver la validation humaine |
| `input_digest` sur les calculs | Cache légitime + preuve de déterminisme |
| `regulatory_engine_versions.rules_digest` | Détecter une modification de règle non versionnée |
| `usage_counters` | Faire respecter les quotas sans `COUNT(*)` à chaque écriture |
| `payment_events` | Idempotence des webhooks Stripe |
| `documents.sha256` unique par organisation | Éviter les doublons de PDF |
| `plans` en table | Changer un tarif sans déployer |
| `review_flags` et `explanation_trace` sur les résultats | Aucun résultat sans justification traçable |

## 3.11 Row Level Security

Modèle unique appliqué à toutes les tables client :

```sql
CREATE FUNCTION app.current_user_id() RETURNS uuid ...   -- GUC ou claim JWT
CREATE FUNCTION app.is_member_of(org uuid) RETURNS boolean ...

ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table> FORCE ROW LEVEL SECURITY;

CREATE POLICY <table>_select ON <table> FOR SELECT
  USING (app.is_member_of(organization_id));
CREATE POLICY <table>_write ON <table> FOR INSERT
  WITH CHECK (app.is_member_of(organization_id));
-- UPDATE / DELETE : idem, sauf tables append-only qui n'ont aucune politique
-- UPDATE/DELETE (donc tout est refusé, y compris au propriétaire).
```

Deux rôles, une seule différence qui compte :

| Rôle | `BYPASSRLS` | Sert |
|------|-------------|------|
| `normelya_app` | **non** | Toutes les requêtes déclenchées par un utilisateur |
| `normelya_service` | oui | Création de compte, journal d'audit, webhooks de paiement |

Le rôle de service contourne les politiques parce qu'il écrit dans des tables
qui n'appartiennent à aucune organisation : créer un utilisateur avant qu'il
ait un atelier en est l'exemple type, et aucune politique fondée sur
l'appartenance ne peut l'autoriser.

En contrepartie, le code qui l'emploie est limité à ces cas d'usage et
n'accepte jamais d'identifiant d'organisation venu du client. Tout ce qui
touche aux données d'un atelier passe par `normelya_app`, qui subit les
politiques sans exception possible.

Aucun des deux n'est propriétaire des tables.

Les tests d'isolation (deux organisations, une requête croisée attendue vide)
font partie de la suite obligatoire.

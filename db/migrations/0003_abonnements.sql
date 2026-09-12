-- =============================================================================
-- 0003 — Offres, abonnements, compteurs d'usage, journal des paiements
--
-- Les limites d'offre sont vérifiées côté serveur avant toute écriture. Cette
-- table les rend modifiables sans déploiement ; packages/core en conserve un
-- repli de référence utilisé par les tests.
-- =============================================================================

CREATE TYPE plan_code AS ENUM ('free', 'essential', 'pro', 'atelier');
CREATE TYPE billing_interval AS ENUM ('month', 'year');
CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'incomplete'
);
CREATE TYPE usage_metric AS ENUM (
  'active_products', 'members', 'storage_bytes', 'ai_extractions'
);

CREATE TABLE plans (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                      plan_code NOT NULL UNIQUE,
  name                      text NOT NULL,
  tagline                   text,
  price_monthly_cents       integer NOT NULL CHECK (price_monthly_cents >= 0),
  price_yearly_cents        integer NOT NULL CHECK (price_yearly_cents >= 0),
  currency                  text NOT NULL DEFAULT 'EUR',
  max_active_products       integer CHECK (max_active_products IS NULL OR max_active_products > 0),
  max_members               integer NOT NULL CHECK (max_members > 0),
  max_storage_mb            integer NOT NULL CHECK (max_storage_mb > 0),
  monthly_ai_extractions    integer NOT NULL CHECK (monthly_ai_extractions >= 0),
  features                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  stripe_price_monthly_id   text,
  stripe_price_yearly_id    text,
  is_public                 boolean NOT NULL DEFAULT true,
  sort_order                integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN plans.max_active_products IS 'NULL signifie illimité.';

CREATE TRIGGER plans_set_updated_at
  BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

CREATE TABLE subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id                 uuid NOT NULL REFERENCES plans(id),
  status                  subscription_status NOT NULL DEFAULT 'active',
  billing_interval        billing_interval NOT NULL DEFAULT 'month',
  stripe_customer_id      text,
  stripe_subscription_id  text,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Une organisation ne peut avoir qu'un seul abonnement en cours.
CREATE UNIQUE INDEX subscriptions_active_unique_idx
  ON subscriptions (organization_id)
  WHERE status IN ('trialing', 'active', 'past_due');

CREATE UNIQUE INDEX subscriptions_stripe_idx
  ON subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- usage_counters
--
-- Compteurs matérialisés : vérifier un quota ne doit pas coûter un COUNT(*) sur
-- toute la base à chaque écriture. period_start vaut le premier jour du mois
-- pour les métriques périodiques, et 'epoch' pour les métriques cumulatives.
-- -----------------------------------------------------------------------------
CREATE TABLE usage_counters (
  organization_id   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric            usage_metric NOT NULL,
  period_start      date NOT NULL DEFAULT DATE '1970-01-01',
  value             bigint NOT NULL DEFAULT 0 CHECK (value >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, metric, period_start)
);

CREATE TRIGGER usage_counters_set_updated_at
  BEFORE UPDATE ON usage_counters FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- -----------------------------------------------------------------------------
-- payment_events
--
-- Journal brut des webhooks du prestataire de paiement. La contrainte d'unicité
-- sur external_id assure l'idempotence : un webhook rejoué n'est traité qu'une
-- fois. Table hors RLS client : seul le rôle de service y accède.
-- -----------------------------------------------------------------------------
CREATE TABLE payment_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      text NOT NULL DEFAULT 'stripe',
  external_id   text NOT NULL,
  type          text NOT NULL,
  payload       jsonb NOT NULL,
  processed_at  timestamptz,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_events_external_unique UNIQUE (provider, external_id)
);

-- =============================================================================
-- Row Level Security
-- =============================================================================

-- Les offres publiques sont lisibles par tous : elles alimentent la page tarifs.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans FORCE ROW LEVEL SECURITY;
CREATE POLICY plans_select ON plans FOR SELECT USING (is_public);

-- Un abonnement est lisible par les membres, jamais modifiable depuis le client :
-- seul le traitement des webhooks, exécuté avec le rôle de service, l'écrit.
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select ON subscriptions FOR SELECT
  USING (app.is_member_of(organization_id));

ALTER TABLE usage_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_counters FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_counters_select ON usage_counters FOR SELECT
  USING (app.is_member_of(organization_id));

ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;
-- Aucune politique : aucune ligne n'est accessible au rôle applicatif.

-- =============================================================================
-- Référentiel initial des offres
--
-- Données commerciales, alignées sur packages/core/src/plans.ts.
-- Aucune constante réglementaire ici.
-- =============================================================================
INSERT INTO plans (
  code, name, tagline, price_monthly_cents, price_yearly_cents,
  max_active_products, max_members, max_storage_mb, monthly_ai_extractions,
  features, sort_order
) VALUES
  ('free', 'Gratuit', 'Pour tester réellement Normelya.', 0, 0,
   3, 1, 100, 5,
   '["sds_import","regulatory_analysis","labels","history"]'::jsonb, 1),
  ('essential', 'Essentiel', 'Pour une petite gamme de produits.', 990, 9900,
   10, 1, 500, 25,
   '["sds_import","regulatory_analysis","labels","history"]'::jsonb, 2),
  ('pro', 'Pro', 'Pour une marque qui se développe.', 1990, 19900,
   NULL, 2, 2000, 100,
   '["sds_import","regulatory_analysis","labels","history","ufi","document_archive","exports","assistant"]'::jsonb, 3),
  ('atelier', 'Atelier', 'Pour un atelier qui produit en lots.', 2990, 29900,
   NULL, 5, 10000, 250,
   '["sds_import","regulatory_analysis","labels","history","ufi","document_archive","exports","assistant","lots","costing","multi_user"]'::jsonb, 4);

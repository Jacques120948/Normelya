-- =============================================================================
-- Jeu de démonstration
--
-- Toutes les données créées ici sont préfixées DEMO et marquées is_demo = true.
-- Elles servent uniquement au développement et à la recette.
--
-- Elles n'alimentent JAMAIS le moteur réglementaire : aucune fiche de données de
-- sécurité fictive n'est créée, et aucune composition n'est inventée. Un calcul
-- réglementaire sur une donnée fabriquée n'aurait aucune valeur et créerait
-- exactement le genre de fausse certitude que Normelya refuse.
--
-- Usage :
--   psql "$DATABASE_URL" -v user_id="'<uuid>'" -f db/seeds/demo.sql
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

INSERT INTO organizations (name, country, activity, city, postal_code, address_line1,
                           contact_email, onboarding_completed_at, is_demo)
VALUES ('DEMO Atelier des Lumières', 'FR', 'both', 'Lyon', '69003',
        '12 rue des Artisans', 'demo@normelya.test', now(), true)
RETURNING id \gset atelier_

INSERT INTO organization_members (organization_id, user_id, role)
VALUES (:'atelier_id', :user_id, 'owner');

INSERT INTO subscriptions (organization_id, plan_id, status, billing_interval)
SELECT :'atelier_id', p.id, 'active', 'month' FROM plans p WHERE p.code = 'free';

INSERT INTO suppliers (organization_id, name, website)
VALUES (:'atelier_id', 'DEMO Cirerie du Sud', 'https://exemple.test'),
       (:'atelier_id', 'DEMO Maison des Parfums', 'https://exemple.test');

INSERT INTO raw_materials (organization_id, supplier_id, name, category,
                           internal_reference, purchase_price_cents, purchase_quantity,
                           purchase_unit, is_demo)
SELECT :'atelier_id', s.id, 'DEMO Cire de soja', 'wax', 'DEMO-CIRE-01', 1890, 1000, 'g', true
FROM suppliers s WHERE s.organization_id = :'atelier_id' AND s.name = 'DEMO Cirerie du Sud';

INSERT INTO raw_materials (organization_id, supplier_id, name, category,
                           internal_reference, purchase_price_cents, purchase_quantity,
                           purchase_unit, is_demo)
SELECT :'atelier_id', s.id, 'DEMO Parfum Fleur de coton', 'fragrance', 'DEMO-PARF-01',
       2490, 500, 'ml', true
FROM suppliers s WHERE s.organization_id = :'atelier_id' AND s.name = 'DEMO Maison des Parfums';

INSERT INTO raw_materials (organization_id, name, category, is_demo)
VALUES (:'atelier_id', 'DEMO Mèche coton 18 mm', 'wick', true),
       (:'atelier_id', 'DEMO Colorant ivoire', 'dye', true);

INSERT INTO notifications (organization_id, type, severity, title, body)
VALUES (:'atelier_id', 'missing_information', 'warning',
        'DEMO — Fiche de données de sécurité manquante',
        'Aucune fiche n''est rattachée à « DEMO Parfum Fleur de coton ». '
        'Aucune analyse ne pourra être produite tant qu''elle manque.');

COMMIT;

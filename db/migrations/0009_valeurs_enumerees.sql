-- =============================================================================
-- 0009 — Nouvelles valeurs d'énumération
--
-- PostgreSQL refuse d'utiliser une valeur d'énumération dans la transaction qui
-- l'ajoute. Ces ajouts sont donc isolés ici, et exploités par la migration
-- suivante.
-- =============================================================================

-- Produits créés depuis l'ouverture du compte : métrique cumulative, jamais
-- décomptée. Sert au quota non renouvelable de l'offre gratuite.
ALTER TYPE usage_metric ADD VALUE IF NOT EXISTS 'lifetime_products';

-- Normelya génère deux documents par produit : l'étiquette et la fiche de
-- données de sécurité du produit dilué.
ALTER TYPE document_kind ADD VALUE IF NOT EXISTS 'product_sds';
ALTER TYPE generated_document_type ADD VALUE IF NOT EXISTS 'product_sds_pdf';

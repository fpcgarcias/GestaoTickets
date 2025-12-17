-- Migration 081: Mover flags do tipo para categoria
-- Data: 2025-11-16
-- Descrição: Centraliza regras de estoque em product_categories

-- ========================================
-- ADICIONAR COLUNAS EM product_categories
-- ========================================

ALTER TABLE product_categories
ADD COLUMN IF NOT EXISTS is_consumable BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_serial BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_asset_tag BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS min_stock_alert INTEGER,
ADD COLUMN IF NOT EXISTS custom_fields TEXT NOT NULL DEFAULT '{}';

COMMENT ON COLUMN product_categories.is_consumable IS 'Define se a categoria é consumível (controle por quantidade)';
COMMENT ON COLUMN product_categories.requires_serial IS 'Se itens da categoria exigem número de série';
COMMENT ON COLUMN product_categories.requires_asset_tag IS 'Se itens da categoria exigem patrimônio';
COMMENT ON COLUMN product_categories.min_stock_alert IS 'Estoque mínimo para alertas';
COMMENT ON COLUMN product_categories.custom_fields IS 'Campos customizáveis padrão da categoria (JSON serializado)';

-- ========================================
-- REMOVER COLUNAS DE product_types
-- ========================================

ALTER TABLE product_types
DROP COLUMN IF EXISTS is_consumable,
DROP COLUMN IF EXISTS requires_serial,
DROP COLUMN IF EXISTS requires_asset_tag,
DROP COLUMN IF EXISTS min_stock_alert,
DROP COLUMN IF EXISTS custom_fields;



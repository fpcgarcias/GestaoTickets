-- Migração 062: Remover campo "value" desnecessário da tabela categories
-- Data: 2025-01-31
-- Descrição: Remove campo "value" redundante - vínculos devem ser sempre por ID

-- Remover campo value da tabela categories
ALTER TABLE categories DROP COLUMN IF EXISTS value;

-- Remover índice do campo value se existir
DROP INDEX IF EXISTS idx_categories_value; 
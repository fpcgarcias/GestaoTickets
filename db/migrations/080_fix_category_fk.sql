-- Migration 080: Corrigir Vínculo de Categorias
-- Data: 2025-11-16
-- Descrição: Substituir TEXT por FK numérica entre product_types e product_categories

-- ========================================
-- GARANTIR UMA CATEGORIA PADRÃO (GLOBAL)
-- ========================================
INSERT INTO product_categories (name, code, color, is_active, created_at, updated_at)
SELECT 'Geral', 'general', '#6B7280', true, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM product_categories WHERE code = 'general');

-- ========================================
-- ADICIONAR COLUNA category_id (FK) COMO NULLABLE
-- ========================================
ALTER TABLE product_types 
ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES product_categories(id) ON DELETE RESTRICT;

-- ========================================
-- POPULAR category_id PARA REGISTROS EXISTENTES
-- ========================================
UPDATE product_types
SET category_id = (
  SELECT id FROM product_categories WHERE code = 'general' LIMIT 1
)
WHERE category_id IS NULL;

-- ========================================
-- TORNAR NOT NULL APÓS POPULAR
-- ========================================
ALTER TABLE product_types 
ALTER COLUMN category_id SET NOT NULL;

-- ========================================
-- CRIAR ÍNDICE
-- ========================================
CREATE INDEX IF NOT EXISTS idx_product_types_category 
ON product_types(category_id);

COMMENT ON COLUMN product_types.category_id IS 'FK para product_categories.id - vínculo por ID numérico';

-- ========================================
-- REMOVER CAMPO ANTIGO category (TEXT) SE EXISTIR
-- ========================================
ALTER TABLE product_types 
DROP COLUMN IF EXISTS category;

-- ========================================
-- OBSERVAÇÃO
-- ========================================
-- Agora o vínculo é CORRETO:
-- product_types.category_id → product_categories.id (FK numérica)
-- 
-- Benefícios:
-- ✅ Integridade referencial
-- ✅ Performance (join por INT)
-- ✅ Não quebra se mudar código/nome da categoria
-- ✅ Validação automática pelo banco


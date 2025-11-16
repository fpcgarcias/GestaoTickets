-- Migration 079: Adicionar Departamento às Categorias
-- Data: 2025-11-16
-- Descrição: Vincula categorias de produtos aos departamentos, permitindo isolamento total

-- ========================================
-- ADICIONAR COLUNA department_id
-- ========================================

-- Adicionar coluna department_id em product_categories
ALTER TABLE product_categories 
ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE;

-- Criar índice para busca rápida por departamento
CREATE INDEX IF NOT EXISTS idx_product_categories_department 
ON product_categories(department_id, is_active) 
WHERE department_id IS NOT NULL AND is_active = true;

-- Criar índice para categorias globais (sem departamento)
CREATE INDEX IF NOT EXISTS idx_product_categories_global 
ON product_categories(company_id, is_active) 
WHERE department_id IS NULL AND is_active = true;

COMMENT ON COLUMN product_categories.department_id IS 'Departamento ao qual a categoria pertence. NULL = categoria global da empresa';

-- ========================================
-- NOTA IMPORTANTE
-- ========================================
-- As categorias inseridas na migration anterior (078) ficarão como globais (department_id = NULL)
-- O admin/company_admin pode criar categorias globais ou específicas de departamento
-- Usuários de departamentos específicos só verão:
--   1. Categorias do seu departamento (department_id = X)
--   2. Categorias globais da empresa (department_id = NULL)


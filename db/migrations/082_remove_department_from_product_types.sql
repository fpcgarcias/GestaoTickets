-- Migration 082: Remover department_id de product_types
-- Data: 2025-11-16
-- Descrição: Departamento passa a ser controlado na categoria

-- Remover índice se existir (forma simples, sem DO $$)
DROP INDEX IF EXISTS idx_product_types_department;

-- Remover coluna department_id
ALTER TABLE product_types
DROP COLUMN IF EXISTS department_id;



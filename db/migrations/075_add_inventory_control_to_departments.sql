-- Migration 075: Adicionar Flag de Controle de Estoque em Departamentos
-- Data: 2025-11-14
-- Descrição: Adiciona coluna use_inventory_control para habilitar/desabilitar controle de estoque por departamento

-- ========================================
-- 1. ADICIONAR COLUNA use_inventory_control
-- ========================================

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS use_inventory_control BOOLEAN NOT NULL DEFAULT false;

-- ========================================
-- 2. ADICIONAR ÍNDICE PARA PERFORMANCE
-- ========================================

CREATE INDEX IF NOT EXISTS idx_departments_inventory_control
ON departments(company_id, use_inventory_control)
WHERE use_inventory_control = true AND is_active = true;

-- ========================================
-- 3. COMENTÁRIO PARA DOCUMENTAÇÃO
-- ========================================

COMMENT ON COLUMN departments.use_inventory_control IS 'Flag para habilitar/desabilitar controle de estoque neste departamento';

-- ========================================
-- FIM DA MIGRATION 075
-- ========================================


-- Migration 087: Adicionar campo logo_base64 para logotipo da empresa
-- Data: 2025-01-XX
-- Descrição: Adiciona campo para armazenar o logotipo da empresa em base64 usado nos termos de responsabilidade

-- ========================================
-- 1. ADICIONAR COLUNA logo_base64
-- ========================================

ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS logo_base64 TEXT;

-- ========================================
-- 2. COMENTÁRIOS
-- ========================================

COMMENT ON COLUMN companies.logo_base64 IS 'Logotipo da empresa em base64 usado nos termos de responsabilidade';


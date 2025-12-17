-- Migration 085: Adicionar campos CPF em users e city em companies
-- Data: 2025-01-XX
-- Descrição: Adiciona campos necessários para termos de responsabilidade

-- ========================================
-- 1. ADICIONAR CAMPO CPF EM USERS
-- ========================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Índice para busca por CPF (opcional, mas útil)
CREATE INDEX IF NOT EXISTS idx_users_cpf 
ON users(cpf) 
WHERE cpf IS NOT NULL;

COMMENT ON COLUMN users.cpf IS 'CPF do usuário (formato: 000.000.000-00 ou apenas números)';

-- ========================================
-- 2. ADICIONAR CAMPO CITY EM COMPANIES
-- ========================================

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS city TEXT;

COMMENT ON COLUMN companies.city IS 'Cidade da empresa (usado em termos de responsabilidade)';




-- Migration: AI Global Permissions
-- Add ai_permission to companies table and make ai_configurations global

-- Adicionar coluna ai_permission na tabela companies (default true)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS ai_permission boolean NOT NULL DEFAULT true;

-- Remover a constraint de foreign key company_id da tabela ai_configurations se existir
ALTER TABLE ai_configurations DROP CONSTRAINT IF EXISTS ai_configurations_company_id_fkey;

-- Remover coluna company_id da tabela ai_configurations (tornar configuração global)
ALTER TABLE ai_configurations DROP COLUMN IF EXISTS company_id;

-- Comentários para documentação
COMMENT ON COLUMN companies.ai_permission IS 'Permite que a empresa use funcionalidades de IA (habilitada pelo admin)';
COMMENT ON TABLE ai_configurations IS 'Configurações globais de IA (aplicadas a todas as empresas que têm permissão)'; 
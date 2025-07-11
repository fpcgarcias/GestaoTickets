-- Migração 063: Adicionar company_id à tabela ai_configurations
-- Esta migração adiciona a coluna company_id à tabela ai_configurations
-- e popula os dados existentes com base no department_id

BEGIN;

-- Adicionar coluna company_id à tabela ai_configurations
ALTER TABLE ai_configurations 
ADD COLUMN company_id INTEGER;

-- Atualizar registros existentes: buscar company_id através do department_id
UPDATE ai_configurations
SET company_id = (
    SELECT d.company_id
    FROM departments d
    WHERE d.id = ai_configurations.department_id
)
WHERE department_id IS NOT NULL;

-- Para configurações globais (department_id NULL), vamos deixar company_id NULL também
-- Isso permitirá configurações globais que funcionem para todas as empresas

-- Adicionar foreign key constraint para company_id
ALTER TABLE ai_configurations 
ADD CONSTRAINT fk_ai_configurations_company_id 
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Adicionar índice para melhorar performance nas consultas
CREATE INDEX idx_ai_configurations_company_id ON ai_configurations(company_id);
CREATE INDEX idx_ai_configurations_company_dept ON ai_configurations(company_id, department_id);

-- Comentários para documentação
COMMENT ON COLUMN ai_configurations.company_id IS 'ID da empresa. NULL para configurações globais';

COMMIT; 
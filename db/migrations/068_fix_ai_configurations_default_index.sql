-- Migration 068: Corrigir índice único de configurações padrão de IA
-- Permite uma configuração padrão por departamento E tipo de análise

-- Remover o índice antigo que não considera analysis_type
DROP INDEX IF EXISTS idx_ai_configurations_unique_default_per_dept;

-- Criar novo índice que considera department_id, analysis_type e is_default
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_configurations_unique_default_per_dept_analysis 
ON ai_configurations (COALESCE(department_id, 0), analysis_type, is_default) 
WHERE is_default = true;

-- Comentários para documentação
COMMENT ON INDEX idx_ai_configurations_unique_default_per_dept_analysis IS 'Permite uma configuração padrão por departamento e tipo de análise (priority/reopen)'; 
-- Adiciona o campo analysis_type (NULLABLE inicialmente)
ALTER TABLE ai_configurations
  ADD COLUMN analysis_type VARCHAR(32);

ALTER TABLE ai_analysis_history
  ADD COLUMN analysis_type VARCHAR(32);

-- Atualiza registros existentes para 'priority'
UPDATE ai_configurations SET analysis_type = 'priority' WHERE analysis_type IS NULL;
UPDATE ai_analysis_history SET analysis_type = 'priority' WHERE analysis_type IS NULL;

-- Torna o campo NOT NULL após atualização
ALTER TABLE ai_configurations
  ALTER COLUMN analysis_type SET NOT NULL;

ALTER TABLE ai_analysis_history
  ALTER COLUMN analysis_type SET NOT NULL;

-- Cria índice composto para garantir unicidade por empresa, departamento, analysis_type e is_active
CREATE UNIQUE INDEX idx_ai_configurations_unique
  ON ai_configurations (company_id, department_id, analysis_type, is_active); 
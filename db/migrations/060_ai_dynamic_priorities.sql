-- Migration 060: Prioridades Dinâmicas para IA
-- Atualiza o campo suggested_priority para aceitar prioridades dinâmicas em português

-- Alterar o campo suggested_priority para aceitar qualquer texto (prioridades dinâmicas)
ALTER TABLE ai_analysis_history 
ALTER COLUMN suggested_priority TYPE TEXT;

-- Comentário para documentação
COMMENT ON COLUMN ai_analysis_history.suggested_priority IS 'Prioridade sugerida pela IA - agora aceita prioridades dinâmicas por departamento em português (ex: BAIXA, MÉDIA, ALTA, CRÍTICA, IMEDIATA)';

-- Atualizar prioridades existentes de inglês para português (opcional - manter dados existentes)
UPDATE ai_analysis_history SET 
  suggested_priority = CASE 
    WHEN suggested_priority = 'low' THEN 'BAIXA'
    WHEN suggested_priority = 'medium' THEN 'MÉDIA' 
    WHEN suggested_priority = 'high' THEN 'ALTA'
    WHEN suggested_priority = 'critical' THEN 'CRÍTICA'
    ELSE suggested_priority -- Manter outros valores
  END
WHERE suggested_priority IN ('low', 'medium', 'high', 'critical'); 
-- Migration: AI Suggestions System
-- Created: 2025-01-03
-- Description: Tabelas para sistema de sugestões de IA para tickets

-- Tabela para armazenar sugestões de IA geradas
CREATE TABLE ai_suggestions (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  
  -- Dados da análise
  similar_tickets_count INTEGER NOT NULL DEFAULT 0,
  success_rate DECIMAL(5,2) DEFAULT 0.00, -- % de resolução dos tickets similares
  confidence_score DECIMAL(5,2) DEFAULT 0.00, -- 0-100% confiança da IA
  
  -- Tipo de sugestão
  suggestion_type VARCHAR(50) NOT NULL DEFAULT 'similar_cases', -- 'similar_cases', 'step_by_step', 'hybrid'
  
  -- Dados da IA
  prompt_used TEXT, -- Prompt completo enviado para IA
  ai_response TEXT, -- Resposta completa da IA
  structured_suggestion JSONB, -- Dados estruturados da sugestão
  
  -- Feedback do usuário
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment TEXT,
  
  -- Metadados
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Tabela para logs de auditoria das sugestões
CREATE TABLE ai_suggestion_logs (
  id SERIAL PRIMARY KEY,
  suggestion_id INTEGER NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- 'requested', 'generated', 'viewed', 'rated', 'dismissed'
  details JSONB, -- Detalhes adicionais da ação
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Índices para performance
CREATE INDEX idx_ai_suggestions_ticket_id ON ai_suggestions(ticket_id);
CREATE INDEX idx_ai_suggestions_user_id ON ai_suggestions(user_id);
CREATE INDEX idx_ai_suggestions_department_id ON ai_suggestions(department_id);
CREATE INDEX idx_ai_suggestions_created_at ON ai_suggestions(created_at);
CREATE INDEX idx_ai_suggestion_logs_suggestion_id ON ai_suggestion_logs(suggestion_id);
CREATE INDEX idx_ai_suggestion_logs_action ON ai_suggestion_logs(action);

-- Comentários para documentação
COMMENT ON TABLE ai_suggestions IS 'Armazena sugestões de IA geradas para resolução de tickets';
COMMENT ON TABLE ai_suggestion_logs IS 'Log de auditoria para ações relacionadas às sugestões de IA';

COMMENT ON COLUMN ai_suggestions.similar_tickets_count IS 'Quantidade de tickets similares encontrados';
COMMENT ON COLUMN ai_suggestions.success_rate IS 'Taxa de sucesso dos tickets similares (0-100%)';
COMMENT ON COLUMN ai_suggestions.confidence_score IS 'Nível de confiança da IA na sugestão (0-100%)';
COMMENT ON COLUMN ai_suggestions.suggestion_type IS 'Tipo de sugestão: similar_cases, step_by_step, hybrid';
COMMENT ON COLUMN ai_suggestions.structured_suggestion IS 'Dados estruturados da sugestão (JSON)';
COMMENT ON COLUMN ai_suggestions.feedback_rating IS 'Avaliação do usuário (1-5 estrelas)';

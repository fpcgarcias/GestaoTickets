-- Migration: Add Satisfaction Surveys System
-- Adiciona sistema de pesquisas de satisfação com suporte multi-empresa

-- 1. Adicionar novo tipo ao enum email_template_type
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'satisfaction_survey';

-- 2. Criar tabela satisfaction_surveys
CREATE TABLE IF NOT EXISTS satisfaction_surveys (
  id SERIAL PRIMARY KEY,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  survey_token TEXT NOT NULL UNIQUE,
  sent_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMP WITHOUT TIME ZONE NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'responded', 'expired')) NOT NULL,
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_company_id ON satisfaction_surveys(company_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_token ON satisfaction_surveys(survey_token);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_status ON satisfaction_surveys(status);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_responded_at ON satisfaction_surveys(responded_at);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_ticket_id ON satisfaction_surveys(ticket_id);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_company_status ON satisfaction_surveys(company_id, status);
CREATE INDEX IF NOT EXISTS idx_satisfaction_surveys_expires_at ON satisfaction_surveys(expires_at);

-- 4. Comentários para documentação
COMMENT ON TABLE satisfaction_surveys IS 'Pesquisas de satisfação enviadas aos clientes após resolução de tickets';
COMMENT ON COLUMN satisfaction_surveys.survey_token IS 'Token único para acesso seguro à pesquisa (UUID)';
COMMENT ON COLUMN satisfaction_surveys.rating IS 'Avaliação do cliente de 1 a 5 estrelas';
COMMENT ON COLUMN satisfaction_surveys.status IS 'Status da pesquisa: sent (enviada), responded (respondida), expired (expirada)';
COMMENT ON COLUMN satisfaction_surveys.expires_at IS 'Data de expiração da pesquisa (7 dias após envio)';

-- 5. Adicionar campo satisfaction_survey_enabled na tabela departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS satisfaction_survey_enabled BOOLEAN DEFAULT false NOT NULL;

-- 6. Adicionar comentário para documentação
COMMENT ON COLUMN departments.satisfaction_survey_enabled IS 'Habilita pesquisa de satisfação para tickets deste departamento';

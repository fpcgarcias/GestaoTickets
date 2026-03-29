-- Adiciona suporte a atendente padrão por departamento
ALTER TABLE departments
  ADD COLUMN default_agent_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN default_agent_id INTEGER DEFAULT NULL
    REFERENCES officials(id) ON DELETE SET NULL;

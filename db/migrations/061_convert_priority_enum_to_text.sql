-- Migration: Converter campos de prioridade de ENUM para TEXT
-- Permite prioridades dinâmicas em português por departamento

-- 1. Adicionar colunas temporárias TEXT
ALTER TABLE tickets ADD COLUMN priority_temp TEXT;
ALTER TABLE ticket_status_history ADD COLUMN old_priority_temp TEXT;
ALTER TABLE ticket_status_history ADD COLUMN new_priority_temp TEXT;
ALTER TABLE sla_definitions ADD COLUMN priority_temp TEXT;
ALTER TABLE ai_configurations ADD COLUMN fallback_priority_temp TEXT;

-- 2. Migrar dados existentes: INGLÊS → PORTUGUÊS
UPDATE tickets SET priority_temp = CASE 
  WHEN priority = 'low' THEN 'BAIXA'
  WHEN priority = 'medium' THEN 'MÉDIA' 
  WHEN priority = 'high' THEN 'ALTA'
  WHEN priority = 'critical' THEN 'CRÍTICA'
  ELSE 'MÉDIA'
END;

UPDATE ticket_status_history SET old_priority_temp = CASE 
  WHEN old_priority = 'low' THEN 'BAIXA'
  WHEN old_priority = 'medium' THEN 'MÉDIA'
  WHEN old_priority = 'high' THEN 'ALTA'
  WHEN old_priority = 'critical' THEN 'CRÍTICA'
  ELSE NULL
END;

UPDATE ticket_status_history SET new_priority_temp = CASE 
  WHEN new_priority = 'low' THEN 'BAIXA'
  WHEN new_priority = 'medium' THEN 'MÉDIA'
  WHEN new_priority = 'high' THEN 'ALTA'
  WHEN new_priority = 'critical' THEN 'CRÍTICA'
  ELSE NULL
END;

UPDATE sla_definitions SET priority_temp = CASE 
  WHEN priority = 'low' THEN 'BAIXA'
  WHEN priority = 'medium' THEN 'MÉDIA'
  WHEN priority = 'high' THEN 'ALTA'
  WHEN priority = 'critical' THEN 'CRÍTICA'
  ELSE 'MÉDIA'
END;

UPDATE ai_configurations SET fallback_priority_temp = CASE 
  WHEN fallback_priority = 'low' THEN 'BAIXA'
  WHEN fallback_priority = 'medium' THEN 'MÉDIA'
  WHEN fallback_priority = 'high' THEN 'ALTA'
  WHEN fallback_priority = 'critical' THEN 'CRÍTICA'
  ELSE 'MÉDIA'
END;

-- 3. Remover colunas ENUM antigas
ALTER TABLE tickets DROP COLUMN priority;
ALTER TABLE ticket_status_history DROP COLUMN old_priority;
ALTER TABLE ticket_status_history DROP COLUMN new_priority;
ALTER TABLE sla_definitions DROP COLUMN priority;
ALTER TABLE ai_configurations DROP COLUMN fallback_priority;

-- 4. Renomear colunas temporárias
ALTER TABLE tickets RENAME COLUMN priority_temp TO priority;
ALTER TABLE ticket_status_history RENAME COLUMN old_priority_temp TO old_priority;
ALTER TABLE ticket_status_history RENAME COLUMN new_priority_temp TO new_priority;
ALTER TABLE sla_definitions RENAME COLUMN priority_temp TO priority;
ALTER TABLE ai_configurations RENAME COLUMN fallback_priority_temp TO fallback_priority;

-- 5. Adicionar NOT NULL onde necessário
ALTER TABLE tickets ALTER COLUMN priority SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN priority SET DEFAULT 'MÉDIA';
ALTER TABLE sla_definitions ALTER COLUMN priority SET NOT NULL;
ALTER TABLE ai_configurations ALTER COLUMN fallback_priority SET DEFAULT 'MÉDIA';

-- 6. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_sla_definitions_priority ON sla_definitions(priority);

-- 7. Remover o tipo ENUM (se não usado em outro lugar)
-- DROP TYPE IF EXISTS ticket_priority;

COMMENT ON COLUMN tickets.priority IS 'Prioridade do ticket - aceita valores dinâmicos por departamento';
COMMENT ON COLUMN sla_definitions.priority IS 'Prioridade SLA - aceita valores dinâmicos por departamento';
COMMENT ON COLUMN ai_configurations.fallback_priority IS 'Prioridade fallback da IA - aceita valores dinâmicos'; 
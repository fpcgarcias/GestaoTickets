-- Migration 057: Fase 3.1 - Índices de Performance para SLA Configurations
-- Adiciona índices específicos para otimizar consultas de SLA e configurações

-- Criar tabelas se não existirem (baseado na Migration 050)
CREATE TABLE IF NOT EXISTS department_priorities (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight INTEGER NOT NULL,
    color TEXT DEFAULT '#6B7280',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_priority_name_per_dept UNIQUE(company_id, department_id, name),
    CONSTRAINT unique_priority_weight_per_dept UNIQUE(company_id, department_id, weight)
);

CREATE TABLE IF NOT EXISTS sla_configurations (
    id SERIAL PRIMARY KEY,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    incident_type_id INTEGER NOT NULL REFERENCES incident_types(id) ON DELETE CASCADE,
    priority_id INTEGER REFERENCES department_priorities(id) ON DELETE SET NULL,
    response_time_hours INTEGER NOT NULL CHECK (response_time_hours > 0),
    resolution_time_hours INTEGER NOT NULL CHECK (resolution_time_hours > 0),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_sla_config UNIQUE(company_id, department_id, incident_type_id, priority_id)
);

-- Índices adicionais para sla_configurations
CREATE INDEX IF NOT EXISTS idx_sla_configurations_company_active 
  ON sla_configurations(company_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sla_configurations_department_active 
  ON sla_configurations(department_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_sla_configurations_incident_type 
  ON sla_configurations(incident_type_id);

CREATE INDEX IF NOT EXISTS idx_sla_configurations_priority_lookup 
  ON sla_configurations(priority_id) 
  WHERE priority_id IS NOT NULL;

-- Índices para melhorar consultas de SLA em tickets
CREATE INDEX IF NOT EXISTS idx_tickets_sla_lookup 
  ON tickets(company_id, department_id, incident_type_id, priority) 
  WHERE sla_breached IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_response_time 
  ON tickets(created_at, first_response_at) 
  WHERE first_response_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_resolution_time 
  ON tickets(created_at, resolved_at) 
  WHERE resolved_at IS NOT NULL;

-- Índice para consultas de SLA por status temporal
CREATE INDEX IF NOT EXISTS idx_tickets_sla_status_time 
  ON tickets(status, created_at, sla_breached);

-- Índices para department_priorities (se ainda não existirem)
CREATE INDEX IF NOT EXISTS idx_department_priorities_weight 
  ON department_priorities(company_id, department_id, weight, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_department_priorities_lookup 
  ON department_priorities(company_id, department_id, name) 
  WHERE is_active = true;

-- Comentários para documentação
COMMENT ON INDEX idx_sla_configurations_company_active IS 'Otimização para busca de SLA por empresa ativa';
COMMENT ON INDEX idx_sla_configurations_department_active IS 'Otimização para busca de SLA por departamento ativo';
COMMENT ON INDEX idx_tickets_sla_lookup IS 'Otimização para busca de configuração SLA por ticket';
COMMENT ON INDEX idx_tickets_sla_response_time IS 'Otimização para cálculo de tempo de resposta SLA';
COMMENT ON INDEX idx_tickets_sla_resolution_time IS 'Otimização para cálculo de tempo de resolução SLA';
COMMENT ON INDEX idx_department_priorities_weight IS 'Otimização para ordenação por peso de prioridades';

-- Log da execução
SELECT 
  'Fase 3.1 - Índices de Performance SLA instalados com sucesso!' as status,
  NOW() as timestamp; 
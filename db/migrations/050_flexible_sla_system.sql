-- Migration 050: Sistema de SLA Flexível
-- Adiciona tabelas para prioridades por departamento e configurações de SLA granulares

-- Tabela para prioridades customizáveis por departamento
CREATE TABLE IF NOT EXISTS department_priorities (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  weight INTEGER NOT NULL, -- 1 = menor prioridade, maior número = maior prioridade
  color TEXT DEFAULT '#6B7280', -- Cor para UI
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_priority_name_per_dept UNIQUE(company_id, department_id, name),
  CONSTRAINT unique_priority_weight_per_dept UNIQUE(company_id, department_id, weight)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_department_priorities_company_dept ON department_priorities(company_id, department_id);
CREATE INDEX IF NOT EXISTS idx_department_priorities_active ON department_priorities(is_active) WHERE is_active = true;

-- Tabela para configurações de SLA granulares
CREATE TABLE IF NOT EXISTS sla_configurations (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  incident_type_id INTEGER NOT NULL REFERENCES incident_types(id) ON DELETE CASCADE,
  priority_id INTEGER REFERENCES department_priorities(id) ON DELETE SET NULL, -- NULL = usa prioridade padrão
  response_time_hours INTEGER NOT NULL CHECK (response_time_hours > 0),
  resolution_time_hours INTEGER NOT NULL CHECK (resolution_time_hours > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_sla_config UNIQUE(company_id, department_id, incident_type_id, priority_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_sla_configurations_lookup ON sla_configurations(company_id, department_id, incident_type_id, priority_id);
CREATE INDEX IF NOT EXISTS idx_sla_configurations_active ON sla_configurations(is_active) WHERE is_active = true;

-- Adicionar flag para identificar empresas que usam o sistema flexível de SLA
ALTER TABLE companies ADD COLUMN IF NOT EXISTS uses_flexible_sla BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON TABLE department_priorities IS 'Prioridades customizáveis por departamento de cada empresa';
COMMENT ON TABLE sla_configurations IS 'Configurações de SLA granulares por empresa/departamento/tipo/prioridade';
COMMENT ON COLUMN companies.uses_flexible_sla IS 'Flag para identificar empresas que usam o sistema flexível de SLA'; 
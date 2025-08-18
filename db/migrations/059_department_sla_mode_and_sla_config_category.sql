-- Migration 059: SLA por Departamento (modo) e Categoria em SLA Configurations
-- Objetivo:
--  1) Adicionar coluna `sla_mode` em `departments` para controlar se o SLA é por tipo ou por categoria
--  2) Adicionar coluna opcional `category_id` em `sla_configurations`
--  3) Ajustar unicidade para suportar combinações com e sem categoria (sem fallback implícito)
--  4) Criar índices de performance/lookup compatíveis
-- Observações:
--  - A coluna `sla_mode` nasce com DEFAULT 'type' e NOT NULL (backfill automático)
--  - Mantemos as estruturas idempotentes com IF NOT EXISTS

-- 1) Criar o tipo ENUM sla_mode (compatível com ambientes sem DO $$ e sem IF NOT EXISTS)
-- Estratégia: dropar se existir (não deve haver colunas referenciando ainda) e recriar
DROP TYPE IF EXISTS sla_mode;
CREATE TYPE sla_mode AS ENUM ('type', 'category');

-- 2) Adicionar coluna sla_mode em departments (default 'type')
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS sla_mode sla_mode NOT NULL DEFAULT 'type';

-- Índice auxiliar para consultas por modo dentro da empresa (apenas ativos)
CREATE INDEX IF NOT EXISTS idx_departments_sla_mode
  ON departments (company_id, sla_mode)
  WHERE is_active = true;

-- 3) Adicionar coluna category_id em sla_configurations
ALTER TABLE sla_configurations
  ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;

-- 4) Ajustar unicidade
--    Remover a constraint/índice único antigo (sem categoria) se existir
ALTER TABLE sla_configurations
  DROP CONSTRAINT IF EXISTS unique_sla_config;

--    Criar dois índices únicos parciais para cobrir os dois cenários:
--    a) Sem categoria (category_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_config_null_category
  ON sla_configurations (company_id, department_id, incident_type_id, priority_id)
  WHERE category_id IS NULL;

--    b) Com categoria (category_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS ux_sla_config_with_category
  ON sla_configurations (company_id, department_id, incident_type_id, category_id, priority_id)
  WHERE category_id IS NOT NULL;

-- 5) Índices de lookup e performance
--    Novo índice de lookup incluindo category_id
CREATE INDEX IF NOT EXISTS idx_sla_configurations_lookup_v2
  ON sla_configurations (company_id, department_id, incident_type_id, category_id, priority_id);

--    Índice filtrado por categoria ativa (útil quando modo=category)
CREATE INDEX IF NOT EXISTS idx_sla_configurations_category_active
  ON sla_configurations (category_id, is_active)
  WHERE is_active = true AND category_id IS NOT NULL;

-- Fim



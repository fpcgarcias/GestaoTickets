-- Migration: Simple expand ticket_status_history to support priority changes
-- Expansão simples da tabela ticket_status_history para suportar mudanças de prioridade

-- Tornar new_status opcional
ALTER TABLE ticket_status_history ALTER COLUMN new_status DROP NOT NULL;

-- Adicionar campo change_type
ALTER TABLE ticket_status_history ADD COLUMN IF NOT EXISTS change_type text NOT NULL DEFAULT 'status';

-- Adicionar campos de prioridade
ALTER TABLE ticket_status_history ADD COLUMN IF NOT EXISTS old_priority ticket_priority;
ALTER TABLE ticket_status_history ADD COLUMN IF NOT EXISTS new_priority ticket_priority; 
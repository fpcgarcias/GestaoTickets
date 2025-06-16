-- Migration: Expand ticket_status_history to support priority changes
-- Adiciona campos para suportar mudanças de prioridade na tabela existente

-- Primeiro tornar new_status opcional (já que pode ser mudança só de prioridade)
ALTER TABLE ticket_status_history ALTER COLUMN new_status DROP NOT NULL;

-- Adicionar campo para identificar o tipo de mudança
ALTER TABLE ticket_status_history ADD COLUMN change_type text NOT NULL DEFAULT 'status';

-- Adicionar campos para mudanças de prioridade (opcionais)
ALTER TABLE ticket_status_history ADD COLUMN old_priority ticket_priority;
ALTER TABLE ticket_status_history ADD COLUMN new_priority ticket_priority;

-- Comentários para documentação
COMMENT ON COLUMN ticket_status_history.change_type IS 'Tipo de mudança: status ou priority';
COMMENT ON COLUMN ticket_status_history.old_priority IS 'Prioridade anterior (apenas para mudanças de prioridade)';
COMMENT ON COLUMN ticket_status_history.new_priority IS 'Nova prioridade (apenas para mudanças de prioridade)';

-- Criar índice para otimizar consultas por tipo de mudança
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_change_type ON ticket_status_history(change_type);
CREATE INDEX IF NOT EXISTS idx_ticket_status_history_ticket_change_type ON ticket_status_history(ticket_id, change_type); 
-- Migration: Add New Ticket Status
-- Add new status values to the ticket_status enum

-- Adicionar novos valores ao enum ticket_status
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'suspended';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'waiting_customer';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'escalated';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'in_analysis';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'pending_deployment';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'reopened';

-- Comentários para documentação
COMMENT ON TYPE ticket_status IS 'Status dos tickets:
- new: Novo ticket aberto
- ongoing: Em andamento (SLA ativo)
- suspended: Suspenso - aguardando terceiros (SLA pausado)
- waiting_customer: Aguardando cliente (SLA pausado)
- escalated: Escalado para nível superior (SLA ativo)
- in_analysis: Em análise técnica profunda (SLA ativo)  
- pending_deployment: Aguardando janela de deploy (SLA pausado)
- reopened: Reaberto após resolução (SLA reinicia)
- resolved: Resolvido (SLA finalizado)'; 
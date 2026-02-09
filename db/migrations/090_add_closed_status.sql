-- Migration 090: Adicionar status "Encerrado" (closed) ao sistema de tickets
-- Este status será usado para tickets fechados sem resolução efetiva (timeout, abandono, etc)
-- Diferente de "resolved" que indica resolução efetiva do problema

-- Adicionar valor 'closed' ao enum ticket_status
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'closed';

-- Adicionar valor 'ticket_closed' ao enum email_template_type
-- Este template será usado para notificar clientes sobre tickets encerrados automaticamente
ALTER TYPE email_template_type ADD VALUE IF NOT EXISTS 'ticket_closed';

-- Atualizar comentário do enum ticket_status para incluir o novo status
COMMENT ON TYPE ticket_status IS 'Status dos tickets:
- new: Novo ticket aberto
- ongoing: Em andamento (SLA ativo)
- suspended: Suspenso - aguardando terceiros (SLA pausado)
- waiting_customer: Aguardando cliente (SLA pausado)
- escalated: Escalado para nível superior (SLA ativo)
- in_analysis: Em análise técnica profunda (SLA ativo)  
- pending_deployment: Aguardando janela de deploy (SLA pausado)
- reopened: Reaberto após resolução (SLA reinicia)
- resolved: Resolvido (SLA finalizado)
- closed: Encerrado sem resolução efetiva (SLA finalizado)';

-- Comentário sobre o novo template type
COMMENT ON TYPE email_template_type IS 'Tipos de templates de e-mail:
...
- ticket_closed: Template para notificar sobre ticket encerrado automaticamente';

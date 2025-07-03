// Tipos e constantes para status de tickets

export type TicketStatus = 
  | 'new'
  | 'ongoing' 
  | 'suspended'
  | 'waiting_customer'
  | 'escalated'
  | 'in_analysis'
  | 'pending_deployment'
  | 'reopened'
  | 'resolved';

/**
 * ⏰ IMPORTANTE: Qualquer mudança de status de "new" para qualquer outro 
 * DEVE AUTOMATICAMENTE definir o first_response_at do ticket!
 * 
 * Isso garante que o timer de primeira resposta pare imediatamente
 * quando há qualquer movimentação no ticket.
 */

// Status que PAUSAM o SLA (tempo não conta)
export const SLA_PAUSED_STATUSES: TicketStatus[] = [
  'suspended',       // Aguardando terceiros
  'waiting_customer', // Aguardando cliente
  'escalated',       // Escalado - pausar SLA
  'pending_deployment' // Aguardando janela de deploy
];

// Status que MANTÉM o SLA ativo (tempo continua contando)
export const SLA_ACTIVE_STATUSES: TicketStatus[] = [
  'new',         // Novo
  'ongoing',     // Em andamento
  'in_analysis', // Em análise
  'reopened'     // Reaberto
];

// Status final (SLA finalizado)
export const SLA_FINISHED_STATUSES: TicketStatus[] = [
  'resolved'     // Resolvido
];

// Status que reiniciam o SLA quando aplicados
export const SLA_RESTART_STATUSES: TicketStatus[] = [
  'reopened'     // Reaberto
];

/**
 * 🔥 REGRA CRÍTICA DE PRIMEIRA RESPOSTA:
 * 
 * A primeira resposta é considerada QUALQUER mudança de status de "new" para outro.
 * Não importa se é para "ongoing", "resolved", "escalated", etc.
 * 
 * A partir do momento que o ticket não está mais "new", significa que foi tocado
 * por alguém e o timer de primeira resposta deve parar.
 */

// Configuração visual dos status
export const STATUS_CONFIG = {
  new: {
    label: 'Novo',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🆕'
  },
  ongoing: {
    label: 'Em Andamento',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '⚡'
  },
  suspended: {
    label: 'Suspenso',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '⏸️'
  },
  waiting_customer: {
    label: 'Aguardando Cliente',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '⏳'
  },
  escalated: {
    label: 'Escalado',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🚨'
  },
  in_analysis: {
    label: 'Em Análise',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🔍'
  },
  pending_deployment: {
    label: 'Aguardando Deploy',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🚀'
  },
  reopened: {
    label: 'Reaberto',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '🔄'
  },
  resolved: {
    label: 'Resolvido',
    color: 'gray',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800',
    icon: '✅'
  }
} as const;

// Funções utilitárias
export function isSlaPaused(status: TicketStatus): boolean {
  return SLA_PAUSED_STATUSES.includes(status);
}

export function isSlaActive(status: TicketStatus): boolean {
  return SLA_ACTIVE_STATUSES.includes(status);
}

export function isSlaFinished(status: TicketStatus): boolean {
  return SLA_FINISHED_STATUSES.includes(status);
}

export function shouldRestartSla(status: TicketStatus): boolean {
  return SLA_RESTART_STATUSES.includes(status);
}

export function getStatusConfig(status: TicketStatus) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.new;
} 
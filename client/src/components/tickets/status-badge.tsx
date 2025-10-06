import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';
import { getPriorityColorByWeight, convertLegacyToWeight } from '@/hooks/use-priorities';
import { useI18n } from '@/i18n';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

interface StatusIconProps {
  status: TicketStatus;
  className?: string;
}

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'critical' | string;
  weight?: number; // Para prioridades customizadas
  color?: string; // Para prioridades customizadas
  name?: string; // Para prioridades customizadas
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = getStatusConfig(status);
  const { formatMessage } = useI18n();

  // Mapear status para chaves de tradução
  const getTranslatedStatus = (status: TicketStatus) => {
    const statusMap: Record<TicketStatus, string> = {
      'new': formatMessage('tickets.new'),
      'ongoing': formatMessage('tickets.ongoing'),
      'suspended': formatMessage('tickets.suspended'),
      'waiting_customer': formatMessage('tickets.waiting_customer'),
      'escalated': formatMessage('tickets.escalated'),
      'in_analysis': formatMessage('tickets.in_analysis'),
      'pending_deployment': formatMessage('tickets.pending_deployment'),
      'reopened': formatMessage('tickets.reopened'),
      'resolved': formatMessage('tickets.resolved')
    };
    return statusMap[status] || config.label;
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        'bg-gray-100 text-gray-800', // Cor uniforme cinza claro
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {getTranslatedStatus(status)}
    </span>
  );
};

export const StatusIcon: React.FC<StatusIconProps> = ({ status, className }) => {
  const config = getStatusConfig(status);
  const { formatMessage } = useI18n();

  // Mapear status para chaves de tradução
  const getTranslatedStatus = (status: TicketStatus) => {
    const statusMap: Record<TicketStatus, string> = {
      'new': formatMessage('tickets.new'),
      'ongoing': formatMessage('tickets.ongoing'),
      'suspended': formatMessage('tickets.suspended'),
      'waiting_customer': formatMessage('tickets.waiting_customer'),
      'escalated': formatMessage('tickets.escalated'),
      'in_analysis': formatMessage('tickets.in_analysis'),
      'pending_deployment': formatMessage('tickets.pending_deployment'),
      'reopened': formatMessage('tickets.reopened'),
      'resolved': formatMessage('tickets.resolved')
    };
    return statusMap[status] || config.label;
  };

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 text-xs',
        className
      )}
      title={getTranslatedStatus(status)} // Tooltip para mostrar o nome do status
    >
      {config.icon}
    </span>
  );
};

// Manter StatusDot para compatibilidade (redirecionando para StatusIcon)
export const StatusDot: React.FC<StatusIconProps> = ({ status, className }) => {
  return <StatusIcon status={status} className={className} />;
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  weight, 
  color, 
  name,
  className 
}) => {
  const { formatMessage } = useI18n();
  
  const priorityLabels: Record<string, string> = {
    'low': formatMessage('tickets.priority_labels.low'),
    'medium': formatMessage('tickets.priority_labels.medium'),
    'high': formatMessage('tickets.priority_labels.high'),
    'critical': formatMessage('tickets.priority_labels.critical')
  };

  const priorityColors: Record<string, string> = {
    'low': 'bg-gray-100 text-gray-800',
    'medium': 'bg-blue-100 text-blue-800',
    'high': 'bg-orange-100 text-orange-800',
    'critical': 'bg-red-100 text-red-800'
  };

  // Determinar label e cor
  let displayName: string;
  let colorClasses: string;
  let indicatorColor: string | undefined;

  // Se é uma prioridade customizada (tem weight ou name)
  if (weight !== undefined || name) {
    displayName = name || priority; // Usar priority como fallback ao invés de 'Customizada'
    indicatorColor = color || getPriorityColorByWeight(weight || 2);
    colorClasses = 'bg-gray-50 text-gray-700 border border-gray-200';
  } else {
    // Prioridade legada
    const legacyKey = priority as keyof typeof priorityLabels;
    displayName = priorityLabels[legacyKey] || priority;
    colorClasses = priorityColors[legacyKey] || 'bg-gray-100 text-gray-800';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2',
        colorClasses,
        className
      )}
    >
      {indicatorColor && (
        <div 
          className="w-2 h-2 rounded-full mr-1.5" 
          style={{ backgroundColor: indicatorColor }}
        />
      )}
      {displayName}
    </span>
  );
};

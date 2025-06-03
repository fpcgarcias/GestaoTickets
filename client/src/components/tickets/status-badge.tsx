import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';

interface StatusBadgeProps {
  status: TicketStatus;
  className?: string;
}

interface StatusIconProps {
  status: TicketStatus;
  className?: string;
}

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        'bg-gray-100 text-gray-800', // Cor uniforme cinza claro
        className
      )}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

export const StatusIcon: React.FC<StatusIconProps> = ({ status, className }) => {
  const config = getStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center w-4 h-4 text-xs',
        className
      )}
      title={config.label} // Tooltip para mostrar o nome do status
    >
      {config.icon}
    </span>
  );
};

// Manter StatusDot para compatibilidade (redirecionando para StatusIcon)
export const StatusDot: React.FC<StatusIconProps> = ({ status, className }) => {
  return <StatusIcon status={status} className={className} />;
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const priorityLabels: Record<string, string> = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'critical': 'Crítica'
  };

  const priorityColors = {
    'low': 'bg-gray-100 text-gray-800',
    'medium': 'bg-blue-100 text-blue-800',
    'high': 'bg-orange-100 text-orange-800',
    'critical': 'bg-red-100 text-red-800'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2',
        priorityColors[priority],
        className
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
};

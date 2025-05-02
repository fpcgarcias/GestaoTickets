import React from 'react';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'new' | 'ongoing' | 'resolved';
  className?: string;
}

interface StatusDotProps {
  status: 'new' | 'ongoing' | 'resolved';
  className?: string;
}

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high' | 'critical';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusLabels: Record<string, string> = {
    'new': 'Novo',
    'ongoing': 'Em Andamento',
    'resolved': 'Resolvido'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
        STATUS_COLORS[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  );
};

export const StatusDot: React.FC<StatusDotProps> = ({ status, className }) => {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        {
          'bg-amber-500': status === 'new',
          'bg-blue-500': status === 'ongoing',
          'bg-green-500': status === 'resolved',
        },
        className
      )}
    />
  );
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  const priorityLabels: Record<string, string> = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'critical': 'Crítica'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2',
        PRIORITY_COLORS[priority],
        className
      )}
    >
      {priorityLabels[priority]}
    </span>
  );
};

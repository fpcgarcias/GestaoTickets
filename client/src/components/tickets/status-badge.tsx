import React from 'react';
import { cn } from '@/lib/utils';
import { getStatusConfig, type TicketStatus } from '@shared/ticket-utils';
import { getPriorityColorByWeight, convertLegacyToWeight } from '@/hooks/use-priorities';

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

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium gap-1',
        'bg-muted/60 text-foreground',
        className
      )}
    >
      <span>{config.icon}</span>
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

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ 
  priority, 
  weight, 
  color, 
  name,
  className 
}) => {
  const priorityLabels: Record<string, string> = {
    'low': 'Baixa',
    'medium': 'Média',
    'high': 'Alta',
    'critical': 'Crítica'
  };

  const priorityColors: Record<string, string> = {
    'low': 'bg-muted/60 text-muted-foreground',
    'medium': 'bg-primary/15 text-primary',
    'high': 'bg-amber-100 text-amber-700 dark:bg-amber-400/20 dark:text-amber-200',
    'critical': 'bg-destructive/15 text-destructive'
  };

  // Determinar label e cor
  let displayName: string;
  let colorClasses: string;
  let indicatorColor: string | undefined;

  // Se é uma prioridade customizada (tem weight ou name)
  if (weight !== undefined || name) {
    displayName = name || priority; // Usar priority como fallback ao invés de 'Customizada'
    indicatorColor = color || getPriorityColorByWeight(weight || 2);
    colorClasses = 'bg-muted/60 text-muted-foreground border border-border';
  } else {
    // Prioridade legada
    const legacyKey = priority as keyof typeof priorityLabels;
    displayName = priorityLabels[legacyKey] || priority;
    colorClasses = priorityColors[legacyKey] || 'bg-muted/60 text-foreground';
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

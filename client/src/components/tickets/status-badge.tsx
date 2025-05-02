import React from 'react';
import { cn } from '@/lib/utils';
import { TICKET_STATUS, STATUS_COLORS, PRIORITY_LEVELS, PRIORITY_COLORS } from '@/lib/utils';

interface StatusDotProps {
  status: string;
  className?: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status, className }) => {
  return (
    <div 
      className={cn(
        "w-3 h-3 rounded-full mr-2",
        STATUS_COLORS[status as keyof typeof STATUS_COLORS],
        className
      )}
    />
  );
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const statusText = {
    [TICKET_STATUS.NEW]: 'New',
    [TICKET_STATUS.ONGOING]: 'On-Going',
    [TICKET_STATUS.RESOLVED]: 'Resolved'
  };

  return (
    <div className="flex items-center">
      <StatusDot status={status} />
      <span className={cn("text-sm", className)}>
        {statusText[status as keyof typeof statusText]}
      </span>
    </div>
  );
};

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority, className }) => {
  if (!priority || priority === PRIORITY_LEVELS.LOW || priority === PRIORITY_LEVELS.MEDIUM) {
    return null;
  }

  const priorityText = {
    [PRIORITY_LEVELS.HIGH]: 'High Priority',
    [PRIORITY_LEVELS.CRITICAL]: 'Critical Priority'
  };
  
  return (
    <span 
      className={cn(
        "text-xs font-medium px-2 py-1 rounded mr-2",
        PRIORITY_COLORS[priority as keyof typeof PRIORITY_COLORS],
        className
      )}
    >
      {priorityText[priority as keyof typeof priorityText]}
    </span>
  );
};

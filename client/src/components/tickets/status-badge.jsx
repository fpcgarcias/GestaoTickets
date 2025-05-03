import React from 'react';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/utils';
import { cn } from '@/lib/utils';
export var StatusBadge = function (_a) {
    var status = _a.status, className = _a.className;
    var statusLabels = {
        'new': 'Novo',
        'ongoing': 'Em Andamento',
        'resolved': 'Resolvido'
    };
    return (<span className={cn('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium', STATUS_COLORS[status], className)}>
      {statusLabels[status]}
    </span>);
};
export var StatusDot = function (_a) {
    var status = _a.status, className = _a.className;
    return (<span className={cn('inline-block h-2 w-2 rounded-full', {
            'bg-amber-500': status === 'new',
            'bg-blue-500': status === 'ongoing',
            'bg-green-500': status === 'resolved',
        }, className)}/>);
};
export var PriorityBadge = function (_a) {
    var priority = _a.priority, className = _a.className;
    var priorityLabels = {
        'low': 'Baixa',
        'medium': 'Média',
        'high': 'Alta',
        'critical': 'Crítica'
    };
    return (<span className={cn('inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2', PRIORITY_COLORS[priority], className)}>
      {priorityLabels[priority]}
    </span>);
};

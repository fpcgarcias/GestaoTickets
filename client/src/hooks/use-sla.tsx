/**
 * Hook para integração com o novo sistema de SLA
 * Resolve SLA baseado nas novas configurações granulares
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';

// Interfaces para SLA
export interface ResolvedSLA {
  responseTimeHours: number;
  resolutionTimeHours: number;
  source: 'specific' | 'department_default' | 'company_default' | 'global_fallback';
  configId?: number;
  fallbackReason?: string;
}

export interface SLAStatus {
  isResponseOverdue: boolean;
  isResolutionOverdue: boolean;
  responseTimeRemaining: number; // horas (negativo se atrasado)
  resolutionTimeRemaining: number; // horas (negativo se atrasado)
  responseDeadline: Date;
  resolutionDeadline: Date;
}

export interface TicketSLAInfo {
  ticketId: number;
  sla: ResolvedSLA;
  status: SLAStatus;
  createdAt: Date;
  firstResponseAt?: Date;
  resolvedAt?: Date;
}

/**
 * Hook para resolver SLA de um ticket específico
 */
export function useTicketSLA(
  companyId: number,
  departmentId: number,
  incidentTypeId: number,
  priority: string | number,
  enabled: boolean = true
) {
  return useQuery<ResolvedSLA>({
    queryKey: ['/api/sla/resolve', companyId, departmentId, incidentTypeId, priority],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        departmentId: departmentId.toString(),
        incidentTypeId: incidentTypeId.toString(),
        priority: priority.toString()
      });

      const res = await fetch(`/api/sla/resolve?${params}`);
      if (!res.ok) throw new Error('Erro ao resolver SLA');
      return res.json();
    },
    enabled: enabled && !!companyId && !!departmentId && !!incidentTypeId && !!priority,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 15 * 60 * 1000, // 15 minutos no cache
  });
}

/**
 * Hook para calcular status de SLA de um ticket
 */
export function useTicketSLAStatus(
  ticketId: number,
  createdAt: Date,
  firstResponseAt?: Date,
  resolvedAt?: Date,
  sla?: ResolvedSLA
): SLAStatus | null {
  if (!sla) return null;

  const now = new Date();
  const responseDeadline = new Date(createdAt.getTime() + sla.responseTimeHours * 60 * 60 * 1000);
  const resolutionDeadline = new Date(createdAt.getTime() + sla.resolutionTimeHours * 60 * 60 * 1000);

  const responseTimeRemaining = (responseDeadline.getTime() - now.getTime()) / (1000 * 60 * 60); // horas
  const resolutionTimeRemaining = (resolutionDeadline.getTime() - now.getTime()) / (1000 * 60 * 60); // horas

  const isResponseOverdue = !firstResponseAt && responseTimeRemaining < 0;
  const isResolutionOverdue = !resolvedAt && resolutionTimeRemaining < 0;

  return {
    isResponseOverdue,
    isResolutionOverdue,
    responseTimeRemaining,
    resolutionTimeRemaining,
    responseDeadline,
    resolutionDeadline
  };
}

/**
 * Hook completo que combina SLA e status para um ticket
 */
export function useTicketWithSLA(
  ticketId: number,
  companyId?: number,
  departmentId?: number,
  incidentTypeId?: number,
  priority?: string,
  createdAt?: string,
  firstResponseAt?: string,
  resolvedAt?: string
): TicketSLAInfo | null {
  const { data: sla } = useTicketSLA(
    companyId || 0,
    departmentId || 0,
    incidentTypeId || 0,
    priority || 'medium',
    !!(companyId && departmentId && incidentTypeId && priority)
  );

  if (!sla || !createdAt) return null;

  const createdDate = new Date(createdAt);
  const firstResponseDate = firstResponseAt ? new Date(firstResponseAt) : undefined;
  const resolvedDate = resolvedAt ? new Date(resolvedAt) : undefined;

  const status = useTicketSLAStatus(ticketId, createdDate, firstResponseDate, resolvedDate, sla);

  if (!status) return null;

  return {
    ticketId,
    sla,
    status,
    createdAt: createdDate,
    firstResponseAt: firstResponseDate,
    resolvedAt: resolvedDate
  };
}

/**
 * Utilitários para formatação de SLA
 */
export const slaUtils = {
  /**
   * Formatar tempo restante de SLA
   */
  formatTimeRemaining: (hours: number): string => {
    if (hours < 0) {
      const overdue = Math.abs(hours);
      if (overdue < 1) {
        return `${Math.round(overdue * 60)}min atrasado`;
      }
      return `${Math.round(overdue)}h atrasado`;
    }

    if (hours < 1) {
      return `${Math.round(hours * 60)}min restantes`;
    }

    if (hours < 24) {
      return `${Math.round(hours)}h restantes`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h restantes`;
  },

  /**
   * Obter cor baseada no status de SLA
   */
  getSLAStatusColor: (timeRemaining: number, isOverdue: boolean): string => {
    if (isOverdue) return 'text-red-600';
    if (timeRemaining < 2) return 'text-orange-600'; // Menos de 2 horas
    if (timeRemaining < 8) return 'text-yellow-600'; // Menos de 8 horas
    return 'text-green-600';
  },

  /**
   * Obter classe de badge baseada no status
   */
  getSLABadgeVariant: (timeRemaining: number, isOverdue: boolean): 'destructive' | 'secondary' | 'outline' | 'default' => {
    if (isOverdue) return 'destructive';
    if (timeRemaining < 2) return 'secondary'; // Próximo do prazo
    return 'outline';
  },

  /**
   * Obter descrição do tipo de SLA
   */
  getSLASourceDescription: (source: ResolvedSLA['source']): string => {
    switch (source) {
      case 'specific':
        return 'Configuração específica';
      case 'department_default':
        return 'Padrão do departamento';
      case 'company_default':
        return 'Padrão da empresa';
      case 'global_fallback':
        return 'Padrão global';
      default:
        return 'Desconhecido';
    }
  }
};

export default {
  useTicketSLA,
  useTicketSLAStatus,
  useTicketWithSLA,
  slaUtils
}; 
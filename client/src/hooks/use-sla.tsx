/**
 * Hook para integração com o novo sistema de SLA
 * Resolve SLA baseado nas novas configurações granulares
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './use-auth';
import { calculateSLAStatus, addBusinessTime, getBusinessHoursConfig } from '@shared/utils/sla-calculator';
import { type TicketStatus } from '@shared/ticket-utils';

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

export interface SLAInfo {
  responseTimeHours: number;
  resolutionTimeHours: number;
  source: string;
  fallbackReason?: string;
  responseTime?: string;
  resolutionTime?: string;
  isOverdue?: boolean;
  timeRemaining?: string;
}

/**
 * Hook para resolver SLA de um ticket específico
 */
export function useTicketSLA(
  companyId: number,
  departmentId: number,
  incidentTypeId: number,
  priority: string | number,
  categoryId?: number,
  enabled: boolean = true
) {
  return useQuery<ResolvedSLA>({
    queryKey: ['/api/sla/resolve', companyId, departmentId, incidentTypeId, categoryId, priority],
    queryFn: async () => {
      const params = new URLSearchParams({
        companyId: companyId.toString(),
        departmentId: departmentId.toString(),
        incidentTypeId: incidentTypeId.toString(),
        priority: priority.toString()
      });
      if (categoryId) params.append('categoryId', categoryId.toString());

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
 * CORRIGIDO: Agora usa sistema de horário comercial e distingue primeira resposta de resolução
 */
export function useTicketSLAStatus(
  ticketId: number,
  createdAt: Date,
  firstResponseAt?: Date,
  resolvedAt?: Date,
  sla?: ResolvedSLA,
  currentStatus: TicketStatus = 'new'
): SLAStatus | null {
  if (!sla) return null;

  const now = new Date();
  const businessHours = getBusinessHoursConfig();
  
  // CORREÇÃO: Usar addBusinessTime para calcular deadline considerando horário comercial
  const responseDeadline = addBusinessTime(createdAt, sla.responseTimeHours, businessHours);
  const resolutionDeadline = addBusinessTime(createdAt, sla.resolutionTimeHours, businessHours);
  
  // 🔥 CRÍTICO: SLA de primeira resposta
  let responseSLAResult;
  if (firstResponseAt || currentStatus !== 'new') {
    // PRIMEIRA RESPOSTA JÁ FOI DADA - NÃO CALCULAR NADA!
    responseSLAResult = {
      timeElapsed: 0,
      timeRemaining: 0,
      percentConsumed: 0,
      isBreached: false,
      dueDate: responseDeadline,
      status: 'ok' as const,
      isPaused: false
    };
  } else {
    // Ainda aguardando primeira resposta
    responseSLAResult = calculateSLAStatus(
      createdAt,
      sla.responseTimeHours,
      now,
      undefined, // Não resolvido ainda
      businessHours,
      [],
      currentStatus
    );
  }
  
  // SLA de resolução (só calcular se não foi resolvido ainda)
  const resolutionSLAResult = calculateSLAStatus(
    createdAt,
    sla.resolutionTimeHours,
    now,
    resolvedAt,
    businessHours,
    [],
    currentStatus
  );
  
  // Converter milissegundos para horas
  const responseTimeRemaining = responseSLAResult.timeRemaining / (1000 * 60 * 60);
  const resolutionTimeRemaining = resolutionSLAResult.timeRemaining / (1000 * 60 * 60);
  
  // Se está atrasado, tornar negativo
  const responseTimeRemainingFinal = responseSLAResult.isBreached ? 
    -(responseSLAResult.timeElapsed - (sla.responseTimeHours * 60 * 60 * 1000)) / (1000 * 60 * 60) :
    responseTimeRemaining;
    
  const resolutionTimeRemainingFinal = resolutionSLAResult.isBreached ? 
    -(resolutionSLAResult.timeElapsed - (sla.resolutionTimeHours * 60 * 60 * 1000)) / (1000 * 60 * 60) :
    resolutionTimeRemaining;

  const isResponseOverdue = !firstResponseAt && currentStatus === 'new' && responseSLAResult.isBreached;
  const isResolutionOverdue = !resolvedAt && resolutionSLAResult.isBreached;

  return {
    isResponseOverdue,
    isResolutionOverdue,
    responseTimeRemaining: responseTimeRemainingFinal,
    resolutionTimeRemaining: resolutionTimeRemainingFinal,
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
  categoryId?: number,
  priority?: string,
  createdAt?: string,
  firstResponseAt?: string,
  resolvedAt?: string,
  currentStatus: TicketStatus = 'new'
): TicketSLAInfo | null {
  const { data: sla } = useTicketSLA(
    companyId || 0,
    departmentId || 0,
    incidentTypeId || 0,
    priority || 'medium',
    categoryId,
    !!(companyId && departmentId && incidentTypeId && priority)
  );

  if (!sla || !createdAt) return null;

  const createdDate = new Date(createdAt);
  const firstResponseDate = firstResponseAt ? new Date(firstResponseAt) : undefined;
  const resolvedDate = resolvedAt ? new Date(resolvedAt) : undefined;

  const status = useTicketSLAStatus(ticketId, createdDate, firstResponseDate, resolvedDate, sla, currentStatus);

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
  formatTimeRemaining: (hours: number, locale: string = 'pt-BR'): string => {
    const isEnglish = locale === 'en-US';
    const overdueText = isEnglish ? 'overdue' : 'atrasado';
    const remainingText = isEnglish ? 'remaining' : 'restantes';

    if (hours < 0) {
      const overdue = Math.abs(hours);
      if (overdue < 1) {
        return `${Math.round(overdue * 60)}min ${overdueText}`;
      }
      return `${Math.round(overdue)}h ${overdueText}`;
    }

    if (hours < 1) {
      return `${Math.round(hours * 60)}min ${remainingText}`;
    }

    if (hours < 24) {
      return `${Math.round(hours)}h ${remainingText}`;
    }

    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days}d ${remainingHours}h ${remainingText}`;
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

export function useSLA(
  companyId: number | undefined,
  departmentId: number | undefined,
  incidentTypeId: number | undefined,
  priorityId: number | undefined,
  priorityName?: string
) {
  return useQuery({
    queryKey: ['sla', companyId, departmentId, incidentTypeId, priorityId, priorityName],
    queryFn: async (): Promise<SLAInfo | null> => {
      if (!companyId) {
        return null;
      }

      const params = new URLSearchParams();
      params.append('companyId', companyId.toString());
      
      if (departmentId) params.append('departmentId', departmentId.toString());
      if (incidentTypeId) params.append('incidentTypeId', incidentTypeId.toString());
      if (priorityId) params.append('priorityId', priorityId.toString());
      if (priorityName) params.append('priorityName', priorityName);

      const response = await fetch(`/api/sla-resolver?${params}`);
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      
      // Se não há configuração de SLA, retornar null ao invés de criar valores fake
      if (!data || data.responseTimeHours === undefined) {
        return null;
      }

      return {
        ...data,
        responseTime: `${data.responseTimeHours}h`,
        resolutionTime: `${data.resolutionTimeHours}h`
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos
    retry: 1, // Tentar apenas uma vez - se falhar, assumir que não há SLA configurado
  });
}

export default {
  useTicketSLA,
  useTicketSLAStatus,
  useTicketWithSLA,
  slaUtils
}; 
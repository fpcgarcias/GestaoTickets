import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, AlertTriangle, CheckCircle, Pause, Target } from 'lucide-react';
import { calculateSLAStatus, formatTimeRemaining, getBusinessHoursConfig, convertStatusHistoryToPeriods } from '@shared/utils/sla-calculator';
import { isSlaPaused, isSlaFinished, type TicketStatus } from '@shared/ticket-utils';
import { useTicketWithSLA, slaUtils } from '@/hooks/use-sla';

interface SLAIndicatorProps {
  ticketCreatedAt: string;
  ticketPriority: string;
  ticketStatus: TicketStatus;
  ticketCompanyId: number;
  ticketId: number;
  resolvedAt?: string;
  // Novos campos para o sistema flexível de SLA
  departmentId?: number;
  incidentTypeId?: number;
  firstResponseAt?: string;
}

export const SLAIndicator: React.FC<SLAIndicatorProps> = ({ 
  ticketCreatedAt, 
  ticketPriority,
  ticketStatus,
  ticketCompanyId,
  ticketId,
  resolvedAt,
  departmentId,
  incidentTypeId,
  firstResponseAt
}) => {
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [percentConsumed, setPercentConsumed] = useState<number>(0);
  const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'critical' | 'breached'>('ok');
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [useNewSLA, setUseNewSLA] = useState<boolean>(false);

  // Tentar usar o novo sistema de SLA primeiro
  const ticketSLAInfo = useTicketWithSLA(
    ticketId,
    ticketCompanyId,
    departmentId,
    incidentTypeId,
    ticketPriority,
    ticketCreatedAt,
    firstResponseAt,
    resolvedAt
  );

  // Fallback para o sistema antigo
  const { data: slaSettingsData, isLoading: isOldSLALoading, error: oldSLAError } = useQuery({
    queryKey: ["/api/settings/sla", ticketCompanyId],
    queryFn: async () => {
      const url = `/api/settings/sla?company_id=${ticketCompanyId}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Erro ao buscar SLA: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: !!ticketCompanyId, // Sempre buscar configurações SLA antigas como fallback
  });
  
  const { data: statusHistory } = useQuery({
    queryKey: [`/api/tickets/${ticketId}/status-history`],
    queryFn: async () => {
      const response = await fetch(`/api/tickets/${ticketId}/status-history`);
      if (!response.ok) {
        throw new Error('Erro ao buscar histórico de status');
      }
      return response.json();
    },
    enabled: !!ticketId, // Sempre buscar histórico para cálculos precisos
    staleTime: 30 * 1000,
  });
  
  useEffect(() => {
    // Debug para entender por que alguns tickets não mostram SLA
    console.log(`[SLA Debug] Ticket ${ticketId}:`, {
      priority: ticketPriority,
      status: ticketStatus,
      companyId: ticketCompanyId,
      hasNewSLA: !!ticketSLAInfo,
      hasOldSLA: !!slaSettingsData,
      isLoading: isOldSLALoading,
      error: oldSLAError
    });

    // Primeiro, tentar usar o novo sistema de SLA
    if (ticketSLAInfo) {
      setUseNewSLA(true);
      const { status } = ticketSLAInfo;
      
      // Verificar se o SLA está pausado ou finalizado
      const slaIsPaused = isSlaPaused(ticketStatus);
      const slaIsFinished = isSlaFinished(ticketStatus);
      setIsPaused(slaIsPaused);
      
      if (slaIsFinished) return;
      
      if (slaIsPaused) {
        setTimeRemaining('SLA pausado');
        setSlaStatus('warning');
      } else if (status.isResolutionOverdue) {
        setTimeRemaining(slaUtils.formatTimeRemaining(status.resolutionTimeRemaining));
        setSlaStatus('breached');
      } else {
        setTimeRemaining(slaUtils.formatTimeRemaining(status.resolutionTimeRemaining));
        
        // Determinar status baseado no tempo restante
        if (status.resolutionTimeRemaining < 2) {
          setSlaStatus('critical');
        } else if (status.resolutionTimeRemaining < 8) {
          setSlaStatus('warning');
        } else {
          setSlaStatus('ok');
        }
      }
      
      return;
    }

    // Fallback para o sistema antigo
    if (isOldSLALoading || oldSLAError || !slaSettingsData || !ticketCreatedAt) return;
    
    // Verificar se o SLA está pausado ou finalizado
    const slaIsPaused = isSlaPaused(ticketStatus);
    const slaIsFinished = isSlaFinished(ticketStatus);
    setIsPaused(slaIsPaused);
    
    if (slaIsFinished) return;
    
    try {
      // Encontrar a configuração de SLA para a prioridade deste ticket
      let resolutionTimeHours: number;
      
      if (slaSettingsData && typeof slaSettingsData === 'object' && 'settings' in slaSettingsData) {
        // Formato novo da API
        const slaSetting = (slaSettingsData as any).settings[ticketPriority];
        if (!slaSetting || !slaSetting.resolution_time_hours) {
          // Se não encontrar configuração específica, usar valores padrão baseados na prioridade
          const defaultSLAs = {
            'critical': 4,
            'high': 8, 
            'medium': 24,
            'low': 48
          };
          resolutionTimeHours = defaultSLAs[ticketPriority as keyof typeof defaultSLAs] || 24;
        } else {
          resolutionTimeHours = slaSetting.resolution_time_hours;
        }
      } else {
        // Formato antigo (array)
        const slaSettings = Array.isArray(slaSettingsData) ? slaSettingsData : [];
        const slaSetting = slaSettings.find((s: any) => s.priority === ticketPriority);
        if (!slaSetting) {
          // Se não encontrar configuração específica, usar valores padrão baseados na prioridade
          const defaultSLAs = {
            'critical': 4,
            'high': 8, 
            'medium': 24,
            'low': 48
          };
          resolutionTimeHours = defaultSLAs[ticketPriority as keyof typeof defaultSLAs] || 24;
        } else {
          resolutionTimeHours = slaSetting.resolutionTimeHours || slaSetting.resolution_time_hours || 24;
        }
      }
      
      // Converter datas
      const createdDate = new Date(ticketCreatedAt);
      const resolvedDate = resolvedAt ? new Date(resolvedAt) : undefined;
      
      if (isNaN(createdDate.getTime())) {
        console.error("Data de criação inválida:", ticketCreatedAt);
        return;
      }
      
      // Converter histórico de status para períodos (se disponível)
      let statusPeriods: any[] = [];
      if (statusHistory && Array.isArray(statusHistory)) {
        try {
          statusPeriods = convertStatusHistoryToPeriods(
            createdDate,
            ticketStatus,
            statusHistory
          );
        } catch (historyError) {
          console.warn('Erro ao processar histórico de status:', historyError);
          statusPeriods = [];
        }
      }
      
      // Calcular SLA usando o novo sistema com histórico
      const businessHours = getBusinessHoursConfig();
      const slaResult = calculateSLAStatus(
        createdDate,
        resolutionTimeHours,
        new Date(),
        resolvedDate,
        businessHours,
        statusPeriods,
        ticketStatus
      );
      
      setPercentConsumed(slaResult.percentConsumed);
      setSlaStatus(slaResult.status);
      
      // Formatar texto baseado no status
      if (slaIsPaused) {
        setTimeRemaining('SLA pausado');
      } else if (slaResult.isBreached) {
        const overdueTime = formatTimeRemaining(slaResult.timeElapsed - (resolutionTimeHours * 60 * 60 * 1000), true);
        setTimeRemaining(`Excedido em ${overdueTime}`);
      } else {
        const remainingTime = formatTimeRemaining(slaResult.timeRemaining);
        setTimeRemaining(`${remainingTime} restantes`);
      }
      
    } catch (calcError) {
      console.error("Erro no cálculo de SLA:", calcError);
    }
  }, [ticketSLAInfo, slaSettingsData, isOldSLALoading, oldSLAError, ticketCreatedAt, ticketPriority, ticketStatus, ticketCompanyId, ticketId, resolvedAt, statusHistory]);
  
  if (isSlaFinished(ticketStatus)) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <CheckCircle className="h-3 w-3 text-green-600" />
        <span className="text-green-600">Resolvido</span>
      </div>
    );
  }

  // Loading state - mostrar apenas se estiver carregando e não tiver informação de SLA ainda
  if ((isOldSLALoading && !ticketSLAInfo) || (!useNewSLA && !slaSettingsData && isOldSLALoading)) {
    return (
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Clock className="h-3 w-3 animate-pulse" />
        <span>Carregando SLA...</span>
      </div>
    );
  }

  // Error state - mostrar informação útil mesmo se houver erro
  if (!ticketSLAInfo && !useNewSLA && (oldSLAError || !slaSettingsData) && !timeRemaining) {
    return (
      <div className="flex items-center gap-1 text-xs text-amber-600">
        <AlertTriangle className="h-3 w-3" />
        <span>SLA não configurado</span>
      </div>
    );
  }
  
  // Se o SLA está pausado, mostrar indicador específico
  if (isPaused) {
    return (
      <div className="flex items-center gap-1 text-xs">
        <Pause className="h-3 w-3 text-orange-600" />
        <span className="text-orange-600">SLA pausado</span>
      </div>
    );
  }
  
  // Cores baseadas no status
  const getStatusColor = () => {
    switch (slaStatus) {
      case 'breached': return 'text-red-600';
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-yellow-600';
      default: return 'text-blue-600';
    }
  };
  
  const getIcon = () => {
    switch (slaStatus) {
      case 'breached':
      case 'critical':
        return AlertTriangle;
      default:
        return Clock;
    }
  };

  const IconComponent = getIcon();
  const statusColor = getStatusColor();

  // Se não tiver timeRemaining ainda, mostrar algo útil
  const displayText = timeRemaining || 'Calculando SLA...';

  return (
    <div className="flex items-center gap-1 text-xs">
      <IconComponent className={`h-3 w-3 ${statusColor}`} />
      <span className={statusColor}>{displayText}</span>
    </div>
  );
};
